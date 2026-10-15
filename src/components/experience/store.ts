'use client';

import { create } from 'zustand';
import type { ZonaId } from '@/content/recorridos';

// Estado compartido entre la escena 3D (dentro del <Canvas>) y la interfaz HTML.

export type Phase = 'loading' | 'intro' | 'playing' | 'paused' | 'leaving';

interface ExperienceState {
  phase: Phase;
  zona: ZonaId;
  /** Texto de la acción disponible (tecla E), o null. */
  prompt: string | null;
  riding: boolean;
  /** Objeto con información que se está mirando (tecla I), o null. */
  info: string | null;
  /** Objeto cuya tarjeta de información está abierta, o null. */
  infoOpen: string | null;
  /** Objeto cuyo símbolo «i» está bajo la mira (se abre con un clic), o null. */
  aim: string | null;
  /** El navegador rechazó capturar el mouse (se puede reintentar con otro clic). */
  lockError: boolean;
  /** Bloquea el puntero (lo registra el control de primera persona). En táctil sólo empieza a jugar. */
  lock: () => void;
  /** Controles táctiles (iPhone/iPad) en lugar de mouse y teclado. */
  touch: boolean;
  setTouch: (touch: boolean) => void;
  /** Ejecuta la acción disponible, como la tecla E (lo registra el visitante). */
  interact: () => void;
  setInteract: (interact: () => void) => void;
  quality: 'alta' | 'fluida';
  softwareRenderer: boolean;
  setSoftwareRenderer: (softwareRenderer: boolean) => void;
  atmosphere: 'dia' | 'tarde';
  views: { id: string; label: string }[];
  visit: (id: string) => void;
  setVisit: (visit: (id: string) => void, views: { id: string; label: string }[]) => void;
  setQuality: (quality: 'alta' | 'fluida') => void;
  setAtmosphere: (atmosphere: 'dia' | 'tarde') => void;
  setPhase: (phase: Phase) => void;
  setZona: (zona: ZonaId) => void;
  setPrompt: (prompt: string | null) => void;
  setRiding: (riding: boolean) => void;
  setInfo: (info: string | null) => void;
  setAim: (aim: string | null) => void;
  /** Abre la tarjeta del objeto indicado (o del que se mira), o cierra la que está abierta. */
  toggleInfo: (id?: string) => void;
  closeInfo: () => void;
  setLockError: (lockError: boolean) => void;
  setLock: (lock: () => void) => void;
  leave: () => void;
  reset: () => void;
}

export const useExperience = create<ExperienceState>((set, get) => ({
  phase: 'loading',
  zona: 'exterior',
  prompt: null,
  riding: false,
  info: null,
  infoOpen: null,
  aim: null,
  lockError: false,
  lock: () => {},
  // Táctil arranca en «Fluida»: sin SSAO ni sombras, que en el teléfono cuestan batería y memoria.
  touch: false,
  setTouch: (touch) => set(touch ? { touch, quality: 'fluida' } : { touch }),
  interact: () => {},
  setInteract: (interact) => set({ interact }),
  quality: 'alta',
  softwareRenderer: false,
  setSoftwareRenderer: (softwareRenderer) => set(softwareRenderer ? { softwareRenderer, quality: 'fluida' } : { softwareRenderer }),
  atmosphere: 'dia',
  views: [],
  visit: () => {},
  setVisit: (visit, views) => set({ visit, views }),
  setQuality: (quality) => set({ quality }),
  setAtmosphere: (atmosphere) => set({ atmosphere }),
  setPhase: (phase) => set(phase === 'playing' ? { phase, lockError: false } : { phase }),
  setZona: (zona) => set({ zona }),
  setPrompt: (prompt) => {
    if (get().prompt !== prompt) set({ prompt });
  },
  setRiding: (riding) => set({ riding }),
  setInfo: (info) => {
    if (get().info !== info) set({ info });
  },
  setAim: (aim) => {
    if (get().aim !== aim) set({ aim });
  },
  toggleInfo: (id) => set(({ info, infoOpen }) => ({ infoOpen: infoOpen ? null : (id ?? info) })),
  closeInfo: () => {
    if (get().infoOpen) set({ infoOpen: null });
  },
  setLockError: (lockError) => set({ lockError }),
  setLock: (lock) => set({ lock }),
  leave: () => {
    if (get().phase === 'leaving') return;
    set({ phase: 'leaving', prompt: null, info: null, infoOpen: null, aim: null });
    if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock();
  },
  reset: () => set({ phase: 'loading', zona: 'exterior', prompt: null, riding: false, info: null, infoOpen: null, aim: null, lockError: false, views: [], visit: () => {}, lock: () => {}, interact: () => {} }),
}));
