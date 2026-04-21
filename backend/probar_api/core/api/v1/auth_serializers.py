from rest_framework import serializers


class GoogleAuthSerializer(serializers.Serializer):
    id_token = serializers.CharField()
    tipo_usuario = serializers.ChoiceField(choices=(('cliente', 'cliente'), ('bartender', 'bartender')), required=False, allow_null=True)


class GoogleVerifySerializer(serializers.Serializer):
    id_token = serializers.CharField()
