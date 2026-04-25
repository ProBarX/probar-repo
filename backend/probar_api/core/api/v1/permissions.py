from rest_framework.permissions import BasePermission


class PropostaParticipantPermission(BasePermission):
    """Permissão de objeto para ações em `Proposta`.

    - Permitido para usuários autenticados de forma geral.
    - Para ações em um objeto (`accept`, `reject`, `counter`) apenas participantes do pedido
      (cliente ou bartender) podem executar.
    """

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        # se não for uma ação de mutação sensível, permitir (tratamento padrão)
        action = getattr(view, 'action', None)

        if action in ('accept', 'reject', 'counter', 'cancel'):
            user = request.user
            pedido = getattr(obj, 'pedido', None)
            if pedido is None:
                return False
            # participantes são o cliente e o bartender do pedido
            cliente_user = getattr(pedido.cliente, 'user', None)
            bartender_user = getattr(pedido.bartender, 'user', None)
            return user == cliente_user or user == bartender_user

        # para outros casos, deixar passar (outras checagens podem aplicar)
        return True
