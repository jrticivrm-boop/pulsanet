import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ChatInbox from '../ChatInbox';

/**
 * Página de mensajería en despacho (única instancia de ChatInbox vía keepalive).
 */
export default function DispatchChatsPage({
  session,
  groups,
  group,
  onSelectGroup,
  ptt,
  visible = true,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [focusPeerId, setFocusPeerId] = useState(null);
  const [focusGroupId, setFocusGroupId] = useState(null);

  useEffect(() => {
    const st = location.state;
    if (!st?.focusPeerId && !st?.focusGroupId) return;
    if (st.focusPeerId) setFocusPeerId(st.focusPeerId);
    if (st.focusGroupId) {
      setFocusGroupId(st.focusGroupId);
      onSelectGroup?.(st.focusGroupId);
    }
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate, onSelectGroup]);

  useEffect(() => {
    if (!focusPeerId && !focusGroupId) return undefined;
    const t = window.setTimeout(() => {
      setFocusPeerId(null);
      setFocusGroupId(null);
    }, 500);
    return () => window.clearTimeout(t);
  }, [focusPeerId, focusGroupId]);

  return (
    <div className="cc-chats-page">
      <header className="cc-chats-page-head">
        <div className="cc-chats-page-titles">
          <h1>Chats</h1>
          <p>Mensajes directos y de canal · responde aquí sin mezclar con Radio PTT</p>
        </div>
      </header>
      <div className="cc-chats-page-body">
        <ChatInbox
          session={session}
          groups={groups}
          group={group}
          onSelectGroup={onSelectGroup}
          ptt={ptt}
          focusPeerId={focusPeerId}
          focusGroupId={focusGroupId}
          chatPanelVisible={visible}
        />
      </div>
    </div>
  );
}
