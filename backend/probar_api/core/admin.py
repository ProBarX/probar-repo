from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.translation import gettext_lazy as _
from django.contrib import messages
from .models import (
    User,
    Cliente,
    Termos,
    AceiteTermos,
    Evento,
    Bartender,
    Drink,
    Pedido,
    Proposta,
    Chat,
    Mensagem,
    Avaliacao,
    Pagamento,
)


class SoftDeleteAdmin(admin.ModelAdmin):

    list_filter = ('esta_deletado',)  # filtro para mostrar itens deletados ou não

    def delete_model(self, request, obj):
        obj.delete()

    def delete_queryset(self, request, queryset):
        for obj in queryset:
            obj.delete()

    def get_queryset(self, request):
        qs = super().get_queryset(request)

        # mostra somente registros não deletados por padrão
        if not request.GET.get('esta_deletado'):
            return qs.filter(esta_deletado=False)

        return qs


class CustomUserAdmin(SoftDeleteAdmin, UserAdmin):
    model = User
    list_display = ('id', 'name', 'email', 'tipo', 'is_staff', 'is_active')
    list_filter = ('tipo', 'is_staff', 'is_active', 'esta_deletado')
    search_fields = ('email', 'first_name', 'last_name', 'name')
    ordering = ('id',)
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Personal info'), {'fields': ('name', 'first_name', 'last_name', 'tipo')}),
        (_('Permissions'), {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        (_('Important dates'), {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'name', 'first_name', 'last_name', 'password1', 'password2', 'tipo', 'is_staff', 'is_active'),
        }),
    )


admin.site.register(User, CustomUserAdmin)


@admin.register(Cliente)
class ClienteAdmin(SoftDeleteAdmin):
    list_display = (
        'user_id',
        'user',
        'data_nascimento'
    )

    search_fields = (
        'user__email',
    )


class DrinkInline(admin.TabularInline):
    model = Drink
    extra = 1


@admin.register(Bartender)
class BartenderAdmin(SoftDeleteAdmin):
    list_display = (
        'user_id',
        'user',
        'data_nascimento'
    )

    search_fields = (
        'user__email',
    )

    inlines = [DrinkInline]

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == 'user':
            kwargs['queryset'] = User.objects.filter(tipo='bartender')
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


@admin.register(Termos)
class TermosAdmin(SoftDeleteAdmin):
    list_display = ('id', 'versao', 'tipo', 'conteudo')
    search_fields = ('versao', 'tipo', 'conteudo')


@admin.register(AceiteTermos)
class AceiteTermosAdmin(SoftDeleteAdmin):
    list_display = ('id', 'termo', 'user', 'aceito_em')
    search_fields = ('termo__versao', 'user__email')


@admin.register(Evento)
class EventoAdmin(SoftDeleteAdmin):
    list_display = (
        'id',
        'nome',
        'cliente',
        'data',
        'hora_inicio',
        'status'
    )

    search_fields = (
        'nome',
        'descricao_evento',
        'cliente__user__email'
    )



@admin.register(Pedido)
class PedidoAdmin(SoftDeleteAdmin):
    list_display = ('id', 'cliente', 'bartender', 'evento', 'status', 'criado_em')
    search_fields = ('cliente__user__email', 'bartender__user__email', 'evento__nome')
    list_filter = ('status',)

    # mostrar propostas inline no admin do pedido para facilitar testes
    class PropostaInline(admin.TabularInline):
        model = Proposta
        extra = 0
        readonly_fields = ('remetente', 'tipo', 'horas', 'valor_adicional', 'desconto', 'status', 'criado_em')
        can_delete = False

    inlines = [PropostaInline]


@admin.register(Proposta)
class PropostaAdmin(SoftDeleteAdmin):
    list_display = ('id', 'pedido', 'remetente', 'tipo', 'horas', 'valor_adicional', 'desconto', 'status', 'criado_em')
    search_fields = ('pedido__id', 'remetente__email')
    list_filter = ('status', 'tipo')
    actions = ['accept_proposals', 'reject_proposals']

    def accept_proposals(self, request, queryset):
        accepted = 0
        for proposta in queryset:
            try:
                proposta.accept(request.user)
                accepted += 1
            except Exception as e:
                self.message_user(request, f"Erro ao aceitar Proposta #{proposta.pk}: {e}", level=messages.ERROR)
        self.message_user(request, f"{accepted} proposta(s) marcadas como aceitas.")

    accept_proposals.short_description = "Aceitar propostas selecionadas"

    def reject_proposals(self, request, queryset):
        rejected = 0
        for proposta in queryset:
            try:
                proposta.reject(request.user)
                rejected += 1
            except Exception as e:
                self.message_user(request, f"Erro ao recusar Proposta #{proposta.pk}: {e}", level=messages.ERROR)
        self.message_user(request, f"{rejected} proposta(s) recusadas.")

    reject_proposals.short_description = "Recusar propostas selecionadas"


@admin.register(Chat)
class ChatAdmin(SoftDeleteAdmin):
    list_display = ('id', 'pedido', 'criado_em')
    search_fields = ('pedido__id',)


@admin.register(Mensagem)
class MensagemAdmin(SoftDeleteAdmin):
    list_display = ('id', 'chat', 'remetente', 'tipo', 'criado_em')
    search_fields = ('chat__pedido__id', 'remetente__email', 'conteudo')
    list_filter = ('tipo',)


@admin.register(Avaliacao)
class AvaliacaoAdmin(SoftDeleteAdmin):
    list_display = ('id', 'pedido', 'nota', 'criado_em')
    search_fields = ('pedido__id', 'pedido__bartender__user__email')


@admin.register(Pagamento)
class PagamentoAdmin(SoftDeleteAdmin):
    list_display = ('id', 'pedido', 'valor', 'metodo_pagamento', 'status', 'data_pagamento')
    search_fields = ('pedido__id',)
    list_filter = ('metodo_pagamento', 'status')