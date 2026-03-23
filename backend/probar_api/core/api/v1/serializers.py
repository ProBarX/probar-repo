from rest_framework import serializers
from core.models import User, Termos, AceiteTermos

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "password",
            "name",
            "role",
            "created_at"
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
            "content",
            "version",
            "role",
            "is_active",
            "created_at",
            "updated_at"
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
            "accepted_at"
        ]
        read_only_fields = ["termo", "user", "accepted_at"]

    def validate(self, data):
        user = self.context['request'].user

        try:
            termo = Termos.objects.get(id=data["termo_id"])
        except Termos.DoesNotExist:
            raise serializers.ValidationError("Termo não encontrado.")

        # valida perfil do termo com perfil do usuário
        if termo.role != user.role:
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
    