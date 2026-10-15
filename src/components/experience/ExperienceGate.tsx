'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DESARROLLOS } from '@/content/desarrollos';
import { useCurtain, useCurtainNavigate } from '@/components/transition/curtain-store';
import { useExperience } from './store';
import { hasTouchInput } from './touchInput';
import styles from './Experience.module.css';

// Decide si se puede abrir el recorrido 3D (computadoras con mouse y teclado, y pantallas con
// controles táctiles) y lo carga bajo demanda.

const Experience = dynamic(() => import('./Experience'), { ssr: false });

type Support = 'checking' | 'ok' | 'touch' | 'mobile' | 'no-webgl';

function detect(): Support {
  const canvas = document.createElement('canvas');
  if (!canvas.getContext('webgl2')) return 'no-webgl';
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  if (finePointer && window.innerWidth >= 900) return 'ok';
  // Un equipo con mouse y pantalla amplia entra por arriba; los teléfonos y tablets usan tacto.
  return hasTouchInput() ? 'touch' : 'mobile';
}

export function ExperienceGate({ desarrolloId }: { desarrolloId: string }) {
  const desarrollo = DESARROLLOS.find((d) => d.id === desarrolloId)!;
  const debug = useSearchParams().has('debug');
  const navigate = useCurtainNavigate();
  const [support, setSupport] = useState<Support>('checking');

  useEffect(() => {
    // Visita directa por URL: la cortina hace de pantalla de carga.
    const curtain = useCurtain.getState();
    if (curtain.status === 'hidden') curtain.coverNow(`Entrando a ${desarrollo.nombre}`);
    const result = detect();
    useExperience.getState().setTouch(result === 'touch');
    setSupport(result);
    if (result !== 'ok' && result !== 'touch') curtain.reveal();
  }, [desarrollo.nombre]);

  if (support === 'ok' || support === 'touch') return <Experience desarrollo={desarrollo} debug={debug} />;
  if (support === 'checking') return null;

  return (
    <main className={styles.mobile}>
      <div className={styles.panel}>
        <span className={styles.kicker}>Recorrido 3D · {desarrollo.nombre}</span>
        <h1>{support === 'no-webgl' ? 'Abrilo en otro navegador' : 'Usá una pantalla táctil o una computadora'}</h1>
        <p>
          {support === 'no-webgl'
            ? 'Tu navegador no permite gráficos 3D (WebGL 2). Probá con una versión actualizada de Chrome, Edge, Firefox o Safari.'
            : 'El recorrido se puede manejar con teclado y mouse, o con controles táctiles en Android, iPhone y iPad. En este equipo podés seguir explorando el mapa de desarrollos.'}
        </p>
        <button type="button" className="btn btn-primary" onClick={() => void navigate('/', 'Volviendo al mapa')}>
          Volver al mapa
        </button>
      </div>
    </main>
  );
}
