import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Mide la toolbar sticky (Grupos / Usuarios) y expone
 * `--cc-admin-sticky-toolbar-h` para el `top` del thead.
 */
export default function useAdminStickyToolbarHeight() {
  const toolbarRef = useRef(null);
  const [heightPx, setHeightPx] = useState(54);

  useLayoutEffect(() => {
    const el = toolbarRef.current;
    if (!el) return undefined;

    const apply = () => {
      const next = Math.ceil(el.getBoundingClientRect().height);
      if (next > 0) setHeightPx((prev) => (prev === next ? prev : next));
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return {
    toolbarRef,
    stickyPageStyle: { ['--cc-admin-sticky-toolbar-h']: `${heightPx}px` },
  };
}
