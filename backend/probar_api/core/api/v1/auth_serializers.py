from rest_framework import serializers


class GoogleAuthSerializer(serializers.Serializer):
    id_token = serializers.CharField()
    tipo_usuario = serializers.ChoiceField(choices=(('cliente', 'cliente'), ('bartender', 'bartender')), required=False, allow_null=True)
    documentos_legais_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=False,
    )


class GoogleVerifySerializer(serializers.Serializer):
    id_token = serializers.CharField()
