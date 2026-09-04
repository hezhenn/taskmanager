from django_filters import rest_framework as filters
from .models import Task

class TaskFilter(filters.FilterSet):

    status = filters.ChoiceFilter(choices=Task.Status.choices)
    priority = filters.ChoiceFilter(choices=Task.Priority.choices)
    due_date_after = filters.DateFilter(field_name='due_date', lookup_expr='gte')
    due_date_before = filters.DateFilter(field_name='due_date', lookup_expr='lte')

    class Meta:
        model = Task
        fields = ('status', 'priority', 'due_date_after', 'due_date_before')