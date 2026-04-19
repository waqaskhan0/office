from django.contrib.auth.forms import AuthenticationForm


class EmailAuthenticationForm(AuthenticationForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["username"].label = "Email Address"
        self.fields["username"].widget.attrs.update(
            {
                "class": "portal-input",
                "placeholder": "Enter your email address",
                "autofocus": True,
            }
        )
        self.fields["password"].widget.attrs.update(
            {
                "class": "portal-input",
                "placeholder": "Enter your password",
            }
        )
