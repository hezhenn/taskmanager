from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions
from rest_framework_simplejwt.views import (
    TokenObtainPairView as BaseTokenObtainPairView,
    TokenRefreshView as BaseTokenRefreshView,
)
from .serializers import UserProfileSerializer, UserRegisterSerializer
from .throttles import DynamicScopedRateThrottle


@extend_schema(tags=['auth'], summary='Register a new user')
class RegisterView(generics.CreateAPIView):

    permission_classes = [permissions.AllowAny]
    serializer_class = UserRegisterSerializer
    throttle_classes = [DynamicScopedRateThrottle]
    throttle_scope = 'register'


@extend_schema(tags=['auth'], summary='Obtain JWT access and refresh tokens')
class ThrottledTokenObtainPairView(BaseTokenObtainPairView):

    throttle_classes = [DynamicScopedRateThrottle]
    throttle_scope = 'auth'


@extend_schema(tags=['auth'], summary='Refresh expired JWT access token')
class ThrottledTokenRefreshView(BaseTokenRefreshView):

    throttle_classes = [DynamicScopedRateThrottle]
    throttle_scope = 'auth'


@extend_schema(tags=['auth'], summary='Get or update current user profile')
class UserProfileView(generics.RetrieveUpdateAPIView):

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserProfileSerializer

    def get_object(self):
        return self.request.user
