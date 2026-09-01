/// Estado de foco de la app (minimizada / pantalla bloqueada).
bool appInBackground = false;

/// Conversación abierta en primer plano (`dm` | `group`).
String? viewingChatKind;
String? viewingChatId;

void setViewingChat({String? kind, String? id}) {
  viewingChatKind = kind;
  viewingChatId = id;
}

void clearViewingChat() {
  viewingChatKind = null;
  viewingChatId = null;
}
