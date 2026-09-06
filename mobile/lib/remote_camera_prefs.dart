import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Preferencias de activación remota de cámara desde despacho.
///
/// Android/iOS exigen permiso de cámara al menos una vez; después el panel web
/// puede activar el feed sin que el operador pulse «Contestar».
class RemoteCameraPrefs {
  RemoteCameraPrefs._();

  static const _enabledKey = 'tacticalptx_remote_camera_enabled';
  static const _promptedKey = 'tacticalptx_remote_camera_prompted';

  static Future<bool> isEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_enabledKey) ?? false;
  }

  static Future<bool> wasPrompted() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_promptedKey) ?? false;
  }

  static Future<void> setEnabled(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_enabledKey, value);
    await prefs.setBool(_promptedKey, true);
  }

  static Future<void> markPrompted() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_promptedKey, true);
  }

  /// Pide permiso de cámara al SO (solo diálogo del sistema si aún no se otorgó).
  static Future<bool> ensureOsCameraPermission() async {
    var status = await Permission.camera.status;
    if (status.isGranted) return true;
    status = await Permission.camera.request();
    return status.isGranted;
  }

  /// Listo para aceptar automáticamente solicitudes `remote_camera`.
  static Future<bool> canAutoAccept() async {
    if (!await isEnabled()) return false;
    final status = await Permission.camera.status;
    return status.isGranted;
  }
}
