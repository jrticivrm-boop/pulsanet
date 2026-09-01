/// Roles de organización (alineado con backend `services/roles.js` y web `api.js`).

const _roleLabels = {
  'root': 'Superadmin',
  'admin': 'Admin',
  'zone_admin': 'Admin zona',
  'unit_admin': 'Admin unidad',
  'dispatcher': 'Despacho',
  'operator': 'Operador',
};

String roleLabel(String? role) =>
    _roleLabels[role ?? ''] ?? role ?? '';

bool canManageUsers(Map<String, dynamic>? user) {
  final role = user?['role']?.toString();
  return role == 'root' ||
      role == 'admin' ||
      role == 'zone_admin' ||
      role == 'unit_admin';
}

/// Salir de la app: solo Superadmin, Región, Zona y Admin de unidad.
bool canLogoutFromApp(Map<String, dynamic>? user) => canManageUsers(user);
