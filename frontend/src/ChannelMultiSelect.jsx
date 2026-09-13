import { useEffect, useMemo, useRef, useState } from 'react';

const NONE = '';

const LAYOUT_KEY = 'tacticalptx_channel_layout';
const PANEL_KEY = 'tacticalptx_channel_active_panel';
const LAYOUT_EVENT = 'tacticalptx:channel-layout';
const PANEL_EVENT = 'tacticalptx:channel-panel';

function readLayoutMode() {
  try {
    const v = localStorage.getItem(LAYOUT_KEY);
    if (v === 'columns' || v === 'tabs' || v === 'select') return v;
  } catch {
    /* ignore */
  }
  return 'columns';
}

function writeLayoutMode(mode) {
  try {
    localStorage.setItem(LAYOUT_KEY, mode);
    window.dispatchEvent(new CustomEvent(LAYOUT_EVENT, { detail: { mode } }));
  } catch {
    /* ignore */
  }
}

function readActivePanel(showVideo, showAlert) {
  try {
    const v = localStorage.getItem(PANEL_KEY);
    if (v === 'listen' || v === 'talk') return v;
    if (v === 'video' && showVideo) return v;
    if (v === 'alert' && showAlert) return v;
  } catch {
    /* ignore */
  }
  return 'listen';
}

function writeActivePanel(panel) {
  try {
    localStorage.setItem(PANEL_KEY, panel);
    window.dispatchEvent(new CustomEvent(PANEL_EVENT, { detail: { panel } }));
  } catch {
    /* ignore */
  }
}

const PANEL_META = {
  listen: { label: 'Escuchar', aria: 'Canales a escuchar' },
  talk: { label: 'Hablar', aria: 'Canales para hablar' },
  video: { label: 'Video', aria: 'Canales de video' },
  alert: { label: 'Alerta', aria: 'Canales de alerta' },
};

const STASH = {
  listenMulti: 'tacticalptx_listen_stash_multiple',
  listenIndiv: 'tacticalptx_listen_stash_individual',
  talkMulti: 'tacticalptx_talk_stash_multiple',
  talkIndiv: 'tacticalptx_talk_stash_individual',
  videoMulti: 'tacticalptx_video_stash_multiple',
  videoIndiv: 'tacticalptx_video_stash_individual',
  alertMulti: 'tacticalptx_alert_stash_multiple',
  alertIndiv: 'tacticalptx_alert_stash_individual',
};

function readStashArray(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null');
    return Array.isArray(raw) ? raw.map(String) : null;
  } catch {
    return null;
  }
}

function writeStashArray(key, ids) {
  try {
    localStorage.setItem(key, JSON.stringify(ids || []));
  } catch {
    /* ignore */
  }
}

function readStashId(key) {
  try {
    const v = localStorage.getItem(key);
    if (v == null) return null;
    return v;
  } catch {
    return null;
  }
}

function writeStashId(key, id) {
  try {
    localStorage.setItem(key, id == null ? '' : String(id));
  } catch {
    /* ignore */
  }
}

function filterValidIds(ids, validSet) {
  return (ids || []).filter((id) => validSet.has(id));
}

function memberLabel(g) {
  const n = Number(g?.memberCount ?? g?.member_count);
  if (!Number.isFinite(n) || n < 0) return null;
  return `${n} integrante${n === 1 ? '' : 's'}`;
}

function orderGroups(groups, orderIds) {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const seen = new Set();
  const out = [];
  for (const id of orderIds || []) {
    const g = byId.get(id);
    if (g) {
      out.push(g);
      seen.add(id);
    }
  }
  for (const g of groups) {
    if (!seen.has(g.id)) out.push(g);
  }
  return out;
}

/** Entre los marcados, el más arriba en el orden; si ninguno → ''. */
export function pickTopSelected(selectedIds, orderIds) {
  const set = new Set(selectedIds || []);
  if (!set.size) return NONE;
  for (const id of orderIds || []) {
    if (set.has(id)) return id;
  }
  return [...set][0] || NONE;
}

