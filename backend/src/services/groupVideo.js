/** Sesiones de video grupal (sala LiveKit paralela al PTT de audio). */
const activeGroupVideo = new Map();

export function groupVideoRoomName(groupId) {
  const id = String(groupId || '').replace(/-/g, '');
  return `gvid_${id}`;
}

export function startGroupVideoSession({ groupId, orgId, userId, userName, groupName }) {
  const key = String(groupId);
  let session = activeGroupVideo.get(key);
  if (!session) {
    session = {
      groupId: key,
      orgId,
      groupName: groupName || 'Grupo',
      room: groupVideoRoomName(key),
      startedBy: userId,
      startedByName: userName || 'Usuario',
      startedAt: Date.now(),
      participants: new Map(),
    };
    activeGroupVideo.set(key, session);
  }
  session.participants.set(String(userId), {
    userId: String(userId),
    displayName: userName || 'Usuario',
    joinedAt: Date.now(),
  });
  return session;
}

export function touchGroupVideoParticipant(groupId, userId, userName) {
  const session = activeGroupVideo.get(String(groupId));
  if (!session) return null;
  session.participants.set(String(userId), {
    userId: String(userId),
    displayName: userName || session.participants.get(String(userId))?.displayName || 'Usuario',
    joinedAt: session.participants.get(String(userId))?.joinedAt || Date.now(),
    lastSeenAt: Date.now(),
  });
  return session;
}

export function leaveGroupVideoSession(groupId, userId) {
  const key = String(groupId);
  const session = activeGroupVideo.get(key);
  if (!session) return null;
  session.participants.delete(String(userId));
  if (session.participants.size === 0) {
    activeGroupVideo.delete(key);
    return { session, ended: true };
  }
  return { session, ended: false };
}

export function endGroupVideoSession(groupId) {
  const key = String(groupId);
  const session = activeGroupVideo.get(key);
  if (!session) return null;
  activeGroupVideo.delete(key);
  return session;
}

export function getGroupVideoSession(groupId) {
  return activeGroupVideo.get(String(groupId)) || null;
}

export function serializeGroupVideoSession(session) {
  if (!session) return null;
  return {
    groupId: session.groupId,
    groupName: session.groupName,
    room: session.room,
    startedBy: session.startedBy,
    startedByName: session.startedByName,
    startedAt: session.startedAt,
    participantCount: session.participants.size,
    participants: [...session.participants.values()],
  };
}
