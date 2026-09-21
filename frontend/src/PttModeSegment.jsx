import { setPttLatchMode } from './pttHoldMode';

/**
 * Segmento Pulsación: Corta (hold) | Larga (latch).
 * @param {{ latch: boolean, disabled?: boolean, onChange?: (latch: boolean) => void, className?: string }} props
 */
export default function PttModeSegment({ latch, disabled = false, onChange, className = '' }) {
  function pick(nextLatch) {
    if (disabled || nextLatch === latch) return;
    setPttLatchMode(nextLatch);
    onChange?.(nextLatch);
  }

  return (
    <div className={`ptt-mode-wrap${className ? ` ${className}` : ''}`}>
      <div className="ptt-mode-label">Pulsación</div>
      <div
        className={`ptt-mode-seg${disabled ? ' is-disabled' : ''}`}
        role="group"
        aria-label="Pulsación"
      >
        <button
          type="button"
          className={`ptt-mode-seg-btn${!latch ? ' is-on' : ''}`}
          disabled={disabled}
          aria-pressed={!latch}
          onClick={() => pick(false)}
          title="Pulsación corta: mantén pulsado para hablar; suelta para cortar"
        >
          Corta
        </button>
        <button
          type="button"
          className={`ptt-mode-seg-btn${latch ? ' is-on' : ''}`}
          disabled={disabled}
          aria-pressed={latch}
          onClick={() => pick(true)}
          title="Pulsación larga: un toque para hablar; otro toque para soltar"
        >
          Larga
        </button>
      </div>
    </div>
  );
}
