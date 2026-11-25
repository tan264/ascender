# Generated manually for ask_ephemeral_hosts_on_launch (based on Ascender 25.6.3)

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('main', '0230_revoke_owner_rewritten_oauth2_tokens'),
    ]

    operations = [
        migrations.AddField(
            model_name='jobtemplate',
            name='ask_ephemeral_hosts_on_launch',
            field=models.BooleanField(
                blank=True,
                default=False,
                help_text=(
                    'If enabled, users can enter or import (CSV) a list of target hosts with per-host credentials '
                    'at launch time. Credentials are encrypted transiently in start_args and wiped once the job starts.'
                ),
            ),
        ),
    ]
