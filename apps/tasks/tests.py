from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from .models import Task

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
