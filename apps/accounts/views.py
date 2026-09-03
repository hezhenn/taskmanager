from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, viewsets
from .serializers import UserProfileSerializer, UserRegisterSerializer


@extend_schema(tags=['auth'], summary='Register a news user')
class RegisterView(generics.CreateAPIView):

    permission_classes = [permissions.AllowAny]
    serializer_class = UserRegisterSerializer

@extend_schema(tags=['auth'], summary='Get or update current user profile')
class UserProfileView(generics.RetrieveUpdateAPIView):

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserProfileSerializer

    def get_object(self):
        return self.request.user