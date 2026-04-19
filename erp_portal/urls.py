from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import include, path

from inventory.auth_forms import EmailAuthenticationForm


urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('inventory.urls')),
    path(
        'login/',
        auth_views.LoginView.as_view(
            template_name='registration/login.html',
            authentication_form=EmailAuthenticationForm,
        ),
        name='login',
    ),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),
]
