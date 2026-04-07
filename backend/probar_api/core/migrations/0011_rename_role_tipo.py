# Generated migration to rename 'role' field to 'tipo'

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0010_rename_termos_pt'),
    ]

    operations = [
        # User.role → User.tipo
        migrations.RenameField(
            model_name='user',
            old_name='role',
            new_name='tipo',
        ),
        # Termos.role → Termos.tipo
        migrations.RenameField(
            model_name='termos',
            old_name='role',
            new_name='tipo',
        ),
    ]