function ModeSelect({
  label,
  value,
  onChange,
  ariaLabel,
  panelValue,
  panelOptions,
  onPanelChange,
}) {
  const hasPanelSelect =
    Array.isArray(panelOptions) && panelOptions.length > 0 && typeof onPanelChange === 'function';

  return (
    <div className="channel-col-mode">
      {hasPanelSelect ? (
        <>
          <select
            className="channel-col-mode-panel"
            value={panelValue}
            onChange={(e) => onPanelChange(e.target.value)}
            aria-label="Opción de canales"
          >
            {panelOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            className="channel-col-mode-toggle"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={ariaLabel || `${label || 'Modo'}: Individual o Múltiple`}
          >
            <option value="individual">Individual</option>
            <option value="multiple">Múltiple</option>
          </select>
        </>
      ) : (
        <>
          {label ? <span className="channel-col-mode-title">{label}</span> : null}
          <select
            className="channel-col-mode-toggle"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={ariaLabel || `${label || 'Modo'}: Individual o Múltiple`}
          >
            <option value="individual">Individual</option>
            <option value="multiple">Múltiple</option>
          </select>
        </>
      )}
    </div>
  );
}

/**
 * Barra tipo ParqueVehicular: orden, marcar/desmarcar, contador, buscar.
 * Marcar solo aplica en modo Múltiple.
 */
function ColumnToolbar({
  mode,
  selectedIds = [],
  totalCount,
  visibleCount,
  sortDir,
  onToggleSort,
  onToggleMark,
  query,
  onQueryChange,
  searchAria,
}) {
  const selected = selectedIds.length;
  const allMarked = mode === 'multiple' && totalCount > 0 && selected >= totalCount;
  const markLabel = allMarked ? 'Desmarcar' : 'Marcar';
  const sortLabel = sortDir === 'desc' ? 'Descendente' : 'Ascendente';
  const countLabel =
    mode === 'multiple'
      ? `${selected} de ${totalCount} seleccionados`
      : selected
        ? '1 seleccionado'
        : '';

  return (
    <div className="channel-col-tools">
      <div className="channel-col-tools-row channel-col-tools-main">
        <button type="button" className="channel-col-tool-link" onClick={onToggleSort}>
          {sortLabel}
        </button>
        {mode === 'multiple' ? (
          <button
            type="button"
            className="channel-col-tool-link"
            onClick={onToggleMark}
            disabled={!totalCount}
          >
            {markLabel}
          </button>
        ) : (
          <span className="channel-col-tool-slot" aria-hidden="true" />
        )}
        <span className="channel-col-count">
          {countLabel}
          {query.trim() && visibleCount !== totalCount
            ? `${countLabel ? ' · ' : ''}${visibleCount} visibles`
            : ''}
        </span>
        <span
          className="channel-col-help"
          title={
            mode === 'multiple'
              ? 'Ascendente/Descendente ordena la lista. Marcar/Desmarcar alterna todos los checks. Buscar filtra por nombre.'
              : 'Ascendente/Descendente ordena la lista. Buscar filtra por nombre.'
          }
        >
          ?
        </span>
      </div>
      <input
        type="search"
        className="channel-col-search"
        placeholder="Buscar en lista…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        aria-label={searchAria || 'Buscar en lista'}
        autoComplete="off"
      />
    </div>
  );
}

/**
 * Columnas: ESCUCHAR | HABLAR | VIDEO | ALERTA (opcionales).
 * Cada una: Individual (radios + «Ninguno») o Múltiple (checks).
 * Orden arrastrable / ↑↓ (compartido). Hablar implica oír.
 */
export default function ChannelMultiSelect({
  groups = [],
  orderIds = [],
  onOrderChange,
  listenMode = 'multiple',
  talkMode = 'individual',
  videoMode = 'individual',
  alertMode = 'individual',
  onListenModeChange,
  onTalkModeChange,
  onVideoModeChange,
  onAlertModeChange,
  listenIds = [],
  talkIds = [],
  videoIds = [],
  alertIds = [],
  onListenChange,
  onTalkChange,
  onVideoChange,
  onAlertChange,
  showVideo = false,
  showAlert = false,
  compact = false,
  showLayoutSwitcher = false,
}) {
  const ordered = useMemo(
    () => orderGroups(groups, orderIds.length ? orderIds : groups.map((g) => g.id)),
    [groups, orderIds]
  );
  const orderedIds = useMemo(() => ordered.map((g) => g.id), [ordered]);

  const dragId = useRef(null);
  const [overId, setOverId] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [listenQuery, setListenQuery] = useState('');
  const [talkQuery, setTalkQuery] = useState('');
  const [videoQuery, setVideoQuery] = useState('');
  const [alertQuery, setAlertQuery] = useState('');
  const [layoutMode, setLayoutMode] = useState(readLayoutMode);
  const [activePanel, setActivePanel] = useState(() => readActivePanel(showVideo, showAlert));
  const validIdSet = useMemo(() => new Set(orderedIds), [orderedIds]);

  const availablePanels = useMemo(() => {
    const list = ['listen', 'talk'];
    if (showVideo) list.push('video');
    if (showAlert) list.push('alert');
    return list;
  }, [showVideo, showAlert]);

  useEffect(() => {
    writeLayoutMode(layoutMode);
  }, [layoutMode]);

  useEffect(() => {
    writeActivePanel(activePanel);
  }, [activePanel]);

  /* Radio queda montado (keepalive): sincronizar Vista/panel entre Configuración ↔ Radio. */
  useEffect(() => {
    const syncLayout = (e) => {
      const mode = e?.detail?.mode || readLayoutMode();
      setLayoutMode((cur) => (cur === mode ? cur : mode));
    };
    const syncPanel = (e) => {
      const panel = e?.detail?.panel || readActivePanel(showVideo, showAlert);
      setActivePanel((cur) => (cur === panel ? cur : panel));
    };
    const resync = () => {
      syncLayout(null);
      syncPanel(null);
    };
    window.addEventListener(LAYOUT_EVENT, syncLayout);
    window.addEventListener(PANEL_EVENT, syncPanel);
    window.addEventListener('tacticalptx:module-nav', resync);
    document.addEventListener('visibilitychange', resync);
    return () => {
      window.removeEventListener(LAYOUT_EVENT, syncLayout);
      window.removeEventListener(PANEL_EVENT, syncPanel);
      window.removeEventListener('tacticalptx:module-nav', resync);
      document.removeEventListener('visibilitychange', resync);
    };
  }, [showVideo, showAlert]);

  useEffect(() => {
    if (!availablePanels.includes(activePanel)) {
      setActivePanel('listen');
    }
  }, [availablePanels, activePanel]);

  function changeLayoutMode(mode) {
    if (mode === layoutMode) return;
    setLayoutMode(mode);
  }

  function changeActivePanel(panel) {
    if (!availablePanels.includes(panel) || panel === activePanel) return;
    setActivePanel(panel);
  }

  function matchQuery(g, q) {
    const needle = (q || '').trim().toLowerCase();
    if (!needle) return true;
    return String(g?.name || '')
      .toLowerCase()
      .includes(needle);
  }

  const listenVisible = useMemo(
    () => ordered.filter((g) => matchQuery(g, listenQuery)),
    [ordered, listenQuery]
  );
  const talkVisible = useMemo(
    () => ordered.filter((g) => matchQuery(g, talkQuery)),
    [ordered, talkQuery]
  );
  const videoVisible = useMemo(
    () => ordered.filter((g) => matchQuery(g, videoQuery)),
    [ordered, videoQuery]
  );
  const alertVisible = useMemo(
    () => ordered.filter((g) => matchQuery(g, alertQuery)),
    [ordered, alertQuery]
  );

  useEffect(() => {
    if (listenMode === 'multiple') {
      writeStashArray(STASH.listenMulti, listenIds);
    } else {
      writeStashId(STASH.listenIndiv, listenIds[0] || NONE);
    }
  }, [listenMode, listenIds]);

  useEffect(() => {
    if (talkMode === 'multiple') {
      writeStashArray(STASH.talkMulti, talkIds);
    } else {
      writeStashId(STASH.talkIndiv, talkIds[0] || NONE);
    }
  }, [talkMode, talkIds]);

  useEffect(() => {
    if (!showVideo) return;
    if (videoMode === 'multiple') {
      writeStashArray(STASH.videoMulti, videoIds);
    } else {
      writeStashId(STASH.videoIndiv, videoIds[0] || NONE);
    }
  }, [showVideo, videoMode, videoIds]);

  useEffect(() => {
    if (!showAlert) return;
    if (alertMode === 'multiple') {
      writeStashArray(STASH.alertMulti, alertIds);
    } else {
      writeStashId(STASH.alertIndiv, alertIds[0] || NONE);
    }
  }, [showAlert, alertMode, alertIds]);

  function emitOrder(nextIds) {
    onOrderChange?.(nextIds);
  }

  function toggleSortByName() {
    const nextDir = sortDir === 'asc' ? 'desc' : 'asc';
    setSortDir(nextDir);
    const sorted = [...ordered].sort((a, b) => {
      const cmp = String(a.name || '').localeCompare(String(b.name || ''), 'es', {
        sensitivity: 'base',
      });
      return nextDir === 'desc' ? -cmp : cmp;
    });
    emitOrder(sorted.map((g) => g.id));
  }

  function markColumn(column, visibleGroups) {
    const visibleIds = visibleGroups.map((g) => g.id);
    if (column === 'listen') {
      const allOn =
        visibleIds.length > 0 && visibleIds.every((id) => listenIds.includes(id));
      if (allOn) {
        onListenChange?.(listenIds.filter((id) => !visibleIds.includes(id)));
      } else {
        const set = new Set([...listenIds, ...visibleIds]);
        onListenChange?.(orderedIds.filter((id) => set.has(id)));
      }
      return;
    }
    if (column === 'talk') {
      const allOn = visibleIds.length > 0 && visibleIds.every((id) => talkIds.includes(id));
      if (allOn) {
        onTalkChange?.(talkIds.filter((id) => !visibleIds.includes(id)));
      } else {
        const set = new Set([...talkIds, ...visibleIds]);
        const next = orderedIds.filter((id) => set.has(id));
        onTalkChange?.(next);
        const listen = ensureListenIncludes(next);
        if (listen !== listenIds) onListenChange?.(listen);
      }
      return;
    }
    if (column === 'video') {
      const allOn = visibleIds.length > 0 && visibleIds.every((id) => videoIds.includes(id));
      if (allOn) {
        onVideoChange?.(videoIds.filter((id) => !visibleIds.includes(id)));
      } else {
        const set = new Set([...videoIds, ...visibleIds]);
        onVideoChange?.(orderedIds.filter((id) => set.has(id)));
      }
      return;
    }
    if (column === 'alert') {
      const allOn = visibleIds.length > 0 && visibleIds.every((id) => alertIds.includes(id));
      if (allOn) {
        onAlertChange?.(alertIds.filter((id) => !visibleIds.includes(id)));
      } else {
        const set = new Set([...alertIds, ...visibleIds]);
        onAlertChange?.(orderedIds.filter((id) => set.has(id)));
      }
    }
  }

  function onDragStart(e, id) {
    dragId.current = id;
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', id);
    } catch {
      /* ignore */
    }
  }

  function onDrop(e, toId) {
    e.preventDefault();
    const fromId = dragId.current || e.dataTransfer.getData('text/plain');
    setOverId(null);
    dragId.current = null;
    if (!fromId || !toId || fromId === toId) return;
    const next = [...orderedIds];
    const from = next.indexOf(fromId);
    const to = next.indexOf(toId);
    if (from < 0 || to < 0) return;
    next.splice(from, 1);
    next.splice(to, 0, fromId);
    emitOrder(next);
  }

  function ensureListenIncludes(talkNext) {
    const need = (talkNext || []).filter(Boolean);
    if (!need.length) return listenIds;
    const set = new Set(listenIds);
    let changed = false;
    for (const id of need) {
      if (!set.has(id)) {
        set.add(id);
        changed = true;
      }
    }
    return changed ? [...set] : listenIds;
  }

  function setListenMode(mode) {
    if (mode === listenMode) return;

    if (mode === 'individual') {
      // Conservar checks actuales para al volver a Múltiple.
      writeStashArray(STASH.listenMulti, listenIds);
      const saved = readStashId(STASH.listenIndiv);
      let one = NONE;
      if (saved === NONE || saved === '') {
        one = NONE;
      } else if (saved && validIdSet.has(saved)) {
        one = saved;
      } else {
        one = pickTopSelected(listenIds, orderedIds);
      }
      writeStashId(STASH.listenIndiv, one);
      onListenChange?.(one ? [one] : []);
    } else {
      // Conservar radio Individual actual (para volver después).
      writeStashId(STASH.listenIndiv, listenIds[0] || NONE);
      const saved = filterValidIds(readStashArray(STASH.listenMulti), validIdSet);
      let next = saved?.length ? saved : [];
      // No fusionar el radio Individual: Múltiple vuelve exactamente a su stash.
      writeStashArray(STASH.listenMulti, next);
      onListenChange?.(next);
    }
    onListenModeChange?.(mode);
  }

  function setTalkMode(mode) {
    if (mode === talkMode) return;

    if (mode === 'individual') {
      writeStashArray(STASH.talkMulti, talkIds);
      const saved = readStashId(STASH.talkIndiv);
      let one = NONE;
      if (saved === NONE || saved === '') {
        one = NONE;
      } else if (saved && validIdSet.has(saved)) {
        one = saved;
      } else {
        one = pickTopSelected(talkIds, orderedIds);
      }
      writeStashId(STASH.talkIndiv, one);
      const next = one ? [one] : [];
      onTalkChange?.(next);
      if (one) {
        const listen = ensureListenIncludes(next);
        if (listen !== listenIds) onListenChange?.(listen);
      }
    } else {
      writeStashId(STASH.talkIndiv, talkIds[0] || NONE);
      const saved = filterValidIds(readStashArray(STASH.talkMulti), validIdSet);
      let next = saved?.length ? saved : [];
      next = orderedIds.filter((id) => next.includes(id));
      writeStashArray(STASH.talkMulti, next);
      onTalkChange?.(next);
      const listen = ensureListenIncludes(next);
      if (listen !== listenIds) onListenChange?.(listen);
    }
    onTalkModeChange?.(mode);
  }

  function setVideoMode(mode) {
    if (mode === videoMode) return;
    if (mode === 'individual') {
      writeStashArray(STASH.videoMulti, videoIds);
      const saved = readStashId(STASH.videoIndiv);
      let one = NONE;
      if (saved === NONE || saved === '') {
        one = NONE;
      } else if (saved && validIdSet.has(saved)) {
        one = saved;
      } else {
        one = pickTopSelected(videoIds, orderedIds);
      }
      writeStashId(STASH.videoIndiv, one);
      onVideoChange?.(one ? [one] : []);
    } else {
      writeStashId(STASH.videoIndiv, videoIds[0] || NONE);
      const saved = filterValidIds(readStashArray(STASH.videoMulti), validIdSet);
      let next = saved?.length ? saved : [];
      next = orderedIds.filter((id) => next.includes(id));
      writeStashArray(STASH.videoMulti, next);
      onVideoChange?.(next);
    }
    onVideoModeChange?.(mode);
  }

  function setListenIndividual(id) {
    const next = id ? [id] : [];
    onListenChange?.(next);
  }

  function toggleListenMultiple(id) {
    const set = new Set(listenIds);
    if (set.has(id)) {
      set.delete(id);
      // Si dejas de oír un canal en el que hablas, también quita hablar.
      if (talkIds.includes(id)) {
        const talkNext = talkIds.filter((x) => x !== id);
        onTalkChange?.(talkNext);
      }
    } else {
      set.add(id);
    }
    onListenChange?.([...set]);
  }

  function setTalkIndividual(id) {
    const next = id ? [id] : [];
    onTalkChange?.(next);
    if (id) {
      const listen = ensureListenIncludes(next);
      if (listen !== listenIds) onListenChange?.(listen);
    }
  }

  function toggleTalkMultiple(id) {
    const set = new Set(talkIds);
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    const next = orderedIds.filter((x) => set.has(x));
    onTalkChange?.(next);
    const listen = ensureListenIncludes(next);
    if (listen !== listenIds) onListenChange?.(listen);
  }

  function setVideoIndividual(id) {
    onVideoChange?.(id ? [id] : []);
  }

  function toggleVideoMultiple(id) {
    const set = new Set(videoIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onVideoChange?.(orderedIds.filter((x) => set.has(x)));
  }

  function setAlertMode(mode) {
    if (mode === alertMode) return;
    if (mode === 'individual') {
      writeStashArray(STASH.alertMulti, alertIds);
      const saved = readStashId(STASH.alertIndiv);
      let one = NONE;
      if (saved === NONE || saved === '') {
        one = NONE;
      } else if (saved && validIdSet.has(saved)) {
        one = saved;
      } else {
        one = pickTopSelected(alertIds, orderedIds);
      }
      writeStashId(STASH.alertIndiv, one);
      onAlertChange?.(one ? [one] : []);
    } else {
      writeStashId(STASH.alertIndiv, alertIds[0] || NONE);
      const saved = filterValidIds(readStashArray(STASH.alertMulti), validIdSet);
      let next = saved?.length ? saved : [];
      next = orderedIds.filter((id) => next.includes(id));
      writeStashArray(STASH.alertMulti, next);
      onAlertChange?.(next);
    }
    onAlertModeChange?.(mode);
  }

  function setAlertIndividual(id) {
    onAlertChange?.(id ? [id] : []);
  }

  function toggleAlertMultiple(id) {
    const set = new Set(alertIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onAlertChange?.(orderedIds.filter((x) => set.has(x)));
  }

  if (!groups.length) {
    return (
      <div className={`channel-dual${compact ? ' compact' : ''}`}>
        <p className="muted" style={{ margin: 0 }}>
          Sin canales en tu alcance
        </p>
      </div>
    );
  }

  function renderGroupRow(g, column) {
    const meta = memberLabel(g);
    const isListen = listenIds.includes(g.id);
    const isTalk = talkIds.includes(g.id);
    const isVideo = videoIds.includes(g.id);
    const isAlert = alertIds.includes(g.id);
    const idx = orderedIds.indexOf(g.id);
    const isFirst = idx === 0;
    const isLast = idx === orderedIds.length - 1;
    const selected =
      column === 'listen'
        ? listenMode === 'individual'
          ? listenIds[0] === g.id
          : isListen
        : column === 'talk'
          ? talkMode === 'individual'
            ? talkIds[0] === g.id
            : isTalk
          : column === 'video'
            ? videoMode === 'individual'
              ? videoIds[0] === g.id
              : isVideo
            : alertMode === 'individual'
              ? alertIds[0] === g.id
              : isAlert;

    let input;
    if (column === 'listen') {
      input =
        listenMode === 'individual' ? (
          <input
            type="radio"
            name="channel-listen-indiv"
            checked={listenIds[0] === g.id}
            onChange={() => setListenIndividual(g.id)}
          />
        ) : (
          <input
            type="checkbox"
            checked={isListen}
            onChange={() => toggleListenMultiple(g.id)}
          />
        );
    } else if (column === 'talk') {
      input =
        talkMode === 'individual' ? (
          <input
            type="radio"
            name="channel-talk-indiv"
            checked={talkIds[0] === g.id}
            onChange={() => setTalkIndividual(g.id)}
          />
        ) : (
          <input
            type="checkbox"
            checked={isTalk}
            onChange={() => toggleTalkMultiple(g.id)}
          />
        );
    } else if (column === 'video') {
      input =
        videoMode === 'individual' ? (
          <input
            type="radio"
            name="channel-video-indiv"
            checked={videoIds[0] === g.id}
            onChange={() => setVideoIndividual(g.id)}
          />
        ) : (
          <input
            type="checkbox"
            checked={isVideo}
            onChange={() => toggleVideoMultiple(g.id)}
          />
        );
    } else {
      input =
        alertMode === 'individual' ? (
          <input
            type="radio"
            name="channel-alert-indiv"
            checked={alertIds[0] === g.id}
            onChange={() => setAlertIndividual(g.id)}
          />
        ) : (
          <input
            type="checkbox"
            checked={isAlert}
            onChange={() => toggleAlertMultiple(g.id)}
          />
        );
    }

    return (
      <li
        key={`${column}-${g.id}`}
        className={`channel-dual-row${selected ? ' on' : ''}${
          column === 'listen' && isListen ? ' listen' : ''
        }${column === 'talk' && isTalk ? ' talk' : ''}${
          column === 'video' && isVideo ? ' video' : ''
        }${column === 'alert' && isAlert ? ' alert' : ''}${isFirst ? ' is-first' : ''}${
          isLast ? ' is-last' : ''
        }${overId === g.id ? ' drag-over' : ''}`}
        draggable
        onDragStart={(e) => onDragStart(e, g.id)}
        onDragOver={(e) => {
          e.preventDefault();
          setOverId(g.id);
        }}
        onDragLeave={() => setOverId((cur) => (cur === g.id ? null : cur))}
        onDrop={(e) => onDrop(e, g.id)}
      >
        <span className="channel-dual-drag" title="Arrastrar para ordenar" aria-hidden="true">
          ⋮⋮
        </span>
        <label className="channel-dual-item">
          {input}
          <span className="channel-dual-text">
            <span className="channel-dual-name">{g.name}</span>
            {meta ? <span className="channel-dual-meta">{meta}</span> : null}
          </span>
          {column === 'listen' && isListen ? (
            <span className="channel-multi-badge listen">OIR</span>
          ) : null}
          {column === 'talk' && isTalk ? (
            <span className="channel-multi-badge">PTT</span>
          ) : null}
          {column === 'video' && isVideo ? (
            <span className="channel-multi-badge video">VID</span>
          ) : null}
          {column === 'alert' && isAlert ? (
            <span className="channel-multi-badge alert">ALE</span>
          ) : null}
        </label>
      </li>
    );
  }

  function columnConfig(column) {
    if (column === 'listen') {
      return {
        mode: listenMode,
        setMode: setListenMode,
        selectedIds: listenIds,
        visible: listenVisible,
        query: listenQuery,
        setQuery: setListenQuery,
        noneLabel: 'Ninguno',
        noneMeta: 'No oír canales',
        radioName: 'channel-listen-indiv',
        setIndividual: setListenIndividual,
        hint:
          listenMode === 'multiple'
            ? 'Oyes los canales marcados. En Individual: solo uno.'
            : 'Oyes un solo canal. En Múltiple: varios a la vez.',
      };
    }
    if (column === 'talk') {
      return {
        mode: talkMode,
        setMode: setTalkMode,
        selectedIds: talkIds,
        visible: talkVisible,
        query: talkQuery,
        setQuery: setTalkQuery,
        noneLabel: 'Ninguno',
        noneMeta: 'Sin canal PTT',
        radioName: 'channel-talk-indiv',
        setIndividual: setTalkIndividual,
        hint:
          talkMode === 'multiple'
            ? 'El PTT habla en los canales marcados (y los pone en Escuchar). En Individual: solo uno.'
            : 'El PTT habla en un canal (y lo pone en Escuchar). En Múltiple: varios a la vez.',
      };
    }
    if (column === 'video') {
      return {
        mode: videoMode,
        setMode: setVideoMode,
        selectedIds: videoIds,
        visible: videoVisible,
        query: videoQuery,
        setQuery: setVideoQuery,
        noneLabel: 'Ninguno',
        noneMeta: 'Sin video grupal',
        radioName: 'channel-video-indiv',
        setIndividual: setVideoIndividual,
        hint:
          videoMode === 'multiple'
            ? 'Una sola videollamada con los canales marcados. En Individual: solo un canal.'
            : 'Videollamada de un canal. En Múltiple: una sola llamada con todos los marcados.',
      };
    }
    return {
      mode: alertMode,
      setMode: setAlertMode,
      selectedIds: alertIds,
      visible: alertVisible,
      query: alertQuery,
      setQuery: setAlertQuery,
      noneLabel: 'Ninguno',
      noneMeta: 'Sin destino de alerta',
      radioName: 'channel-alert-indiv',
      setIndividual: setAlertIndividual,
      hint:
        alertMode === 'multiple'
          ? 'Varios canales reciben la alerta. En Individual: solo un canal. Un aviso por persona.'
          : 'Un canal recibe la alerta. En Múltiple: varios canales. Un aviso por persona.',
    };
  }

  function renderColumn(column, { hideTitle = false, panelSelect = false } = {}) {
    const meta = PANEL_META[column];
    const cfg = columnConfig(column);
    return (
      <section className="channel-col" aria-label={meta.aria} key={column}>
        <ModeSelect
          label={hideTitle ? null : meta.label}
          value={cfg.mode}
          onChange={cfg.setMode}
          ariaLabel={`Modo ${meta.label.toLowerCase()}`}
          panelValue={panelSelect ? activePanel : undefined}
          panelOptions={
            panelSelect
              ? availablePanels.map((p) => ({ value: p, label: PANEL_META[p].label }))
              : undefined
          }
          onPanelChange={panelSelect ? changeActivePanel : undefined}
        />
        <ColumnToolbar
          mode={cfg.mode}
          selectedIds={cfg.selectedIds}
          totalCount={ordered.length}
          visibleCount={cfg.visible.length}
          sortDir={sortDir}
          onToggleSort={toggleSortByName}
          onToggleMark={() => markColumn(column, cfg.visible)}
          query={cfg.query}
          onQueryChange={cfg.setQuery}
          searchAria={`Buscar ${meta.aria.toLowerCase()}`}
        />
        <ul className="channel-dual-list">
          {cfg.mode === 'individual' && (
            <li className={`channel-dual-row none${cfg.selectedIds.length === 0 ? ' on' : ''}`}>
              <span className="channel-dual-drag is-spacer" aria-hidden="true">
                ⋮⋮
              </span>
              <label className="channel-dual-item">
                <input
                  type="radio"
                  name={cfg.radioName}
                  checked={cfg.selectedIds.length === 0}
                  onChange={() => cfg.setIndividual(NONE)}
                />
                <span className="channel-dual-text">
                  <span className="channel-dual-name">{cfg.noneLabel}</span>
                  <span className="channel-dual-meta">{cfg.noneMeta}</span>
                </span>
              </label>
            </li>
          )}
          {cfg.visible.map((g) => renderGroupRow(g, column))}
          {!cfg.visible.length ? (
            <li className="channel-dual-row none">
              <span className="channel-dual-item muted">Sin coincidencias</span>
            </li>
          ) : null}
        </ul>
        <p className="channel-multi-hint muted">{cfg.hint || '\u00a0'}</p>
      </section>
    );
  }

  const layoutClass =
    layoutMode === 'columns' ? 'layout-columns' : layoutMode === 'tabs' ? 'layout-tabs' : 'layout-select';

  return (
    <div
      className={`channel-dual${compact ? ' compact' : ''}${showVideo ? ' with-video' : ''}${
        showAlert ? ' with-alert' : ''
      } ${layoutClass}`}
    >
      {showLayoutSwitcher ? (
        <div className="channel-layout-bar">
          <label className="channel-layout-mode">
            <span className="channel-layout-mode-title">Vista</span>
            <select
              value={layoutMode}
              onChange={(e) => changeLayoutMode(e.target.value)}
              aria-label="Vista de canales"
            >
              <option value="columns">Columnas</option>
              <option value="tabs">Pestañas</option>
              <option value="select">Encabezado</option>
            </select>
          </label>
        </div>
      ) : null}

      {layoutMode === 'tabs' ? (
        <div className="channel-panel-tabs" role="tablist" aria-label="Panel de canales">
          {availablePanels.map((panel) => (
            <button
              key={panel}
              type="button"
              role="tab"
              aria-selected={activePanel === panel}
              className={`channel-panel-tab${activePanel === panel ? ' on' : ''}`}
              onClick={() => changeActivePanel(panel)}
            >
              {PANEL_META[panel].label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="channel-dual-grid">
        {layoutMode === 'columns'
          ? availablePanels.map((panel) => renderColumn(panel))
          : layoutMode === 'select'
            ? renderColumn(activePanel, { panelSelect: true })
            : renderColumn(activePanel, { hideTitle: true })}
      </div>
    </div>
  );
}
