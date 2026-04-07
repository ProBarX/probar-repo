from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0009_rename_fields_pt'),
    ]

    operations = [
        # Termos
        migrations.RenameField(
            model_name='termos',
            old_name='content',
            new_name='conteudo',
        ),
        migrations.RenameField(
            model_name='termos',
            old_name='version',
            new_name='versao',
        ),
        # AceiteTermos
        migrations.RenameField(
            model_name='aceitetermos',
            old_name='accepted_at',
            new_name='aceito_em',
        ),
    ]
