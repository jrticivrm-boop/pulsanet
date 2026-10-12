import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

export const PANIC_REASONS = ['Emergencia', 'Apoyo', 'Médica', 'Agresión'];

/**
 * Confirmación antes de enviar una alerta: destino (canales / todos) + motivo opcional.
 * `onConfirm({ groupIds, target, note })` — target 'all' solo si `canAlertAll`.
 */
export default function PanicConfirmDialog({
  open,
  groups = [],
  initialIds = [],
  canAlertAll = false,
  busy = false,
  onCancel,
  onConfirm,
  host,
}) {
  const [selected, setSelected] = useState([]);
  const [allScope, setAllScope] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    const valid = new Set(groups.map((g) => String(g.id)));
    const init = (initialIds || []).map(String).filter((id) => valid.has(id));
    setSelected(init.length ? init : groups[0] ? [String(groups[0].id)] : []);
    setAllScope(false);
    setReason('');
    setNote('');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  const selectedNames = useMemo(
    () =>
      groups
        .filter((g) => selected.includes(String(g.id)))
        .map((g) => g.name || 'Canal'),
    [groups, selected]
  );

  if (!open) return null;

  const allMine = groups.length > 0 && selected.length === groups.length;
  const canSend = !busy && (allScope || selected.length > 0);

  function toggle(id) {
    const key = String(id);
    setAllScope(false);
    setSelected((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  }

  function submit() {
    if (!canSend) return;
    const text = [reason, note.trim()].filter(Boolean).join(' — ');
    const ordered = groups.map((g) => String(g.id)).filter((id) => selected.includes(id));
    onConfirm?.({
      groupIds: allScope ? [] : ordered,
      target: allScope ? 'all' : undefined,
      note: text || undefined,
    });
  }

  const summary = allScope
    ? 'todos los canales de tu alcance'
    : selectedNames.length === 1
      ? `«${selectedNames[0]}»`
      : `${selectedNames.length} canales`;

  return createPortal(
    <div
      className="sys-modal-backdrop panic-confirm-backdrop"
      role="presentation"
      onClick={() => !busy && onCancel?.()}
    >
      <div
        className="sys-modal panic-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="panic-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sys-modal-head panic-confirm-head">
          <h2 id="panic-confirm-title">🚨 ¿Enviar alerta?</h2>
          <button
            type="button"
            className="sys-modal-x"
            aria-label="Cancelar"
            disabled={busy}
            onClick={onCancel}
          >
            ×
          </button>
        </header>
        <div className="sys-modal-body">
          <p className="sys-modal-lead">
            Se enviará la alerta con tu ubicación a <strong>{summary}</strong>.
          </p>

          <div className="panic-confirm-label">Destino</div>
          <div className="panic-confirm-quick">
            <button
              type="button"
              className={`panic-chip${!allScope && allMine ? ' on' : ''}`}
              onClick={() => {
                setAllScope(false);
                setSelected(groups.map((g) => String(g.id)));
              }}
            >
              Todos mis canales
            </button>
            {canAlertAll ? (
              <button
                type="button"
                className={`panic-chip${allScope ? ' on' : ''}`}
                onClick={() => setAllScope((v) => !v)}
              >
                Todos (mi alcance)
              </button>
            ) : null}
          </div>
          <ul className="panic-confirm-groups">
            {groups.map((g) => {
              const id = String(g.id);
              return (
                <li key={id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={allScope || selected.includes(id)}
                      disabled={allScope}
                      onChange={() => toggle(id)}
                    />
                    <span>{g.name || 'Canal'}</span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="panic-confirm-label">Motivo (opcional)</div>
          <div className="panic-confirm-quick">
            {PANIC_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                className={`panic-chip${reason === r ? ' on' : ''}`}
                onClick={() => setReason((cur) => (cur === r ? '' : r))}
              >
                {r}
              </button>
            ))}
          </div>
          <input
            className="sys-modal-prompt-input"
            type="text"
            maxLength={200}
            placeholder="Detalle (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
        </div>
        <footer className="sys-modal-actions">
          <button type="button" className="cc-btn ghost" disabled={busy} onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className="cc-btn panic-confirm-send"
            disabled={!canSend}
            onClick={submit}
          >
            {busy ? 'Enviando…' : 'Enviar alerta'}
          </button>
        </footer>
      </div>
    </div>,
    host || document.body
  );
}
