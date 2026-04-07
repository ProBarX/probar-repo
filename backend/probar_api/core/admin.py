from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.translation import gettext_lazy as _
from .models import User, Cliente, Termos, AceiteTermos, Evento, Bartender

class CustomUserAdmin(UserAdmin):
	model = User
	list_display = ('id', 'name', 'email', 'role', 'is_staff', 'is_active')
	list_filter = ('role', 'is_staff', 'is_active')
	search_fields = ('email', 'first_name', 'last_name', 'name')
	ordering = ('id',)
	fieldsets = (
		(None, {'fields': ('email', 'password')}),
		(_('Personal info'), {'fields': ('name', 'first_name', 'last_name', 'role')}),
		(_('Permissions'), {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
		(_('Important dates'), {'fields': ('last_login', 'date_joined')}),
	)
	add_fieldsets = (
		(None, {
			'classes': ('wide',),
			'fields': ('email', 'name', 'first_name', 'last_name', 'password1', 'password2', 'role', 'is_staff', 'is_active'),
		}),
	)

admin.site.register(User, CustomUserAdmin)

@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):

    list_display = (
        'user_id',
        'user',
        'data_nascimento'
    )

    search_fields = (
        'user__email',
    )


@admin.register(Bartender)
class BartenderAdmin(admin.ModelAdmin):
	  
	list_display = (
		'user_id',
		'user',
		'data_nascimento'
	)

	search_fields = (
		'user__email',
	)

	def formfield_for_foreignkey(self, db_field, request, **kwargs):
		if db_field.name == 'user':
			kwargs['queryset'] = User.objects.filter(role='bartender')
		return super().formfield_for_foreignkey(db_field, request, **kwargs)


@admin.register(Termos)
class TermosAdmin(admin.ModelAdmin):
    list_display = ('id', 'version', 'role', 'content')
    search_fields = ('version', 'role', 'content')


@admin.register(AceiteTermos)
class AceiteTermosAdmin(admin.ModelAdmin):
    list_display = ('id', 'termo', 'user', 'accepted_at')
    search_fields = ('termo__version', 'user__email')
    

@admin.register(Evento)
class EventoAdmin(admin.ModelAdmin):
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