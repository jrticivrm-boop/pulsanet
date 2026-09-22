/// Roles de organización (alineado con backend `services/roles.js` y web `api.js`).

const _roleLabels = {
  'root': 'Administrador',
  'region_admin': 'Admin de región',
  'region_user': 'Usuario de región',
  'zone_admin': 'Admin de zona',
  'zone_user': 'Usuario de zona',
  'unit_admin': 'Admin de unidad',
  'unit_user': 'Usuario de unidad',
};

String roleLabel(String? role) =>
    _roleLabels[role ?? ''] ?? role ?? '';

bool canManageUsers(Map<String, dynamic>? user) {
  final role = user?['role']?.toString();
  return role == 'root' ||
      role == 'region_admin' ||
      role == 'zone_admin' ||
      role == 'unit_admin' ||
      role == 'admin';
}

bool canViewGpsTrack(Map<String, dynamic>? user) {
  final role = user?['role']?.toString() ?? '';
  return role.isNotEmpty;
}

/// Salir de la app: solo Superadmin, Región, Zona y Admin de unidad.
bool canLogoutFromApp(Map<String, dynamic>? user) => canManageUsers(user);
