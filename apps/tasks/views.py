from django.conf import settings
from django.core.cache import cache
from django.db.models import Count, Q
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import filters as drf_filters, permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .filters import TaskFilter
from .models import Task
from .permissions import IsOwner
from .serializers import TaskSerializer


@extend_schema(tags=['tasks'])
class TaskViewSet(viewsets.ModelViewSet):

    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]
    filter_backends = [DjangoFilterBackend, drf_filters.SearchFilter, drf_filters.OrderingFilter]
    filterset_class = TaskFilter
    search_fields = ['title', 'description']
    ordering_fields = ['due_date', 'priority', 'created_at', 'title']
    ordering = ['-created_at']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Task.objects.none()
        return Task.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        task = serializer.save(owner=self.request.user)
        if task.priority == Task.Priority.HIGH:
            from .tasks import send_task_high_priority_alert
            send_task_high_priority_alert.delay(task.id)

    @extend_schema(
        summary="Get task analytics and statistics for the current user",
        responses={
            200: inline_serializer(
                name='TaskStatisticsResponse',
                fields={
                    'total': serializers.IntegerField(),
                    'by_status': inline_serializer(
                        name='TaskStatisticsByStatus',
                        fields={
                            'todo': serializers.IntegerField(),
                            'in_progress': serializers.IntegerField(),
                            'done': serializers.IntegerField(),
                        }
                    ),
                    'by_priority': inline_serializer(
                        name='TaskStatisticsByPriority',
                        fields={
                            'high': serializers.IntegerField(),
                            'medium': serializers.IntegerField(),
                            'low': serializers.IntegerField(),
                        }
                    ),
                    'overdue': serializers.IntegerField(),
                    'completion_rate_percentage': serializers.FloatField(),
                }
            )
        }
    )
    @action(detail=False, methods=['get'], url_path='statistics')
    def statistics(self, request):
        cache_key = f"taskflow:user:{request.user.id}:statistics"
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return Response(cached_data)

        now = timezone.now()
        stats = self.get_queryset().aggregate(
            total=Count('id'),
            todo=Count('id', filter=Q(status=Task.Status.TODO)),
            in_progress=Count('id', filter=Q(status=Task.Status.IN_PROGRESS)),
            done=Count('id', filter=Q(status=Task.Status.DONE)),
            high_priority=Count('id', filter=Q(priority=Task.Priority.HIGH)),
            medium_priority=Count('id', filter=Q(priority=Task.Priority.MEDIUM)),
            low_priority=Count('id', filter=Q(priority=Task.Priority.LOW)),
            overdue=Count('id', filter=Q(due_date__lt=now) & ~Q(status=Task.Status.DONE)),
        )

        total = stats['total'] or 0
        done = stats['done'] or 0
        completion_rate = round((done / total * 100), 1) if total > 0 else 0.0

        response_data = {
            'total': total,
            'by_status': {
                'todo': stats['todo'] or 0,
                'in_progress': stats['in_progress'] or 0,
                'done': done,
            },
            'by_priority': {
                'high': stats['high_priority'] or 0,
                'medium': stats['medium_priority'] or 0,
                'low': stats['low_priority'] or 0,
            },
            'overdue': stats['overdue'] or 0,
            'completion_rate_percentage': completion_rate,
        }

        cache_ttl = getattr(settings, 'TASK_STATISTICS_CACHE_TTL', 600)
        cache.set(cache_key, response_data, timeout=cache_ttl)

        return Response(response_data)
