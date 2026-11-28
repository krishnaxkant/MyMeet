import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Interactive architectural background grid:
 * Invisible at rest; reveals crisp grid lines + subtle ambient glow around the mouse cursor.
 * Adapts automatically to Light/Dark mode and Basic (Cobalt) vs Pro (Champagne Gold/Violet) tiers.
 */
export function InteractiveGridBackground() {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const isActiveRoom = /^\/meet\/[^/]+\/room\/?$/i.test(location.pathname);

  useEffect(() => {
    if (isActiveRoom) return;
    const el = layerRef.current;
    if (!el) return;

    let rafId: number | null = null;
    let targetX = -999;
    let targetY = -999;
    let active = false;

    const flush = () => {
      rafId = null;
      el.style.setProperty('--mx', `${targetX}px`);
      el.style.setProperty('--my', `${targetY}px`);
      el.style.setProperty('--grid-alpha', active ? '1' : '0');
    };

    const scheduleFlush = () => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(flush);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      targetX = e.clientX;
      targetY = e.clientY;
      active = true;
      scheduleFlush();
    };

    const handlePointerLeave = () => {
      active = false;
      scheduleFlush();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('pointerleave', handlePointerLeave);
    window.addEventListener('blur', handlePointerLeave);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerleave', handlePointerLeave);
      window.removeEventListener('blur', handlePointerLeave);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [isActiveRoom]);

  if (isActiveRoom) return null;

  return (
    <div ref={layerRef} className="interactive-grid-layer" aria-hidden="true">
      <div className="interactive-grid-mesh" />
      <div className="interactive-grid-glow" />
    </div>
  );
}
