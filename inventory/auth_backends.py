from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend


class EmailOrUsernameBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        user_model = get_user_model()
        login_value = username or kwargs.get(user_model.USERNAME_FIELD)
        if not login_value or not password:
            return None

        try:
            if "@" in login_value:
                user = user_model.objects.get(email__iexact=login_value)
            else:
                user = user_model.objects.get(username__iexact=login_value)
        except user_model.DoesNotExist:
            return None
        except user_model.MultipleObjectsReturned:
            user = user_model.objects.filter(email__iexact=login_value).order_by("id").first()
            if user is None:
                return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
