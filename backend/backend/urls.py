"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from api.views import *
from api.metrics import metrics_view
from django.conf.urls.static import static
from django.conf import settings

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/login/', custom_login, name='custom_login'),
    path('api/login/verify-2fa/', verify_2fa_login, name='verify_2fa_login'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/register/', RegisterView, name='register'),
    path('api/me/', get_user_profile, name='get_user_profile'),
    path('api/update_profile/', update_profile, name='update_profile'),    
    path('api/2fa/enable/', enable_2fa, name='enable_2fa'),
    path('api/2fa/activate/', activate_2fa, name='activate_2fa'),
    path('api/2fa/disable/', disable_2fa, name='disable_2fa'),
    path('api/friends/', get_friends_list, name='get_friends_list'),
    path('api/friends/requests/', get_friend_requests, name='get_friend_requests'),
    path('api/friends/request/send/<str:username>/', send_friend_request, name='send_friend_request'),
    path('api/friends/request/respond/<str:username>/', respond_friend_request, name='respond_friend_request'),
    path('api/friends/remove/<str:username>/', remove_friend, name='remove_friend'),
    path('api/tournaments/', tournaments, name='tournaments'),
    path('api/tournaments/<int:tid>/', tournament_detail, name='tournament_detail'),
    path('api/tournaments/<int:tid>/join/', join_tournament, name='join_tournament'),
    path('api/tournaments/<int:tid>/leave/', leave_tournament, name='leave_tournament'),
    path('api/tournaments/<int:tid>/start/', start_tournament, name='start_tournament'),
    path('api/tournaments/<int:tid>/my-match/', my_tournament_match, name='my_tournament_match'),
    # Bonus: endpoint de health pour la correction
    path('health/', health, name='health'),
    # Bonus: endpoint de status (DB + last_backup)
    path('status/', status_view, name='status'),
    path('metrics/', metrics_view, name='metrics'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)