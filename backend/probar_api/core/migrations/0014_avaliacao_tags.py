from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0013_alter_aceitetermos_unique_together_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='avaliacao',
            name='tags',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
