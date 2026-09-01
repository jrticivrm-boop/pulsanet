import { useEffect, useId, useRef, useState } from 'react';

/**
 * Diálogo del proyecto (reemplaza window.confirm / alert / prompt).
 */
export default function AppDialog({
  open,
  title = 'Confirmar',
  message,
  confirmLabel = 'Aceptar',
  cancelLabel = 'Cancelar',
  danger = false,
  /** Solo aviso: un botón, sin Cancelar */
  alertOnly = false,
  busy = false,
  /** Si se define, muestra input (reemplaza window.prompt). */
  promptDefault = undefined,
  promptPlaceholder = '',
  promptLabel = '',
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const confirmRef = useRef(null);
  const inputRef = useRef(null);
  const isPrompt = promptDefault !== undefined;
  const [promptValue, setPromptValue] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    if (isPrompt) {
      setPromptValue(String(promptDefault ?? ''));
      const t = window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select?.();
      }, 30);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => confirmRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open, isPrompt, promptDefault]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault();
        onCancel?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  function submit() {
    if (busy) return;
    if (isPrompt) {
      onConfirm?.(promptValue);
      return;
    }
    onConfirm?.();
  }

  return (
    <div
      className="sys-modal-backdrop"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel?.();
      }}
      data-esc-close
    >
      <div
        className="sys-modal sys-modal--sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sys-modal-head">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="sys-modal-x"
            data-esc-close-btn
            aria-label="Cerrar"
            disabled={busy}
            onClick={() => onCancel?.()}
          >
            ×
          </button>
        </header>
        <div className="sys-modal-body">
          {typeof message === 'string' ? <p>{message}</p> : message}
          {isPrompt ? (
            <label className="sys-modal-prompt">
              {promptLabel ? <span className="sys-modal-prompt-label">{promptLabel}</span> : null}
              <input
                ref={inputRef}
                className="sys-modal-prompt-input"
                type="text"
                value={promptValue}
                placeholder={promptPlaceholder}
                disabled={busy}
                onChange={(e) => setPromptValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
            </label>
          ) : null}
        </div>
        <footer className="sys-modal-actions">
          {!alertOnly && (
            <button
              type="button"
              className="cc-btn ghost"
              disabled={busy}
              onClick={() => onCancel?.()}
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            className={`cc-btn ${danger && !alertOnly ? 'danger' : 'primary'}`}
            disabled={busy || (isPrompt && !String(promptValue).trim())}
            onClick={submit}
          >
            {busy ? '…' : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
