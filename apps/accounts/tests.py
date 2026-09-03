from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class UserRegistrationTest(APITestCase):

    def setUp(self):
        self.register_url = reverse('register')
        self.valid_payload = {
            'username': 'testuser',
            'email': 'testuser@example.com',
            'password': 'StrongPassword123!',
            'password_confirm': 'StrongPassword123!',
        }

    def test_register_user_success(self):

        response = self.client.post(self.register_url, data=self.valid_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.count(), 1)
        user = User.objects.get(username='testuser')
        self.assertEqual(user.email, 'testuser@example.com')
        self.assertTrue(user.check_password('StrongPassword123!'))

    def test_register_passwords_mismatch(self):

        payload = self.valid_payload.copy()
        payload['password_confirm'] = 'DifferentPassword123!'
        response = self.client.post(self.register_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password_confirm', response.data)

    def test_register_duplicate_username(self):

        User.objects.create_user(
            username='testuser',
            email='other@example.com',
            password='StrongPassword123!'
        )
        response = self.client.post(self.register_url, self.valid_payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_duplicate_email(self):

        User.objects.create_user(
            username='existinguser',
            email='testuser@example.com',
            password='StrongPassword123!'
        )
        response = self.client.post(self.register_url, self.valid_payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

class UserAuthenticationTests(APITestCase):

    def setUp(self):
        self.token_url = reverse('token_obtain_pair')
        self.refresh_url = reverse('token_refresh')
        self.user = User.objects.create_user(
            username='authuser',
            email='authuser@example.com',
            password='StrongPassword123!'
        )

    def test_obtain_token_success(self):

        payload = {
            'username': 'authuser',
            'password': 'StrongPassword123!',
        }
        response = self.client.post(self.token_url, payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_obtain_token_invalid_credentials(self):

        payload = {
            'username': 'authuser',
            'password': 'WrongPassword',
        }
        response = self.client.post(self.token_url, payload)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_token(self):

        login_response = self.client.post(self.token_url, {
            'username': 'authuser',
            'password': 'StrongPassword123!'
        })
        refresh_token = login_response.data['refresh']

        response = self.client.post(self.refresh_url, {'refresh': refresh_token})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

class UserProfileTests(APITestCase):

    def setUp(self):
        self.profile_url = reverse('user_profile')
        self.user = User.objects.create_user(
            username='profileuser',
            email='profile@example.com',
            password='StrongPassword123!'
        )

    def test_user_profile_unauthenticated(self):

        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_profile_authenticated(self):

        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'profileuser')
        self.assertEqual(response.data['email'], 'profile@example.com')

    def test_update_profile(self):

        self.client.force_authenticate(user=self.user)
        update_payload = {'first_name': 'NewName'}
        response = self.client.patch(self.profile_url, update_payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['first_name'], 'NewName')
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'NewName')