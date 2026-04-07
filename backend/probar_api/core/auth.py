from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class CustomTokenSerializer(TokenObtainPairSerializer):
    username_field = "email"
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['tipo'] = user.tipo
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['tipo'] = self.user.tipo
        return data