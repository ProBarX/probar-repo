from rest_framework import serializers
from core.models import User, DocumentoLegal, AceiteDocumentoLegal, Cliente, Evento, Bartender, Drink
from core.models import Pedido, Proposta, Chat, Mensagem, Avaliacao, SolicitacaoReembolso
from core.enums import PropostaStatus, MensagemTipo
from django.utils.translation import gettext_lazy as _
from decimal import Decimal
from drf_spectacular.utils import extend_schema_field, OpenApiTypes
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
from core.enums import PropostaTipo, PropostaStatus, TipoUsuario, TipoDocumentoLegal
from decimal import Decimal


def get_client_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    return request.META.get("REMOTE_ADDR")


def documentos_obrigatorios_para_tipo(tipo_usuario):
    tipo_termos = (
        TipoDocumentoLegal.TERMOS_BARTENDER
        if tipo_usuario == TipoUsuario.BARTENDER
        else TipoDocumentoLegal.TERMOS_CLIENTE
    )

    return DocumentoLegal.objects.filter(
        esta_ativo=True,
        tipo__in=[tipo_termos, TipoDocumentoLegal.POLITICA_PRIVACIDADE],
    )


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    documentos_legais_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_empty=False,
    )

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "password",
            "name",
            "tipo",
            "criado_em",
            "documentos_legais_ids",
        ]

    def validate(self, data):
        documentos_ids = data.get("documentos_legais_ids")
        tipo = data.get("tipo", TipoUsuario.CLIENTE)

        if documentos_ids is None:
            if self.context.get("request"):
                raise serializers.ValidationError(
                    "É necessário aceitar os documentos legais vigentes para criar a conta."
                )
            return data

        obrigatorios = list(documentos_obrigatorios_para_tipo(tipo))
        obrigatorios_ids = {documento.id for documento in obrigatorios}

        if len(obrigatorios_ids) < 2:
            raise serializers.ValidationError(
                "Documentos legais obrigatórios não estão configurados."
            )

        documentos_informados = set(documentos_ids)
        faltantes = obrigatorios_ids - documentos_informados

        if faltantes:
            raise serializers.ValidationError(
                "É necessário aceitar os termos de uso aplicáveis e a política de privacidade vigentes."
            )

        documentos_validos = set(
            DocumentoLegal.objects.filter(id__in=documentos_informados, esta_ativo=True).values_list("id", flat=True)
        )

        if documentos_informados - documentos_validos:
            raise serializers.ValidationError("Documento legal inválido ou inativo.")

        data["documentos_legais"] = obrigatorios
        return data

    def create(self, validated_data):
        password = validated_data.pop("password")
        documentos_legais_ids = validated_data.pop("documentos_legais_ids", None)
        documentos_legais = validated_data.pop("documentos_legais", [])
        request = self.context.get("request")

        with transaction.atomic():
            user = User(**validated_data)
            user.set_password(password)
            user.save()

            if documentos_legais_ids is not None:
                for documento in documentos_legais:
                    AceiteDocumentoLegal.objects.create(
                        user=user,
                        documento=documento,
                        origem="cadastro",
                        ip=get_client_ip(request) if request else None,
                        user_agent=request.META.get("HTTP_USER_AGENT", "") if request else "",
                    )

        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()
        return instance
    

class DocumentoLegalSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentoLegal
        fields = [
            "id",
            "titulo",
            "conteudo",
            "versao",
            "tipo",
            "esta_ativo",
            "vigente_a_partir_de",
            "hash_conteudo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["hash_conteudo"]


class AceiteDocumentoLegalSerializer(serializers.ModelSerializer):
    documento_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = AceiteDocumentoLegal
        fields = [
            "id",
            "documento_id",
            "documento",
            "user",
            "aceito_em",
            "ip",
            "user_agent",
            "origem",
            "hash_conteudo_aceito",
        ]
        read_only_fields = [
            "documento",
            "user",
            "aceito_em",
            "ip",
            "user_agent",
            "origem",
            "hash_conteudo_aceito",
        ]

    def validate(self, data):
        user = self.context["request"].user

        try:
            documento = DocumentoLegal.objects.get(id=data["documento_id"], esta_ativo=True)
        except DocumentoLegal.DoesNotExist:
            raise serializers.ValidationError("Documento legal não encontrado ou inativo.")

        if documento.tipo == TipoDocumentoLegal.TERMOS_CLIENTE and user.tipo != TipoUsuario.CLIENTE:
            raise serializers.ValidationError("Termo inválido para este usuário.")

        if documento.tipo == TipoDocumentoLegal.TERMOS_BARTENDER and user.tipo != TipoUsuario.BARTENDER:
            raise serializers.ValidationError("Termo inválido para este usuário.")

        data["documento"] = documento
        return data

    def create(self, validated_data):
        request = self.context["request"]
        user = request.user
        documento = validated_data["documento"]

        if AceiteDocumentoLegal.objects.filter(user=user, documento=documento).exists():
            raise serializers.ValidationError("Documento legal já aceito por este usuário.")

        return AceiteDocumentoLegal.objects.create(
            user=user,
            documento=documento,
            origem="perfil",
            ip=get_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
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
    id = serializers.IntegerField(source="pk", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    nome = serializers.CharField(source="user.name")
    drinks = DrinkSerializer(many=True, read_only=True)
    media_avaliacoes = serializers.SerializerMethodField()
    total_avaliacoes = serializers.SerializerMethodField()

    class Meta:
        model = Bartender
        fields = [
            "id",
            "user_id",
            "email",
            "nome",
            "data_nascimento",
            "foto_perfil",
            "anos_experiencia",
            "descricao_profissional",
            "valor_hora",
            "especialidades",
            "media_avaliacoes",
            "total_avaliacoes",
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

    @extend_schema_field(OpenApiTypes.NUMBER)
    def get_media_avaliacoes(self, obj):
        if hasattr(obj, "media_avaliacoes_order"):
            return round(float(obj.media_avaliacoes_order or 0), 2)
        return obj.media_avaliacoes

    @extend_schema_field(OpenApiTypes.INT)
    def get_total_avaliacoes(self, obj):
        if hasattr(obj, "total_avaliacoes_order"):
            return int(obj.total_avaliacoes_order or 0)
        return obj.total_avaliacoes


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
    valor_hora = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    valor_total = serializers.SerializerMethodField(read_only=True)
    remetente = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Proposta
        fields = [
            'id', 'pedido', 'remetente', 'tipo', 'valor_hora', 'horas',
            'valor_adicional', 'desconto', 'status', 'criado_em', 'valor_total'
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

        if self.instance:
            for field in ('horas', 'valor_adicional', 'desconto'):
                if field in data and data[field] != getattr(self.instance, field):
                    raise serializers.ValidationError(
                        {field: 'Este campo nao pode ser alterado depois que a proposta foi criada.'}
                    )

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


class PresencaPedidoRequestSerializer(serializers.Serializer):
    observacao = serializers.CharField(required=False, allow_blank=True, max_length=1000)


class SolicitacaoReembolsoSerializer(serializers.ModelSerializer):
    cliente_nome = serializers.CharField(source='cliente.user.name', read_only=True)
    bartender_nome = serializers.CharField(source='bartender.user.name', read_only=True)
    pedido_numero_bartender = serializers.IntegerField(source='pedido.numero_bartender', read_only=True, allow_null=True)
    pagamento_status = serializers.SerializerMethodField()
    decidido_por_email = serializers.SerializerMethodField()

    class Meta:
        model = SolicitacaoReembolso
        fields = [
            'id', 'pedido', 'pedido_numero_bartender', 'pagamento',
            'pagamento_status', 'cliente', 'cliente_nome', 'bartender',
            'bartender_nome', 'tipo', 'motivo', 'status',
            'valor_solicitado', 'valor_aprovado', 'moeda',
            'observacao_cliente', 'resposta_bartender', 'respondido_em',
            'decisao_admin', 'decidido_por', 'decidido_por_email',
            'decidido_em', 'stripe_payment_intent_id', 'stripe_status',
            'stripe_idempotency_key', 'stripe_erro',
            'execucao_financeira_iniciada_em',
            'execucao_financeira_concluida_em',
            'criado_em', 'atualizado_em',
        ]
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.STR)
    def get_pagamento_status(self, obj):
        return obj.pagamento.status if obj.pagamento else None

    @extend_schema_field(OpenApiTypes.STR)
    def get_decidido_por_email(self, obj):
        return obj.decidido_por.email if obj.decidido_por else None


class ResponderSolicitacaoReembolsoRequestSerializer(serializers.Serializer):
    resposta = serializers.CharField(required=True, allow_blank=False, max_length=3000)


class DecidirSolicitacaoReembolsoRequestSerializer(serializers.Serializer):
    decisao_admin = serializers.CharField(required=True, allow_blank=False, max_length=3000)
    valor_aprovado = serializers.DecimalField(
        required=False,
        max_digits=12,
        decimal_places=2,
    )


class PedidoSerializer(serializers.ModelSerializer):
    numero_bartender = serializers.IntegerField(read_only=True, allow_null=True)
    propostas = PropostaSerializer(many=True, read_only=True)
    cliente = serializers.PrimaryKeyRelatedField(read_only=True)
    cliente_nome = serializers.CharField(source='cliente.user.name', read_only=True)
    bartender_nome = serializers.CharField(source='bartender.user.name', read_only=True)
    bartender_especialidade = serializers.CharField(source='bartender.especialidades', read_only=True)
    evento_nome = serializers.CharField(source='evento.nome', read_only=True)
    evento_data = serializers.DateField(source='evento.data', read_only=True)
    evento_hora_inicio = serializers.TimeField(source='evento.hora_inicio', read_only=True)
    evento_hora_fim = serializers.TimeField(source='evento.hora_fim', read_only=True)
    evento_cep = serializers.CharField(source='evento.cep', read_only=True)
    evento_rua = serializers.CharField(source='evento.rua', read_only=True)
    evento_numero = serializers.CharField(source='evento.numero', read_only=True)
    evento_complemento = serializers.CharField(source='evento.complemento', read_only=True)
    evento_quantidade_convidados = serializers.IntegerField(source='evento.quantidade_convidados', read_only=True)
    pagamento_id = serializers.SerializerMethodField()
    pagamento_status = serializers.SerializerMethodField()
    pagamento_valor = serializers.SerializerMethodField()
    pagamento_finalizado_pelo_cliente = serializers.SerializerMethodField()
    presenca_status = serializers.CharField(read_only=True)
    presenca_origem = serializers.CharField(read_only=True)
    presenca_registrada_em = serializers.DateTimeField(read_only=True)
    presenca_observacao = serializers.CharField(read_only=True)
    servico_inicio_previsto = serializers.SerializerMethodField()
    servico_fim_previsto = serializers.SerializerMethodField()
    liberacao_automatica_em = serializers.SerializerMethodField()
    tem_avaliacao = serializers.SerializerMethodField()

    class Meta:
        model = Pedido
        fields = [
            'id', 'numero_bartender', 'cliente', 'cliente_nome',
            'bartender', 'bartender_nome', 'bartender_especialidade',
            'evento', 'evento_nome', 'evento_data', 'evento_hora_inicio',
            'evento_hora_fim', 'evento_cep', 'evento_rua', 'evento_numero',
            'evento_complemento', 'evento_quantidade_convidados',
            'status', 'criado_em', 'propostas',
            'proposta_aprovada', 'valor_hora_aprovado', 'horas_aprovadas',
            'valor_total_aprovado', 'pagamento_id', 'pagamento_status',
            'pagamento_valor', 'pagamento_finalizado_pelo_cliente',
            'presenca_status', 'presenca_origem', 'presenca_registrada_em',
            'presenca_observacao', 'servico_inicio_previsto',
            'servico_fim_previsto', 'liberacao_automatica_em', 'tem_avaliacao',
        ]

    def _get_pagamento(self, obj):
        try:
            return obj.pagamento
        except ObjectDoesNotExist:
            return None

    @extend_schema_field(OpenApiTypes.INT)
    def get_pagamento_id(self, obj):
        pagamento = self._get_pagamento(obj)
        return pagamento.id if pagamento else None

    @extend_schema_field(OpenApiTypes.STR)
    def get_pagamento_status(self, obj):
        pagamento = self._get_pagamento(obj)
        return pagamento.status if pagamento else None

    @extend_schema_field(OpenApiTypes.NUMBER)
    def get_pagamento_valor(self, obj):
        pagamento = self._get_pagamento(obj)
        return str(pagamento.valor) if pagamento else None

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_pagamento_finalizado_pelo_cliente(self, obj):
        pagamento = self._get_pagamento(obj)
        return pagamento.finalizado_pelo_cliente if pagamento else False

    @extend_schema_field(OpenApiTypes.DATETIME)
    def get_servico_inicio_previsto(self, obj):
        return obj.servico_inicio_previsto

    @extend_schema_field(OpenApiTypes.DATETIME)
    def get_servico_fim_previsto(self, obj):
        return obj.servico_fim_previsto

    @extend_schema_field(OpenApiTypes.DATETIME)
    def get_liberacao_automatica_em(self, obj):
        return obj.liberacao_automatica_em

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_tem_avaliacao(self, obj):
        return hasattr(obj, 'avaliacao')


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
    tipo = serializers.ChoiceField(
        choices=[(MensagemTipo.TEXTO, 'Texto')],
        default=MensagemTipo.TEXTO,
    )
    conteudo = serializers.CharField(allow_blank=False, trim_whitespace=True)
    payload = serializers.JSONField(required=False, allow_null=True)

    class Meta:
        model = Mensagem
        fields = ['id', 'chat', 'remetente', 'tipo', 'conteudo', 'payload', 'criado_em']
        read_only_fields = ['id', 'remetente', 'criado_em']

    def validate(self, data):
        if data.get('payload') not in (None, {}):
            raise serializers.ValidationError(
                {'payload': 'Mensagens manuais nao podem enviar payload.'}
            )

        data['payload'] = None
        data['tipo'] = MensagemTipo.TEXTO
        return data


class ChatSerializer(serializers.ModelSerializer):
    mensagens = MensagemSerializer(many=True, read_only=True)
    cliente_nome = serializers.CharField(source='pedido.cliente.user.name', read_only=True)
    cliente_foto_perfil = serializers.ImageField(source='pedido.cliente.foto_perfil', read_only=True, allow_null=True)
    bartender_nome = serializers.CharField(source='pedido.bartender.user.name', read_only=True)
    bartender_foto_perfil = serializers.ImageField(source='pedido.bartender.foto_perfil', read_only=True, allow_null=True)
    bartender_especialidade = serializers.CharField(source='pedido.bartender.especialidades', read_only=True)
    evento_nome = serializers.CharField(source='pedido.evento.nome', read_only=True)
    evento_data = serializers.DateField(source='pedido.evento.data', read_only=True)
    evento_hora_inicio = serializers.TimeField(source='pedido.evento.hora_inicio', read_only=True)
    evento_hora_fim = serializers.TimeField(source='pedido.evento.hora_fim', read_only=True)
    evento_cep = serializers.CharField(source='pedido.evento.cep', read_only=True)
    evento_rua = serializers.CharField(source='pedido.evento.rua', read_only=True)
    evento_numero = serializers.CharField(source='pedido.evento.numero', read_only=True)
    evento_complemento = serializers.CharField(source='pedido.evento.complemento', read_only=True)
    evento_quantidade_convidados = serializers.IntegerField(source='pedido.evento.quantidade_convidados', read_only=True)
    evento_descricao = serializers.CharField(source='pedido.evento.descricao_evento', read_only=True)
    pedido_resumo = serializers.SerializerMethodField()

    class Meta:
        model = Chat
        fields = [
            'id', 'pedido', 'cliente_nome', 'cliente_foto_perfil',
            'bartender_nome', 'bartender_foto_perfil', 'bartender_especialidade',
            'evento_nome', 'evento_data', 'evento_hora_inicio', 'evento_hora_fim',
            'evento_cep', 'evento_rua', 'evento_numero', 'evento_complemento',
            'evento_quantidade_convidados', 'evento_descricao',
            'pedido_resumo', 'mensagens', 'criado_em',
        ]

    def _get_pagamento(self, pedido):
        try:
            return pedido.pagamento
        except ObjectDoesNotExist:
            return None

    def _get_solicitacao_reembolso(self, pedido):
        solicitacoes = getattr(pedido, 'solicitacoes_reembolso_ordenadas', None)
        if solicitacoes is not None:
            return solicitacoes[0] if solicitacoes else None

        return pedido.solicitacoes_reembolso.order_by('-criado_em').first()

    def _format_datetime(self, value):
        return value.isoformat() if value else None

    def get_pedido_resumo(self, obj):
        pedido = obj.pedido
        pagamento = self._get_pagamento(pedido)
        solicitacao = self._get_solicitacao_reembolso(pedido)

        return {
            'pedido_id': pedido.id,
            'numero_bartender': pedido.numero_bartender,
            'pedido_status': pedido.status,
            'pagamento_status': pagamento.status if pagamento else None,
            'pagamento_finalizado_pelo_cliente': pagamento.finalizado_pelo_cliente if pagamento else False,
            'presenca_status': pedido.presenca_status,
            'presenca_origem': pedido.presenca_origem,
            'servico_fim_previsto': self._format_datetime(pedido.servico_fim_previsto),
            'liberacao_automatica_em': self._format_datetime(pedido.liberacao_automatica_em),
            'solicitacao_reembolso_status': solicitacao.status if solicitacao else None,
            'solicitacao_reembolso_tipo': solicitacao.tipo if solicitacao else None,
        }


class AvaliacaoSerializer(serializers.ModelSerializer):
    cliente_nome = serializers.CharField(source='pedido.cliente.user.name', read_only=True)
    evento_nome = serializers.CharField(source='pedido.evento.nome', read_only=True)
    bartender_nome = serializers.CharField(source='pedido.bartender.user.name', read_only=True)
    pedido_id = serializers.IntegerField(source='pedido.id', read_only=True)
    pedido_numero_bartender = serializers.IntegerField(source='pedido.numero_bartender', read_only=True, allow_null=True)
    pedido = serializers.PrimaryKeyRelatedField(queryset=Pedido.objects.all(), write_only=True)
    tags = serializers.ListField(child=serializers.CharField(max_length=50), required=False, default=list)

    class Meta:
        model = Avaliacao
        fields = [
            'id', 'pedido', 'pedido_id', 'pedido_numero_bartender',
            'nota', 'comentario', 'tags',
            'cliente_nome', 'evento_nome', 'bartender_nome', 'criado_em',
        ]
        read_only_fields = ['id', 'criado_em']
