import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'tacticalptx_theme';

/** Valores internos estables */
export const THEME_IDS = ['light', 'verde', 'obscuro'];

/** Labels UI */
export const THEME_LABELS = {
  light: 'Claro',
  verde: 'Verde',
  obscuro: 'Obscuro',
};

const THEME_ICONS = {
  light: '☀',
  verde: '✦',
  obscuro: '☾',
};

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
  themeLabel: THEME_LABELS.light,
});

/**
 * Migración: el antiguo `dark` / `oscuro` era el HUD oliva militar → `verde`.
 * El nuevo Obscuro es `obscuro` (paleta ParqueVehicular :root).
 */
export function normalizeThemeId(raw) {
  if (raw === 'light' || raw === 'verde' || raw === 'obscuro') return raw;
  /* Legacy storage: dark/oscuro apuntaban al militar */
  if (raw === 'dark' || raw === 'oscuro') return 'verde';
  return null;
}

function readInitialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const normalized = normalizeThemeId(saved);
    if (normalized) {
      if (saved !== normalized) {
        try {
          localStorage.setItem(STORAGE_KEY, normalized);
        } catch {
          /* ignore */
        }
      }
      return normalized;
    }
  } catch {
    /* ignore */
  }
  return 'light';
}

function nextTheme(current) {
  const i = THEME_IDS.indexOf(current);
  return THEME_IDS[(i < 0 ? 0 : i + 1) % THEME_IDS.length];
}

/** Favicon / apple-touch por tema (Obscuro = Tactical 4). */
export const FAVICON_BY_THEME = {
  light: '/brand/sicom_round.png',
  verde: '/brand/sicom_round.png',
  obscuro: '/brand/tactical_favicon_obscuro.png?v=1',
};

export function faviconForTheme(theme) {
  return FAVICON_BY_THEME[theme] || FAVICON_BY_THEME.light;
}

function applyThemeFavicons(theme) {
  try {
    const href = faviconForTheme(theme);
    const icon =
      document.querySelector('link[rel="icon"]') ||
      document.querySelector('link[rel="shortcut icon"]');
    if (icon) {
      const cur = icon.getAttribute('href') || '';
      /* No pisar el SVG rojo de «al aire» (appNotify). */
      if (!cur.startsWith('data:')) {
        icon.type = 'image/png';
        icon.href = href;
      }
    }
    document.querySelectorAll('link[rel="apple-touch-icon"]').forEach((link) => {
      const cur = link.getAttribute('href') || '';
      if (cur.includes('sicom_round') || cur.includes('tactical_favicon_obscuro')) {
        link.href = href.split('?')[0];
      }
    });
  } catch {
    /* ignore */
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    applyThemeFavicons(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      themeLabel: THEME_LABELS[theme] || THEME_LABELS.light,
      setTheme: (t) => {
        const n = normalizeThemeId(t);
        if (n) setThemeState(n);
      },
      toggleTheme: () => setThemeState((t) => nextTheme(t)),
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * @param {'default' | 'rail' | 'phone'} [variant]
 * - default: chip compacto (login / radio)
 * - rail: pie del menú lateral (mismo formato que Salir)
 * - phone: fila del menú «Más» en móvil
 * @param {() => void} [onAfterClick] p. ej. cerrar sheet móvil
 */
export function ThemeToggle({ className = '', variant = 'default', onAfterClick }) {
  const { theme, toggleTheme } = useTheme();
  const upcoming = nextTheme(theme);
  const label = THEME_LABELS[upcoming];
  const icon = THEME_ICONS[upcoming];
  const [cycling, setCycling] = useState(false);

  const onClick = () => {
    setCycling(true);
    toggleTheme();
    window.setTimeout(() => setCycling(false), 320);
    try {
      onAfterClick?.();
    } catch {
      /* ignore */
    }
  };

  const title = `Cambiar a modo ${label}`;
  const aria = `Activar modo ${label}`;
  const dataAttrs = {
    'data-theme-current': theme,
    'data-theme-next': upcoming,
  };

  if (variant === 'rail') {
    return (
      <button
        type="button"
        className={`cc-btn ghost cc-mod-logout cc-mod-theme${cycling ? ' is-cycling' : ''}${className ? ` ${className}` : ''}`}
        onClick={onClick}
        title={title}
        aria-label={aria}
        {...dataAttrs}
      >
        <span className="cc-mod-link-icon">
          <span className="cc-mod-theme-glyph" aria-hidden="true">
            {icon}
          </span>
        </span>
        <span className="cc-mod-logout-label">{label}</span>
      </button>
    );
  }

  if (variant === 'phone') {
    return (
      <button
        type="button"
        className={`cc-phone-more-link cc-mod-theme-phone${cycling ? ' is-cycling' : ''}${className ? ` ${className}` : ''}`}
        onClick={onClick}
        title={title}
        aria-label={aria}
        {...dataAttrs}
      >
        <span className="cc-mod-link-icon">
          <span className="cc-mod-theme-glyph" aria-hidden="true">
            {icon}
          </span>
        </span>
        <span>
          <strong>{label}</strong>
          <small>Cambiar apariencia</small>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`theme-toggle${cycling ? ' is-cycling' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      title={title}
      aria-label={aria}
      {...dataAttrs}
    >
      <span className="theme-toggle-face" key={theme}>
        <span className="theme-toggle-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="theme-toggle-label">{label}</span>
      </span>
    </button>
  );
}
