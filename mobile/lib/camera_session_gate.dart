/// Gate de hardware: evita que Ver cámara / videollamada / video de grupo
/// peleen por la misma cámara del dispositivo.
enum CameraOwner { none, remoteCam, privateCall, groupVideo }

class CameraSessionGate {
  CameraSessionGate._();

  static CameraOwner _owner = CameraOwner.none;

  static CameraOwner get owner => _owner;

  static bool get isHeld => _owner != CameraOwner.none;

  /// Intenta adquirir. Si ya hay otro dueño incompatible, falla.
  static bool tryAcquire(CameraOwner who) {
    if (who == CameraOwner.none) return false;
    if (_owner == CameraOwner.none || _owner == who) {
      _owner = who;
      return true;
    }
    return false;
  }

  static void release(CameraOwner who) {
    if (_owner == who) _owner = CameraOwner.none;
  }

  static bool isOwnedBy(CameraOwner who) => _owner == who;
}
