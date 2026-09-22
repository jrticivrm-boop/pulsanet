import { useMemo } from 'react';
import { PRESENCE_LABELS, resolvePresenceStatus } from './presenceStatus.js';

/**
 * Cuenta operadores visibles por estado de presencia (+ pánico).
 */
export function countPresenceLegend(
  locations,
  panicUserIds,
  offlineRedMinutes = 15,
  absenceMinutes = 15,
  showAway = true,
  showOffline = true
) {
  const counts = { online: 0, away: 0, offline: 0, stale: 0, panic: 0 };
  const panicSet =
    panicUserIds instanceof Set ? panicUserIds : new Set(panicUserIds || []);
  const now = Date.now();
  for (const loc of locations || []) {
    const status = resolvePresenceStatus({
      presence: loc.presence,
      focus: loc.focus,
      lastSeenAt: loc.lastSeenAt,
      recordedAt: loc.recordedAt,
      awaySince: loc.awaySince,
      offlineRedMinutes,
      absenceMinutes,
      showAway,
      showOffline,
      now,
    });
    if (status === 'online') counts.online += 1;
    else if (status === 'away') counts.away += 1;
    else if (status === 'stale') counts.stale += 1;
    else counts.offline += 1;
    if (panicSet.has(loc.userId)) counts.panic += 1;
  }
  return counts;
}

/** Leyenda compacta de presencia (overlay sobre el mapa, junto al zoom).
 *  selectedStatusIds: si viene, solo se pintan esos estados (filtro ESTADO).
 *  null = todos los que la org deja visibles (showAway / showOffline).
 */
export default function PresenceMapLegend({
  counts = null,
  overlay = false,
  showAway = true,
  showOffline = true,
  selectedStatusIds = null,
}) {
  const items = useMemo(() => {
    const list = [{ key: 'online', color: '#22c55e' }];
    if (showAway) list.push({ key: 'away', color: '#eab308' });
    if (showOffline) list.push({ key: 'offline', color: '#9ca3af' });
    list.push({ key: 'stale', color: '#ef4444' });
    if (selectedStatusIds == null) return list;
    const selected = new Set(selectedStatusIds.map(String));
    return list.filter((it) => selected.has(it.key));
  }, [showAway, showOffline, selectedStatusIds]);

  const n = (key) => {
    if (!counts || counts[key] == null) return null;
    return Number(counts[key]) || 0;
  };

  if (!items.length) return null;

  return (
    <div
      className={
        overlay
          ? 'presence-map-legend presence-map-legend--overlay'
          : 'presence-map-legend'
      }
      aria-label="Leyenda de presencia"
    >
      {items.map((it) => {
        const num = n(it.key);
        const label = it.label || PRESENCE_LABELS[it.key];
        return (
          <span
            key={it.key}
            className={
              it.key === 'panic'
                ? 'presence-map-legend__item presence-map-legend__item--panic'
                : 'presence-map-legend__item'
            }
          >
            <span className="presence-map-legend__dot" style={{ background: it.color }} />
            <span className="presence-map-legend__label">
              {label}
              {num != null ? (
                <>
                  {' '}
                  <span className="presence-map-legend__count">{num}</span>
                </>
              ) : null}
            </span>
          </span>
        );
      })}
    </div>
  );
}
