from rest_framework import serializers
from core.models import User, Termos, AceiteTermos, Cliente, Evento, Bartender, Drink
from core.models import Pedido, Proposta, Chat, Mensagem
from core.enums import PropostaStatus
from django.utils.translation import gettext_lazy as _
from decimal import Decimal
from drf_spectacular.utils import extend_schema_field, OpenApiTypes
from django.db import transaction
from core.enums import PropostaTipo, PropostaStatus, TipoUsuario
from decimal import Decimal



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
    # user_id é a PK do Bartender (OneToOneField com primary_key=True)
    # expor explicitamente para o frontend poder usar no POST /pedidos/
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    drinks = DrinkSerializer(many=True, read_only=True)

    class Meta:
        model = Bartender
        fields = [
            "user_id",
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
        read_only_fields = ['cliente']


class PropostaSerializer(serializers.ModelSerializer):
    valor_total = serializers.SerializerMethodField(read_only=True)
    remetente = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Proposta
        fields = [
            'id', 'pedido', 'remetente', 'tipo', 'horas', 'valor_adicional', 'desconto', 'status', 'criado_em', 'valor_total'
        ]

    @extend_schema_field(OpenApiTypes.NUMBER)
    def get_valor_total(self, obj):
        return obj.valor_total

    def validate(self, data):
        request = self.context.get('request')
        pedido = data.get('pedido')

        # primeira proposta deve ser do cliente
        if pedido and pedido.propostas.count() == 0:
            if request.user != pedido.cliente.user:
                raise serializers.ValidationError(_('A primeira proposta deve ser enviada pelo cliente.'))

        # Normalizar tipos para evitar mix Decimal/float/str
        from decimal import Decimal

        if 'valor_adicional' in data and data['valor_adicional'] is not None:
            data['valor_adicional'] = Decimal(str(data['valor_adicional']))

        if 'desconto' in data and data['desconto'] is not None:
            data['desconto'] = Decimal(str(data['desconto']))

        if 'horas' in data and data['horas'] is not None:
            # garantir inteiro
            try:
                data['horas'] = int(data['horas'])
            except (TypeError, ValueError):
                raise serializers.ValidationError({'horas': 'Valor inválido para horas.'})

        return data

    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['remetente'] = request.user
        return super().create(validated_data)


class CounterPropostaRequestSerializer(serializers.Serializer):
    horas = serializers.IntegerField(required=False)
    valor_adicional = serializers.DecimalField(required=False, max_digits=12, decimal_places=2)
    desconto = serializers.DecimalField(required=False, max_digits=12, decimal_places=2)

    def validate(self, data):
        # Normalizar tipos: aceitar strings/floats e converter para Decimal
        from decimal import Decimal

        if 'valor_adicional' in data and data['valor_adicional'] is not None:
            data['valor_adicional'] = Decimal(str(data['valor_adicional']))

        if 'desconto' in data and data['desconto'] is not None:
            data['desconto'] = Decimal(str(data['desconto']))

        # Regras de combinação: não permitir adicional e desconto ao mesmo tempo
        valor_ad = data.get('valor_adicional')
        desc = data.get('desconto')
        horas = data.get('horas')

        if valor_ad is not None and desc is not None and valor_ad > 0 and desc > 0:
            raise serializers.ValidationError('Não é permitido enviar valor_adicional e desconto simultaneamente.')

        # Para propostas de adicional ou desconto, horas devem ser informadas
        if (valor_ad is not None and valor_ad > 0) or (desc is not None and desc > 0):
            if horas is None:
                raise serializers.ValidationError('Campo "horas" é obrigatório quando for enviar valor_adicional ou desconto.')

        return data


class AcceptPropostaRequestSerializer(serializers.Serializer):
    # corpo vazio previsto para compatibilidade com OpenAPI
    pass


class PedidoSerializer(serializers.ModelSerializer):
    propostas = PropostaSerializer(many=True, read_only=True)
    cliente = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Pedido
        fields = ['id', 'cliente', 'bartender', 'evento', 'status', 'criado_em', 'propostas']


class PedidoCreateSerializer(serializers.Serializer):
    bartender = serializers.IntegerField()
    evento = serializers.IntegerField()
    horas = serializers.IntegerField(min_value=1)
    valor_adicional = serializers.DecimalField(required=False, max_digits=12, decimal_places=2, default=Decimal('0.00'))
    desconto = serializers.DecimalField(required=False, max_digits=12, decimal_places=2, default=Decimal('0.00'))

    def validate(self, data):
        user = self.context['request'].user
        if user.tipo != TipoUsuario.CLIENTE:
            raise serializers.ValidationError("Apenas clientes podem criar pedidos.")

        # valida bartender
        try:
            from core.models import Bartender, Evento
            bartender = Bartender.objects.get(pk=data['bartender'])
        except Bartender.DoesNotExist:
            raise serializers.ValidationError({"bartender": "Bartender não encontrado."})

        # valida evento pertence ao cliente
        try:
            evento = Evento.objects.get(pk=data['evento'])
        except Evento.DoesNotExist:
            raise serializers.ValidationError({"evento": "Evento não encontrado."})

        if evento.cliente.user != user:
            raise serializers.ValidationError({"evento": "Evento não pertence ao cliente autenticado."})

        return data

    def create(self, validated_data):
        from core.models import Cliente, Bartender, Evento, Pedido, Proposta, Chat
        request = self.context['request']

        cliente = Cliente.objects.get(user=request.user)
        bartender = Bartender.objects.get(pk=validated_data['bartender'])
        evento = Evento.objects.get(pk=validated_data['evento'])

        horas = validated_data['horas']
        valor_adicional = validated_data.get('valor_adicional', Decimal('0.00'))
        desconto = validated_data.get('desconto', Decimal('0.00'))

        with transaction.atomic():
            pedido = Pedido.objects.create(
                cliente=cliente,
                bartender=bartender,
                evento=evento,
            )

            proposta = Proposta.objects.create(
                pedido=pedido,
                remetente=request.user,
                tipo=PropostaTipo.INICIAL,
                horas=horas,
                valor_adicional=valor_adicional,
                desconto=desconto,
                status=PropostaStatus.PENDENTE,
            )

            # cria chat e as mensagens iniciais da negociação
            pedido.create_initial_chat_messages(proposta)
            return pedido


class MensagemSerializer(serializers.ModelSerializer):
    remetente = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Mensagem
        fields = ['id', 'chat', 'remetente', 'tipo', 'conteudo', 'payload', 'criado_em']


class ChatSerializer(serializers.ModelSerializer):
    mensagens = MensagemSerializer(many=True, read_only=True)

    class Meta:
        model = Chat
        fields = ['id', 'pedido', 'mensagens', 'criado_em']