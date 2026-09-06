/// Estado global de llamada 1:1 (evita import circular channel_session ↔ UI).
class PrivateCallGate {
  PrivateCallGate._();

  static bool uiOpen = false;
  static String? activeCallId;
  static String? activePeerId;

  static void bind({required String callId, String? peerId}) {
    uiOpen = true;
    activeCallId = callId;
    activePeerId = peerId;
  }

  static void clear({String? callId}) {
    if (callId != null &&
        callId.isNotEmpty &&
        activeCallId != null &&
        callId != activeCallId) {
      return;
    }
    uiOpen = false;
    activeCallId = null;
    activePeerId = null;
  }

  /// true si hay llamada abierta y el incoming es el mismo call / mismo peer,
  /// o si hay cualquier llamada abierta (no apilar Contestar).
  static bool isBusyWith({String? callId, String? peerId}) {
    if (!uiOpen) return false;
    if (callId != null &&
        callId.isNotEmpty &&
        activeCallId != null &&
        callId == activeCallId) {
      return true;
    }
    if (peerId != null &&
        peerId.isNotEmpty &&
        activePeerId != null &&
        peerId == activePeerId) {
      return true;
    }
    return true;
  }
}
