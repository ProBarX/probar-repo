from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.translation import gettext_lazy as _
from .models import User, Cliente, Termos, AceiteTermos, Evento, Bartender, Drink


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