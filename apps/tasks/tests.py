from datetime import timedelta
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from .models import Task
from .tasks import send_overdue_tasks_digest, send_task_high_priority_alert

User = get_user_model()


class TaskAPITest(APITestCase):

    def setUp(self):
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='Password123!'
        )
        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='Password123!'
        )

        self.list_url = reverse('task-list')
        self.client.force_authenticate(user=self.user1)

        self.task1 = Task.objects.create(
            title='User1 Task',
            description='First task for user1',
            status=Task.Status.TODO,
            priority=Task.Priority.HIGH,
            owner=self.user1
        )
        self.task2 = Task.objects.create(
            title='User2 Task',
            description='Task belonging to user2',
            status=Task.Status.TODO,
            priority=Task.Priority.HIGH,
            owner=self.user2
        )

    def test_create_task_authenticated(self):
        payload = {
            'title': 'New Task',
            'description': 'Description for new task',
            'status': 'TODO',
            'priority': 'MEDIUM',
        }
        response = self.client.post(self.list_url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], 'New Task')
        self.assertEqual(response.data['owner'], 'user1')
        self.assertEqual(Task.objects.filter(owner=self.user1).count(), 2)

    def test_create_task_unauthenticated(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(self.list_url, {'title': 'Unauthorized Task'})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_task_blank_title_fails(self):
        response = self.client.post(self.list_url, {'title': ''})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_tasks_only_returns_own_tasks(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results']
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['title'], 'User1 Task')

    def test_retrieve_own_tasks(self):
        detail_url = reverse('task-detail', kwargs={'pk': self.task1.id})
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'User1 Task')

    def test_retrieve_other_user_task_returns_404(self):
        detail_url = reverse('task-detail', kwargs={'pk': self.task2.id})
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_own_task(self):
        detail_url = reverse('task-detail', kwargs={'pk': self.task1.id})
        response = self.client.patch(detail_url, {'status': 'DONE'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.task1.refresh_from_db()
        self.assertEqual(self.task1.status, 'DONE')

    def test_delete_own_task(self):
        detail_url = reverse('task-detail', kwargs={'pk': self.task1.id})
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Task.objects.filter(id=self.task1.id).exists())


class TaskFilterAndSearchTests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username='filteruser',
            email='filter@example.com',
            password='Password123!'
        )
        self.client.force_authenticate(user=self.user)
        self.list_url = reverse('task-list')

        Task.objects.create(
            title='Buy groceries',
            description='Milk, bread',
            status=Task.Status.TODO,
            priority=Task.Priority.LOW,
            owner=self.user
        )
        Task.objects.create(
            title='Fix critical bug in auth',
            description='Fix JWT issue',
            status=Task.Status.IN_PROGRESS,
            priority=Task.Priority.HIGH,
            owner=self.user
        )
        Task.objects.create(
            title='Write documentation',
            description='Swagger and README',
            status=Task.Status.DONE,
            priority=Task.Priority.MEDIUM,
            owner=self.user
        )

    def test_filter_by_status(self):
        response = self.client.get(self.list_url, {'status': 'DONE'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['title'], 'Write documentation')

    def test_filter_by_priority(self):
        response = self.client.get(self.list_url, {'priority': 'HIGH'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['title'], 'Fix critical bug in auth')

    def test_search_by_keyword(self):
        response = self.client.get(self.list_url, {'search': 'JWT'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['title'], 'Fix critical bug in auth')

    def test_pagination_structure(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('count', response.data)
        self.assertIn('next', response.data)
        self.assertIn('previous', response.data)
        self.assertIn('results', response.data)
        self.assertEqual(response.data['count'], 3)


class TaskStatisticsTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='statsuser',
            email='stats@example.com',
            password='Password123!'
        )
        self.other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='Password123!'
        )
        self.stats_url = reverse('task-statistics')

        now = timezone.now()

        Task.objects.create(
            title='Task 1',
            status=Task.Status.TODO,
            priority=Task.Priority.HIGH,
            owner=self.user
        )

        Task.objects.create(
            title='Task 2',
            status=Task.Status.IN_PROGRESS,
            priority=Task.Priority.MEDIUM,
            due_date=now - timedelta(days=2),
            owner=self.user
        )

        Task.objects.create(
            title='Task 3',
            status=Task.Status.DONE,
            priority=Task.Priority.LOW,
            due_date=now - timedelta(days=5),
            owner=self.user
        )

        Task.objects.create(
            title='Other user task',
            status=Task.Status.DONE,
            owner=self.other_user
        )

    def test_statistics_authenticated(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.stats_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total'], 3)
        self.assertEqual(response.data['by_status']['todo'], 1)
        self.assertEqual(response.data['by_status']['in_progress'], 1)
        self.assertEqual(response.data['by_status']['done'], 1)
        self.assertEqual(response.data['by_priority']['high'], 1)
        self.assertEqual(response.data['by_priority']['medium'], 1)
        self.assertEqual(response.data['by_priority']['low'], 1)
        self.assertEqual(response.data['overdue'], 1)
        self.assertEqual(response.data['completion_rate_percentage'], 33.3)

    def test_statistics_unauthenticated(self):
        response = self.client.get(self.stats_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_statistics_empty_for_user_with_no_tasks(self):
        empty_user = User.objects.create_user(
            username='emptyuser',
            email='empty@example.com',
            password='Password123!'
        )
        self.client.force_authenticate(user=empty_user)
        response = self.client.get(self.stats_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total'], 0)
        self.assertEqual(response.data['by_status']['todo'], 0)
        self.assertEqual(response.data['by_status']['in_progress'], 0)
        self.assertEqual(response.data['by_status']['done'], 0)
        self.assertEqual(response.data['by_priority']['high'], 0)
        self.assertEqual(response.data['by_priority']['medium'], 0)
        self.assertEqual(response.data['by_priority']['low'], 0)
        self.assertEqual(response.data['overdue'], 0)
        self.assertEqual(response.data['completion_rate_percentage'], 0.0)

    def test_statistics_cached_and_invalidated_on_task_create(self):
        self.client.force_authenticate(user=self.user)
        cache_key = f"taskflow:user:{self.user.id}:statistics"

        # Initially cache is empty
        self.assertIsNone(cache.get(cache_key))

        # First request populates cache
        response = self.client.get(self.stats_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total'], 3)
        cached_data = cache.get(cache_key)
        self.assertIsNotNone(cached_data)
        self.assertEqual(cached_data['total'], 3)

        # Creating a task invalidates the cache via signal
        Task.objects.create(
            title='New Task for Cache Invalidation',
            status=Task.Status.TODO,
            owner=self.user
        )
        self.assertIsNone(cache.get(cache_key))

        # Next request recomputes stats with updated count
        response2 = self.client.get(self.stats_url)
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        self.assertEqual(response2.data['total'], 4)
        self.assertEqual(cache.get(cache_key)['total'], 4)

    def test_statistics_invalidated_on_task_update_and_delete(self):
        self.client.force_authenticate(user=self.user)
        cache_key = f"taskflow:user:{self.user.id}:statistics"

        # Populate cache
        self.client.get(self.stats_url)
        self.assertIsNotNone(cache.get(cache_key))

        # Updating a task invalidates cache
        task = Task.objects.filter(owner=self.user).first()
        task.status = Task.Status.DONE
        task.save()
        self.assertIsNone(cache.get(cache_key))

        # Re-populate cache
        self.client.get(self.stats_url)
        self.assertIsNotNone(cache.get(cache_key))

        # Deleting a task invalidates cache
        task.delete()
        self.assertIsNone(cache.get(cache_key))


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    CELERY_TASK_ALWAYS_EAGER=True,
)
class CeleryTasksTests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username='celeryuser',
            email='celeryuser@example.com',
            password='Password123!'
        )
        mail.outbox.clear()

    def test_send_task_high_priority_alert_success(self):
        task = Task.objects.create(
            title='Critical DB Migration',
            priority=Task.Priority.HIGH,
            owner=self.user,
        )
        result = send_task_high_priority_alert(task.id)
        self.assertEqual(result, f"Alert sent to {self.user.email}")
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('[TaskFlow Alert] High Priority Task: Critical DB Migration', mail.outbox[0].subject)
        self.assertIn('Critical DB Migration', mail.outbox[0].body)

    def test_send_task_high_priority_alert_not_found(self):
        result = send_task_high_priority_alert(99999)
        self.assertEqual(result, "Task #99999 not found")
        self.assertEqual(len(mail.outbox), 0)

    def test_send_task_high_priority_alert_no_email(self):
        user_no_email = User.objects.create_user(
            username='noemailuser',
            email='',
            password='Password123!'
        )
        task = Task.objects.create(
            title='Task without email',
            priority=Task.Priority.HIGH,
            owner=user_no_email,
        )
        result = send_task_high_priority_alert(task.id)
        self.assertEqual(result, f"No email for task #{task.id} owner")
        self.assertEqual(len(mail.outbox), 0)

    def test_send_overdue_tasks_digest(self):
        past_date = timezone.now() - timedelta(days=2)
        Task.objects.create(
            title='Overdue Task 1',
            status=Task.Status.TODO,
            priority=Task.Priority.HIGH,
            due_date=past_date,
            owner=self.user,
        )
        Task.objects.create(
            title='Completed Task',
            status=Task.Status.DONE,
            priority=Task.Priority.MEDIUM,
            due_date=past_date,
            owner=self.user,
        )

        summary = send_overdue_tasks_digest()
        self.assertEqual(summary['processed_users'], 1)
        self.assertEqual(summary['total_overdue'], 1)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Overdue Tasks Digest', mail.outbox[0].subject)
        self.assertIn('Overdue Task 1', mail.outbox[0].body)

    def test_create_high_priority_task_triggers_async_alert(self):
        self.client.force_authenticate(user=self.user)
        payload = {
            'title': 'High Priority Server Outage',
            'priority': 'HIGH',
            'status': 'TODO',
        }
        response = self.client.post(reverse('task-list'), payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('High Priority Server Outage', mail.outbox[0].subject)
