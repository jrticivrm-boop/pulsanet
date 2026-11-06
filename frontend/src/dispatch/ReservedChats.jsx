import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import AuditConversationPeek from './AuditConversationPeek.jsx';
import ReservedWhoBar, { defaultWhoFilter, whoFilterReady } from './ReservedWhoBar.jsx';

/**
 * Conversaciones RESERVADO: un solo hilo, el par o el grupo elegido.
 */
export default function ReservedChats() {
  const ctx = useOutletContext() || {};
  const session = ctx.session;
  const [filter, setFilter] = useState(defaultWhoFilter);
  const ready = whoFilterReady(filter);
  const open = useMemo(() => {
    if (!ready) return null;
    if (filter.withKind === 'grupo') {
      return { groupId: filter.groupId, groupName: filter.groupName };
    }
    return { peerId: filter.peerId, peerName: filter.peerName };
  }, [ready, filter.withKind, filter.groupId, filter.groupName, filter.peerId, filter.peerName]);

  if (!session) {
    return <p className="cc-hint">Sesión no disponible.</p>;
  }

  return (
    <div className="cc-reserved-conversations">
      <ReservedWhoBar token={session.token} value={filter} onChange={setFilter} />
      {!ready ? (
        <p className="cc-hint">Elige de quién y con quién. Hasta entonces no se abre ningún hilo.</p>
      ) : (
        <AuditConversationPeek
          embedded
          session={session}
          subjectUserId={filter.userId}
          subjectName={filter.userName}
          open={open}
          from={filter.from}
          to={filter.to}
          onClose={() => {}}
        />
      )}
    </div>
  );
}
