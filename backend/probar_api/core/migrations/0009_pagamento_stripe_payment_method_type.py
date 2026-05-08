from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0008_alter_pagamento_metodo_pagamento_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="pagamento",
            name="stripe_payment_method_type",
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
    ]
