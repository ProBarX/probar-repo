from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.translation import gettext_lazy as _
from .models import User, Cliente

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