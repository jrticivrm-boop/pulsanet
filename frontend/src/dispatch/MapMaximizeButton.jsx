/**
 * Botón Maximizar / Restaurar compartido por todos los mapas del panel.
 * Tooltip en maximizado: «Restaurar (Esc) para salir». Esc sigue cerrando vía data-esc-close-btn.
 */
export default function MapMaximizeButton({ maximized, onClick }) {
  return (
    <button
      type="button"
      className="lt-max-btn lt-max-btn--map"
      onClick={onClick}
      title={maximized ? 'Restaurar (Esc) para salir' : 'Pantalla completa'}
      aria-label={
        maximized ? 'Restaurar mapa (Esc para salir)' : 'Maximizar mapa a pantalla completa'
      }
      data-esc-close-btn={maximized ? '' : undefined}
    >
      {maximized ? '⛶ Restaurar' : '⛶ Maximizar'}
    </button>
  );
}
