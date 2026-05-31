from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0019_merge_avaliacao_tags_reembolso'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='mensagem',
            options={
                'ordering': ['criado_em', 'id'],
                'verbose_name': 'Mensagem',
                'verbose_name_plural': 'Mensagens',
            },
        ),
    ]
