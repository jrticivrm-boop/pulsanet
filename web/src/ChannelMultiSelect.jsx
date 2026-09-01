import { useMemo } from 'react';

/**
 * Multi-selección de canales: varios para oír; uno marcado como “hablar”.
 * Los canales disponibles ya vienen filtrados por privilegios del backend.
 */
export default function ChannelMultiSelect({
  groups = [],
  talkGroupId,
  listenIds = [],
  onTalkChange,
  onListenChange,
  label = 'Canales',
  compact = false,
}) {
  const sorted = useMemo(
    () => [...groups].sort((a, b) => String(a.name).localeCompare(String(b.name), 'es')),
    [groups]
  );

  function toggleListen(id) {
    const set = new Set(listenIds);
    if (set.has(id)) {
      if (id === talkGroupId && set.size <= 1) return;
      set.delete(id);
      if (id === talkGroupId) {
        const nextTalk = [...set][0] || '';
        onTalkChange?.(nextTalk);
      }
    } else {
      set.add(id);
    }
    onListenChange?.([...set]);
  }

  function setTalk(id) {
    onTalkChange?.(id);
    if (!listenIds.includes(id)) {
      onListenChange?.([...listenIds, id]);
    }
  }

  if (!sorted.length) {
    return (
      <label className={`group-select channel-multi${compact ? ' compact' : ''}`}>
        {label}
        <p className="muted" style={{ margin: '0.35rem 0 0' }}>
          Sin canales en tu alcance
        </p>
      </label>
    );
  }

  return (
    <div className={`channel-multi${compact ? ' compact' : ''}`}>
      <div className="channel-multi-head">
        <span className="channel-multi-label">{label}</span>
        <label className="channel-multi-talk">
          Hablar en
          <select
            value={talkGroupId || ''}
            onChange={(e) => setTalk(e.target.value)}
            aria-label="Canal para hablar (PTT)"
          >
            {sorted.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ul className="channel-multi-list" aria-label="Canales a escuchar">
        {sorted.map((g) => {
          const on = listenIds.includes(g.id);
          const talking = g.id === talkGroupId;
          return (
            <li key={g.id}>
              <label className={`channel-multi-item${on ? ' on' : ''}${talking ? ' talk' : ''}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggleListen(g.id)}
                />
                <span className="channel-multi-name">{g.name}</span>
                {talking && <span className="channel-multi-badge">PTT</span>}
              </label>
            </li>
          );
        })}
      </ul>
      <p className="channel-multi-hint muted">
        Marca varios para oír. El PTT solo transmite en el canal «Hablar en».
      </p>
    </div>
  );
}
