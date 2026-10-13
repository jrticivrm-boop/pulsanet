import { useEffect, useMemo, useState } from 'react';
import PersonAvatar from '../PersonAvatar';

const MAX_ROWS = 150;

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function haystack(u) {
  return norm(
    [
      u.displayName,
      u.fullName,
      u.username,
      u.matricula,
      u.phone,
      u.grade,
      u.cargo,
      u.specialty,
      u.unitName,
      u.zoneName,
      u.email,
    ]
      .filter(Boolean)
      .join(' ')
  );
}

function placeOf(u) {
  return u.unitName || u.zoneName || '';
}

/**
 * Buscador + selección múltiple de personas para un canal.
 * Busca por nombre, usuario, matrícula, teléfono, grado, cargo o adscripción;
 * filtra por adscripción y tipo; permite pegar una lista de matrículas/usuarios.
 */
export default function GroupMemberPicker({
  candidates,
  token,
  roles,
  roleLabel,
  busy = false,
  disabled = false,
  emptyText = 'Sin personas elegibles',
  submitLabel = (n) => (n === 1 ? 'Agregar 1 persona' : `Agregar ${n} personas`),
  onAdd,
}) {
  const [q, setQ] = useState('');
  const [place, setPlace] = useState('');
  const [kind, setKind] = useState('');
  const [role, setRole] = useState(roles[0]?.value || 'member');
  const [selected, setSelected] = useState(() => new Set());
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [message, setMessage] = useState(null);
  const [sending, setSending] = useState(false);

  const indexed = useMemo(
    () => (candidates || []).map((u) => ({ u, id: String(u.id), hay: haystack(u) })),
    [candidates]
  );

  useEffect(() => {
    const valid = new Set(indexed.map((x) => x.id));
    setSelected((prev) => {
      let changed = false;
      const next = new Set();
      for (const id of prev) {
        if (valid.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [indexed]);

  const places = useMemo(
    () => [...new Set(indexed.map((x) => placeOf(x.u)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [indexed]
  );
  const kinds = useMemo(() => [...new Set(indexed.map((x) => x.u.role).filter(Boolean))], [indexed]);

  const filtered = useMemo(() => {
    const tokens = norm(q).split(/\s+/).filter(Boolean);
    return indexed.filter((x) => {
      if (place && placeOf(x.u) !== place) return false;
      if (kind && x.u.role !== kind) return false;
      return tokens.every((t) => x.hay.includes(t));
    });
  }, [indexed, q, place, kind]);

  const shown = filtered.slice(0, MAX_ROWS);
  const allFilteredSelected = filtered.length > 0 && filtered.every((x) => selected.has(x.id));
  const off = disabled || busy || sending;

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((x) => next.delete(x.id));
      else filtered.forEach((x) => next.add(x.id));
      return next;
    });
  }

  function applyPaste() {
    const tokens = [...new Set(pasteText.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean))];
    if (!tokens.length) return;
    const found = new Set();
    const missing = [];
    for (const raw of tokens) {
      const t = norm(raw);
      const digits = raw.replace(/\D/g, '');
      const hit = indexed.find(
        (x) =>
          norm(x.u.matricula) === t ||
          norm(x.u.username) === t ||
          (digits.length >= 10 && String(x.u.phone || '').replace(/\D/g, '').endsWith(digits.slice(-10)))
      );
      if (hit) found.add(hit.id);
      else missing.push(raw);
    }
    setSelected((prev) => new Set([...prev, ...found]));
    setMessage({
      kind: missing.length ? 'warn' : 'ok',
      text:
        `${found.size} marcada(s) de ${tokens.length}.` +
        (missing.length
          ? ` No encontradas o no elegibles (ya integrantes, fuera de alcance o de otra zona): ${missing.join(', ')}`
          : ''),
    });
    if (!missing.length) {
      setPasteText('');
      setPasteOpen(false);
    }
  }

  async function submit() {
    const ids = [...selected];
    if (!ids.length || !onAdd) return;
    setSending(true);
    setMessage(null);
    try {
      const res = await onAdd(ids, role);
      const rejected = res?.rejected || [];
      const addedCount = res?.added ? res.added.length : ids.length - rejected.length;
      setSelected(new Set(rejected.map((r) => String(r.userId))));
      if (rejected.length) {
        const byId = new Map(indexed.map((x) => [x.id, x.u]));
        const detail = rejected
          .slice(0, 6)
          .map((r) => `${byId.get(String(r.userId))?.displayName || r.userId} (${r.error})`)
          .join('; ');
        setMessage({
          kind: 'warn',
          text: `Se agregaron ${addedCount}. No se pudieron agregar ${rejected.length}: ${detail}${rejected.length > 6 ? '…' : ''}`,
        });
      } else if (res?.message) {
        setMessage({ kind: 'ok', text: res.message });
      } else {
        setMessage({ kind: 'ok', text: addedCount === 1 ? 'Se agregó 1 persona.' : `Se agregaron ${addedCount} personas.` });
      }
    } catch (e) {
      setMessage({ kind: 'error', text: e?.message || 'No se pudo agregar' });
    } finally {
      setSending(false);
    }
  }

  if (!indexed.length) {
    return <p className="cc-hint gmp-empty">{emptyText}</p>;
  }

  return (
    <div className={`gmp${off ? ' gmp--off' : ''}`}>
      <div className="gmp-search">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault();
          }}
          placeholder="Buscar por nombre, usuario, matrícula, teléfono, grado…"
          aria-label="Buscar personas"
          disabled={off}
        />
        <div className="gmp-filters">
          {places.length > 1 ? (
            <select value={place} onChange={(e) => setPlace(e.target.value)} aria-label="Adscripción" disabled={off}>
              <option value="">Toda adscripción</option>
              {places.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          ) : null}
          {kinds.length > 1 ? (
            <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tipo" disabled={off}>
              <option value="">Todo tipo</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {roleLabel ? roleLabel(k) : k}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            className={`cc-btn cc-btn-sm${pasteOpen ? ' active' : ''}`}
            onClick={() => setPasteOpen((v) => !v)}
            disabled={off}
            title="Pegar varias matrículas o usuarios"
          >
            Pegar lista
          </button>
        </div>
      </div>

      {pasteOpen ? (
        <div className="gmp-paste">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={3}
            placeholder="Matrículas, usuarios o teléfonos separados por coma, espacio o renglón"
            disabled={off}
          />
          <button type="button" className="cc-btn primary cc-btn-sm" onClick={applyPaste} disabled={off || !pasteText.trim()}>
            Marcar
          </button>
        </div>
      ) : null}

      <div className="gmp-bar">
        <label className="gmp-all">
          <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} disabled={off || !filtered.length} />
          <span>
            {q || place || kind ? `Seleccionar los ${filtered.length} encontrados` : `Seleccionar todos (${filtered.length})`}
          </span>
        </label>
        <span className="gmp-count">
          {selected.size ? `${selected.size} seleccionada(s)` : 'Ninguna seleccionada'}
          {selected.size ? (
            <button type="button" className="gmp-clear" onClick={() => setSelected(new Set())} disabled={off}>
              Limpiar
            </button>
          ) : null}
        </span>
      </div>

      <ul className="gmp-list" role="listbox" aria-multiselectable="true">
        {shown.length === 0 ? <li className="gmp-none">Sin coincidencias.</li> : null}
        {shown.map(({ u, id }) => {
          const on = selected.has(id);
          const meta = [u.grade, u.matricula ? `Mat. ${u.matricula}` : null, u.username ? `@${u.username}` : null]
            .filter(Boolean)
            .join(' · ');
          return (
            <li key={id} role="option" aria-selected={on}>
              <label className={`gmp-row${on ? ' gmp-row--on' : ''}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(id)} disabled={off} />
                <PersonAvatar userId={id} name={u.displayName} token={token} className="gmp-avatar" />
                <span className="gmp-text">
                  <strong>{u.displayName || u.fullName || u.username}</strong>
                  <small>{meta || (roleLabel ? roleLabel(u.role) : u.role)}</small>
                </span>
                <span className="gmp-place">
                  {placeOf(u)}
                  <small>{roleLabel ? roleLabel(u.role) : u.role}</small>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {filtered.length > MAX_ROWS ? (
        <p className="cc-hint gmp-more">
          Mostrando {MAX_ROWS} de {filtered.length}; afina la búsqueda. «Seleccionar» incluye a todos los encontrados.
        </p>
      ) : null}

      <div className="gmp-foot">
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Rol en el canal" disabled={off}>
          {roles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button type="button" className="cc-btn primary" onClick={submit} disabled={off || !selected.size}>
          {sending ? 'Agregando…' : selected.size ? submitLabel(selected.size) : 'Selecciona personas'}
        </button>
      </div>
      {message ? <p className={`gmp-msg gmp-msg--${message.kind}`}>{message.text}</p> : null}
    </div>
  );
}
