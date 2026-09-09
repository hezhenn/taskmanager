from django.urls import path
from .views import (
    RegisterView,
    ThrottledTokenObtainPairView,
    ThrottledTokenRefreshView,
    UserProfileView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('token/', ThrottledTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', ThrottledTokenRefreshView.as_view(), name='token_refresh'),
    path('me/', UserProfileView.as_view(), name='user_profile'),
]
