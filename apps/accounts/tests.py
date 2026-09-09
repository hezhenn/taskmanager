from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import override_settings
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


class AuthThrottlingTests(APITestCase):

    def test_token_obtain_rate_limit(self):
        User.objects.create_user(
            username='auththrottle',
            email='auththrottle@example.com',
            password='Password123!'
        )
        url = reverse('token_obtain_pair')
        payload = {
            'username': 'auththrottle',
            'password': 'Password123!'
        }

        throttle_rates = {
            **settings.REST_FRAMEWORK.get('DEFAULT_THROTTLE_RATES', {}),
            'auth': '2/minute',
        }
        with override_settings(REST_FRAMEWORK={**settings.REST_FRAMEWORK, 'DEFAULT_THROTTLE_RATES': throttle_rates}):
            res1 = self.client.post(url, payload)
            self.assertEqual(res1.status_code, status.HTTP_200_OK)

            res2 = self.client.post(url, payload)
            self.assertEqual(res2.status_code, status.HTTP_200_OK)

            res3 = self.client.post(url, payload)
            self.assertEqual(res3.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
            self.assertIn('throttled', str(res3.data['detail']).lower())

    def test_register_rate_limit(self):
        url = reverse('register')
        throttle_rates = {
            **settings.REST_FRAMEWORK.get('DEFAULT_THROTTLE_RATES', {}),
            'register': '2/minute',
        }
        with override_settings(REST_FRAMEWORK={**settings.REST_FRAMEWORK, 'DEFAULT_THROTTLE_RATES': throttle_rates}):
            payload1 = {
                'username': 'throttleuser1',
                'email': 'throttle1@example.com',
                'password': 'Password123!',
                'password_confirm': 'Password123!',
            }
            res1 = self.client.post(url, payload1)
            self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

            payload2 = {
                'username': 'throttleuser2',
                'email': 'throttle2@example.com',
                'password': 'Password123!',
                'password_confirm': 'Password123!',
            }
            res2 = self.client.post(url, payload2)
            self.assertEqual(res2.status_code, status.HTTP_201_CREATED)

            payload3 = {
                'username': 'throttleuser3',
                'email': 'throttle3@example.com',
                'password': 'Password123!',
                'password_confirm': 'Password123!',
            }
            res3 = self.client.post(url, payload3)
            self.assertEqual(res3.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
            self.assertIn('throttled', str(res3.data['detail']).lower())

    def test_throttle_proxy_ip_resolution_x_real_ip(self):
        from django.test import RequestFactory
        from apps.accounts.throttles import DynamicScopedRateThrottle

        rf = RequestFactory()
        throttle = DynamicScopedRateThrottle()
        request = rf.get('/api/v1/auth/token/', HTTP_X_REAL_IP='198.51.100.25')
        self.assertEqual(throttle.get_ident(request), '198.51.100.25')

    def test_throttle_proxy_ip_resolution_x_forwarded_for(self):
        from django.test import RequestFactory
        from apps.accounts.throttles import DynamicScopedRateThrottle

        rf = RequestFactory()
        throttle = DynamicScopedRateThrottle()
        request = rf.get(
            '/api/v1/auth/token/',
            HTTP_X_FORWARDED_FOR='198.51.100.77, 172.18.0.2'
        )
        self.assertEqual(throttle.get_ident(request), '198.51.100.77')
