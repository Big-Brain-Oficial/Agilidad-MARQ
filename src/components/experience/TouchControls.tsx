'use client';

import { useEffect, useRef, type PointerEvent } from 'react';
import { FullscreenButton } from '@/components/ui/FullscreenButton';
import { useExperience } from './store';
import { touchInput } from './touchInput';
import styles from './Experience.module.css';

// Controles táctiles (Android, iPhone/iPad): un dedo en la mitad izquierda maneja un joystick que aparece
// donde se apoya; en la mitad derecha, arrastrar mira alrededor y tocar abre la información del
// objeto con el símbolo «i». Escriben en touchInput, que el visitante lee en cada cuadro.

const RADIUS = 56; // radio del aro del joystick, en px
const RUN_AT = 1.35; // estirar el pulgar más allá del aro hace correr
const TAP_MS = 300;
const TAP_PX = 10;

const pause = () => {
  touchInput.reset();
  if (useExperience.getState().phase === 'playing') useExperience.getState().setPhase('paused');
};

export function TouchControls() {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const stick = useRef<{ id: number; x: number; y: number } | null>(null);
  const look = useRef<{ id: number; x: number; y: number; t: number; moved: number } | null>(null);

  useEffect(() => {
    // Safari ignora user-scalable=no: el pellizco para hacer zoom se frena a mano.
    const block = (e: Event) => e.preventDefault();
    // Al pasar a otra app o bloquear el teléfono, el recorrido queda en pausa.
    const hidden = () => {
      if (document.hidden) pause();
    };
    document.addEventListener('gesturestart', block);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      document.removeEventListener('gesturestart', block);
      document.removeEventListener('visibilitychange', hidden);
      touchInput.reset();
    };
  }, []);

  const moveStick = (dx: number, dy: number) => {
    const distance = Math.hypot(dx, dy);
    const k = distance > RADIUS ? RADIUS / distance : 1;
    touchInput.moveX = (dx * k) / RADIUS;
    touchInput.moveY = (-dy * k) / RADIUS;
    touchInput.run = distance > RADIUS * RUN_AT;
    if (knob.current) knob.current.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    if (base.current) base.current.dataset.run = touchInput.run ? 'true' : 'false';
  };

  const endStick = () => {
    stick.current = null;
    touchInput.moveX = touchInput.moveY = 0;
    touchInput.run = false;
    if (knob.current) knob.current.style.transform = '';
    const el = base.current;
    if (el) {
      el.style.left = el.style.top = el.style.bottom = '';
      delete el.dataset.active;
      el.dataset.run = 'false';
    }
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!stick.current && e.clientX < window.innerWidth / 2) {
      // El joystick se centra donde se apoya el pulgar.
      stick.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      const el = base.current;
      if (el) {
        el.style.left = `${e.clientX - RADIUS}px`;
        el.style.top = `${e.clientY - RADIUS}px`;
        el.style.bottom = 'auto';
        el.dataset.active = 'true';
      }
    } else if (!look.current) {
      look.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
    }
  };

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (stick.current?.id === e.pointerId) moveStick(e.clientX - stick.current.x, e.clientY - stick.current.y);
    const l = look.current;
    if (l?.id === e.pointerId) {
      const dx = e.clientX - l.x;
      const dy = e.clientY - l.y;
      touchInput.lookX += dx;
      touchInput.lookY += dy;
      l.moved += Math.abs(dx) + Math.abs(dy);
      l.x = e.clientX;
      l.y = e.clientY;
    }
  };

  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (stick.current?.id === e.pointerId) endStick();
    const l = look.current;
    if (l?.id === e.pointerId) {
      look.current = null;
      // Un toque corto, sin arrastrar, vale como el clic: abre o cierra la tarjeta del objeto.
      if (e.type === 'pointerup' && l.moved < TAP_PX && performance.now() - l.t < TAP_MS) {
        const ui = useExperience.getState();
        if (ui.aim) ui.toggleInfo(ui.aim);
        else if (ui.info || ui.infoOpen) ui.toggleInfo();
      }
    }
  };

  return (
    <>
      <div
        className={styles.touchLayer}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onLostPointerCapture={onUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div ref={base} className={styles.stick} data-run="false" aria-hidden="true">
        <div ref={knob} className={styles.stickKnob} />
      </div>
      <div className={styles.topButtons}>
        <MinimizeButton />
        <FullscreenButton className={styles.topButton} />
        <button type="button" className={styles.topButton} onClick={pause} aria-label="Pausa">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
          </svg>
        </button>
      </div>
    </>
  );
}

// Pliega el HUD decorativo (marca, zona, ayuda) para despejar la pantalla sin pausar el recorrido.
function MinimizeButton() {
  const minimo = useExperience((s) => s.hudMinimo);
  return (
    <button
      type="button"
      className={styles.topButton}
      onClick={() => useExperience.getState().toggleHudMinimo()}
      aria-pressed={minimo}
      aria-label={minimo ? 'Mostrar la información en pantalla' : 'Ocultar la información para despejar la pantalla'}
    >
      {minimo ? (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3l18 18M10.6 5.2A9 9 0 0 1 12 5c5.5 0 9 7 9 7a16 16 0 0 1-2.6 3.3M6.5 6.6A16 16 0 0 0 3 12s3.5 7 9 7a9 9 0 0 0 3.3-.6M9.9 9.9a2.5 2.5 0 0 0 3.5 3.5" />
        </svg>
      )}
    </button>
  );
}
