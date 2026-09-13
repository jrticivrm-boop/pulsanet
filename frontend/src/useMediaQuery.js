import { useEffect, useState } from 'react';

/** Breakpoints alineados con responsive.css / plan progresivo. */
export const BP_PHONE = 720;
export const BP_TABLET = 960;

/**
 * Suscripción a matchMedia. SSR-safe (default false en servidor).
 * @param {string} query ej. '(max-width: 720px)'
 * @param {boolean} [defaultValue=false]
 */
export function useMediaQuery(query, defaultValue = false) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return defaultValue;
    try {
      return window.matchMedia(query).matches;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    let mql;
    try {
      mql = window.matchMedia(query);
    } catch {
      return undefined;
    }
    const onChange = () => setMatches(Boolean(mql.matches));
    onChange();
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);

  return matches;
}

export function useIsPhone() {
  return useMediaQuery(`(max-width: ${BP_PHONE}px)`);
}

export function useIsTabletDown() {
  return useMediaQuery(`(max-width: ${BP_TABLET}px)`);
}

export function useIsCoarsePointer() {
  return useMediaQuery('(pointer: coarse)');
}

/**
 * Escribe data-layout / data-pointer en <html> para CSS (Fase 1+).
 * Montar una sola vez cerca de la raíz (App).
 */
export function useLayoutDataAttrs() {
  const isPhone = useIsPhone();
  const isTabletDown = useIsTabletDown();
  const isCoarse = useIsCoarsePointer();

  useEffect(() => {
    const root = document.documentElement;
    const layout = isPhone ? 'phone' : isTabletDown ? 'tablet' : 'desktop';
    root.setAttribute('data-layout', layout);
    root.setAttribute('data-pointer', isCoarse ? 'coarse' : 'fine');
    return () => {
      root.removeAttribute('data-layout');
      root.removeAttribute('data-pointer');
    };
  }, [isPhone, isTabletDown, isCoarse]);

  return { isPhone, isTabletDown, isCoarse };
}
