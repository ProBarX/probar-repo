from rest_framework import serializers
from core.models import User, Termos, AceiteTermos, Cliente, Evento, Bartender, Drink



class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "password",
            "name",
            "tipo",
            "criado_em"
        ]

    def create(self, validated_data):
        password = validated_data.pop("password")

        user = User(**validated_data)
        user.set_password(password)
        user.save()

        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()
        return instance
    

class TermosSerializer(serializers.ModelSerializer):
    class Meta:
        model = Termos
        fields = [
            "id",
            "conteudo",
            "versao",
            "tipo",
            "esta_ativo",
            "criado_em",
            "atualizado_em"
        ]
    

class AceiteTermosSerializer(serializers.ModelSerializer):
    termo_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = AceiteTermos
        fields = [
            "id",
            "termo_id",
            "termo",
            "user",
            "aceito_em"
        ]
        read_only_fields = ["termo", "user", "aceito_em"]

    def validate(self, data):
        user = self.context['request'].user

        try:
            termo = Termos.objects.get(id=data["termo_id"])
        except Termos.DoesNotExist:
            raise serializers.ValidationError("Termo não encontrado.")

        # valida perfil do termo com perfil do usuário
        if termo.tipo != user.tipo:
            raise serializers.ValidationError("Termo inválido para este usuário.")

        # salva para usar no create
        data["termo"] = termo
        return data
    
    def create(self, validated_data):
        """Garante que o usuário não aceite o mesmo termo mais de uma vez"""
        user = self.context['request'].user
        termo = validated_data["termo"]

        # garante que o usuário não aceite o mesmo termo mais de uma vez
        if AceiteTermos.objects.filter(user=user, termo=termo).exists():
            raise serializers.ValidationError("Termo já aceito por este usuário.")

        return AceiteTermos.objects.create(
            user=user,
            termo=termo
        )


class ClienteSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    name = serializers.CharField(source="user.name")

    class Meta:
        model = Cliente
        fields = [
            "email",
            "name",
            "data_nascimento",
            "foto_perfil",
            "criado_em",
        ]

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})

        # atualiza cliente
        instance = super().update(instance, validated_data)

        # atualiza user
        if "name" in user_data:
            instance.user.name = user_data["name"]
            instance.user.save()

        return instance
    

class DrinkSerializer(serializers.ModelSerializer):
    def validate(self, data):
        request = self.context.get('request')
        bartender = Bartender.objects.get(user=request.user)

        if bartender.drinks.count() >= 6:
            raise serializers.ValidationError(
                "Você já possui 6 drinks."
            )

        return data

    class Meta:
        model = Drink
        fields = [
            "id",
            "nome",
            "foto",
            "criado_em"
        ]


class BartenderSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    nome = serializers.CharField(source="user.name")
    drinks = DrinkSerializer(many=True, read_only=True)

    class Meta:
        model = Bartender
        fields = [
            "email",
            "nome",
            "data_nascimento",
            "foto_perfil",
            "anos_experiencia",
            "descricao_profissional",
            "valor_hora",
            "especialidades",
            "drinks",
            "cep",
            "rua",
            "bairro",
            "numero",
            "criado_em",
        ]

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})

        # atualiza bartender
        instance = super().update(instance, validated_data)

        # atualiza user
        if "name" in user_data:
            instance.user.name = user_data["name"]
            instance.user.save()

        return instance


class EventoSerializer(serializers.ModelSerializer):
    cliente_nome = serializers.CharField(source='cliente.nome', read_only=True)

    class Meta:
        model = Evento
        fields = [
            'id',
            'cliente',
            'cliente_nome',
            'nome',
            'data',
            'hora_inicio',
            'hora_fim',
            'cep',
            'rua',
            'numero',
            'complemento',
            'quantidade_convidados',
            'descricao_evento',
            'status',
        ]