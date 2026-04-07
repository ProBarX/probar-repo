from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0008_alter_bartender_especialidades'),
    ]

    operations = [
        # User
        migrations.RenameField(
            model_name='user',
            old_name='created_at',
            new_name='criado_em',
        ),
        migrations.RenameField(
            model_name='user',
            old_name='updated_at',
            new_name='atualizado_em',
        ),
        migrations.RenameField(
            model_name='user',
            old_name='is_deleted',
            new_name='esta_deletado',
        ),
        migrations.RenameField(
            model_name='user',
            old_name='deleted_at',
            new_name='deletado_em',
        ),
        # Cliente
        migrations.RenameField(
            model_name='cliente',
            old_name='created_at',
            new_name='criado_em',
        ),
        migrations.RenameField(
            model_name='cliente',
            old_name='updated_at',
            new_name='atualizado_em',
        ),
        migrations.RenameField(
            model_name='cliente',
            old_name='is_deleted',
            new_name='esta_deletado',
        ),
        migrations.RenameField(
            model_name='cliente',
            old_name='deleted_at',
            new_name='deletado_em',
        ),
        # Bartender
        migrations.RenameField(
            model_name='bartender',
            old_name='created_at',
            new_name='criado_em',
        ),
        migrations.RenameField(
            model_name='bartender',
            old_name='updated_at',
            new_name='atualizado_em',
        ),
        migrations.RenameField(
            model_name='bartender',
            old_name='is_deleted',
            new_name='esta_deletado',
        ),
        migrations.RenameField(
            model_name='bartender',
            old_name='deleted_at',
            new_name='deletado_em',
        ),
        # Termos
        migrations.RenameField(
            model_name='termos',
            old_name='created_at',
            new_name='criado_em',
        ),
        migrations.RenameField(
            model_name='termos',
            old_name='updated_at',
            new_name='atualizado_em',
        ),
        migrations.RenameField(
            model_name='termos',
            old_name='is_deleted',
            new_name='esta_deletado',
        ),
        migrations.RenameField(
            model_name='termos',
            old_name='deleted_at',
            new_name='deletado_em',
        ),
        # Aceitetermos
        migrations.RenameField(
            model_name='aceitetermos',
            old_name='created_at',
            new_name='criado_em',
        ),
        migrations.RenameField(
            model_name='aceitetermos',
            old_name='updated_at',
            new_name='atualizado_em',
        ),
        migrations.RenameField(
            model_name='aceitetermos',
            old_name='is_deleted',
            new_name='esta_deletado',
        ),
        migrations.RenameField(
            model_name='aceitetermos',
            old_name='deleted_at',
            new_name='deletado_em',
        ),
        # Evento
        migrations.RenameField(
            model_name='evento',
            old_name='created_at',
            new_name='criado_em',
        ),
        migrations.RenameField(
            model_name='evento',
            old_name='updated_at',
            new_name='atualizado_em',
        ),
        migrations.RenameField(
            model_name='evento',
            old_name='is_deleted',
            new_name='esta_deletado',
        ),
        migrations.RenameField(
            model_name='evento',
            old_name='deleted_at',
            new_name='deletado_em',
        ),
    ]
