'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCurtain } from '@/components/transition/curtain-store';
import styles from './UnrealExperience.module.css';

export function UnrealExperience({ playerUrl }: { playerUrl: string | null }) {
  const [opened, setOpened] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { useCurtain.getState().reveal(); }, []);

  return (
    <main className={opened ? styles.session : styles.page}>
      {opened && playerUrl ? (
        <>
          <header className={styles.toolbar}>
            <strong>Natalini <span>· Prototipo Unreal</span></strong>
            <div className={styles.actions}>
              <button type="button" onClick={() => setAttempt((value) => value + 1)}>Reconectar</button>
              <a href={playerUrl} target="_blank" rel="noopener noreferrer">Abrir aparte ↗</a>
              <button type="button" onClick={() => setOpened(false)}>Cerrar sesión</button>
            </div>
          </header>
          <iframe key={attempt} className={styles.player} src={playerUrl}
            title="Recorrido de Torre Natalini con Unreal Engine"
            allow="autoplay; fullscreen; pointer-lock" allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-pointer-lock" referrerPolicy="no-referrer" />
          <p className={styles.sessionHint}>El reproductor indica el estado de conexión. Si no aparece, probá «Abrir aparte» o volvé a conectar cuando la sesión esté encendida.</p>
        </>
      ) : (
        <div className={styles.content}>
          <Link href="/evaluacion/natalini" className={styles.back}>← Comparar experiencias</Link>
          <p className={styles.kicker}>MARQ · Prototipo visual</p>
          <h1>Natalini en Unreal Engine</h1>
          <p className={styles.lead}>Explorá el edificio con iluminación dinámica y materiales físicos. Esta versión permite evaluar su aspecto y su fluidez.</p>
          <section className={styles.card}>
            <h2>{playerUrl ? 'Abrí la experiencia' : 'La sesión todavía no está preparada'}</h2>
            <p>{playerUrl
              ? 'La experiencia se transmite desde el equipo que ejecuta Unreal. Al abrirla, el reproductor te indicará si está disponible.'
              : 'Estamos preparando el proyecto de Unreal y su conexión. Mientras tanto, podés recorrer la versión web.'}</p>
            {playerUrl && <button className="btn btn-primary" type="button" onClick={() => setOpened(true)}>Abrir Unreal</button>}
            <Link className="btn btn-ghost" href="/recorrido/torre-natalini">Abrir versión Three.js</Link>
          </section>
          <p className={styles.note}>Navegación libre con mouse y teclado: WASD para moverte, E para subir y Q para bajar. El ascensor, las puertas automáticas y el panel informativo están pendientes de adaptación.</p>
        </div>
      )}
    </main>
  );
}
