'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './FullscreenButton.module.css';

// Botón de pantalla completa compartido por el mapa y el recorrido 3D.
// Usa la Fullscreen API del navegador: no aparece donde no está disponible
// (en iPhone Safari no existe, justo el caso que la issue quería mejorar).

/** `null` mientras no se sabe; luego indica si el navegador soporta pantalla completa. */
function useFullscreen() {
  const [soportado, setSoportado] = useState(false);
  const [activo, setActivo] = useState(false);

  useEffect(() => {
    setSoportado(Boolean(document.fullscreenEnabled));
    const onChange = () => setActivo(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const alternar = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  return { soportado, activo, alternar };
}

// `className` reemplaza el estilo base para encajar en otro grupo de controles (p. ej. el HUD 3D).
export function FullscreenButton({ className }: { className?: string }) {
  const { soportado, activo, alternar } = useFullscreen();
  if (!soportado) return null;

  return (
    <button
      type="button"
      className={className ?? styles.fullscreen}
      onClick={alternar}
      aria-pressed={activo}
      aria-label={activo ? 'Salir de pantalla completa' : 'Pantalla completa'}
      title={activo ? 'Salir de pantalla completa' : 'Pantalla completa'}
    >
      {activo ? (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 4v4a1 1 0 0 1-1 1H4M20 9h-4a1 1 0 0 1-1-1V4M15 20v-4a1 1 0 0 1 1-1h4M4 15h4a1 1 0 0 1 1 1v4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" />
        </svg>
      )}
    </button>
  );
}
