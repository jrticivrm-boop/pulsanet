import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import GroupVideoPanel from './GroupVideoPanel.jsx';
import { warmUpVideoCallMedia } from './callMedia';
import { esMsg } from './esMsg';
import { socketIoOptions, socketUrl } from './socketConfig';

/**
 * Una sola sesión de video grupal a nivel app (evita parpadeos al aceptar invitación).
 */
export default function GroupVideoSessionHost({ session }) {
  const [active, setActive] = useState(null);
  const activeRef = useRef(null);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const close = useCallback(() => setActive(null), []);

  useEffect(() => {
    const onOpen = async (ev) => {
      const detail = ev?.detail || {};
      const groupId = detail.groupId || detail.groupIds?.[0];
      if (!groupId) return;
      try {
        await warmUpVideoCallMedia();
        setActive({
          groupId,
          groupIds: detail.groupIds?.length ? detail.groupIds : [groupId],
          groupName: detail.groupName || 'Grupo',
          layout: detail.layout === 'console' ? 'console' : 'overlay',
        });
      } catch (e) {
        window.alert(esMsg(e.message || e, 'No se pudo abrir la transmisión grupal'));
      }
    };
    window.addEventListener('tacticalptx:open-group-video', onOpen);
    return () => window.removeEventListener('tacticalptx:open-group-video', onOpen);
  }, []);

  useEffect(() => {
    if (!session?.token) return undefined;
    const socket = io(socketUrl(), { ...socketIoOptions, auth: { token: session.token } });
    const onEnded = (payload) => {
      const gid = payload?.groupId;
      if (!gid) return;
      if (String(activeRef.current?.groupId) === String(gid)) {
        setActive(null);
      }
    };
    socket.on('group:video_ended', onEnded);
    socket.connect();
    return () => {
      socket.off('group:video_ended', onEnded);
      socket.disconnect();
    };
  }, [session?.token]);

  if (!active || !session?.token) return null;

  return (
    <GroupVideoPanel
      token={session.token}
      groupId={active.groupId}
      groupIds={active.groupIds}
      groupName={active.groupName}
      layout={active.layout}
      onClose={close}
      onRemoteEnded={close}
    />
  );
}
