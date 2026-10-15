'use client';

import { useProgress } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import * as THREE from 'three';
import { urlModelo, type Desarrollo } from '@/content/desarrollos';
import { useCurtain } from '@/components/transition/curtain-store';
import { Hud } from './Hud';
import { useExperience } from './store';
import { World } from './World';
import { isSoftwareRenderer } from './renderer';
import styles from './Experience.module.css';

// Recorrido 3D de un desarrollo. Se carga bajo demanda (next/dynamic) para que el mapa no
// descargue Three.js.

function ProgressBridge() {
  const { progress, active } = useProgress();
  useEffect(() => {
    if (active) useCurtain.getState().setProgress(progress);
  }, [progress, active]);
  return null;
}

// Con el teléfono vertical, 58° de campo vertical dejan ver muy poco a los costados: se abre hasta
// ver unos 62° de ancho, con tope en 85° para no deformar la imagen.
const FOV = 58;
function ResponsiveFov() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  useEffect(() => {
    const wide = THREE.MathUtils.degToRad(62);
    const fov = aspect < 1 ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(wide / 2) / aspect)) : FOV;
    camera.fov = THREE.MathUtils.clamp(fov, FOV, 85);
    camera.updateProjectionMatrix();
  }, [camera, aspect]);
  return null;
}

export default function Experience({ desarrollo, debug = false }: { desarrollo: Desarrollo; debug?: boolean }) {
  const url = urlModelo(desarrollo.recorrido3d!.modelo);
  // No se dibuja hasta que los shaders están compilados: dibujar antes obliga al navegador a
  // esperar la compilación (en Windows/Direct3D puede congelar la página varios segundos).
  const [ready, setReady] = useState(false);
  const [rendererReady, setRendererReady] = useState(false);
  const quality = useExperience((s) => s.quality);
  const touch = useExperience((s) => s.touch);

  useLayoutEffect(() => {
    useExperience.getState().reset();
    return () => {
      if (document.pointerLockElement) document.exitPointerLock();
      useExperience.getState().reset();
    };
  }, []);

  const onReady = useCallback(() => {
    setReady(true);
    useExperience.getState().setPhase('intro');
    // Un cuadro de margen para que la primera imagen ya esté dibujada al abrir la cortina.
    requestAnimationFrame(() => setTimeout(() => useCurtain.getState().reveal(), 120));
  }, []);

  return (
    <div className={styles.root} data-touch={touch || undefined}>
      <div id="marq-lock-target" className={styles.canvas}>
        <Canvas
          shadows={quality === 'alta' ? 'percentage' : false}
          frameloop={ready ? 'always' : 'never'}
          // En el teléfono, DPR 1 se ve borroso (pantallas de 3×); 1,5 sigue siendo liviano.
          dpr={[1, quality === 'alta' || touch ? 1.5 : 1]}
          camera={{ fov: FOV, near: 0.06, far: 1500 }}
          // Sin antialiasing propio: lo hace el búfer del postproceso (ArchvizPost). Tener los dos
          // duplicaba memoria de video y trabajo en cada cuadro.
          gl={{ antialias: false, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            // Se consulta el contexto que dibujará la escena, sin crear otro canvas.
            const software = isSoftwareRenderer(gl.getContext());
            useExperience.getState().setSoftwareRenderer(software);
            if (software) {
              gl.shadowMap.enabled = false;
              gl.setPixelRatio(1);
            }
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
            setRendererReady(true);
          }}
        >
          <ResponsiveFov />
          <Suspense fallback={null}>
            {rendererReady && <World url={url} debug={debug} onReady={onReady} />}
          </Suspense>
        </Canvas>
      </div>
      <ProgressBridge />
      <Hud desarrollo={desarrollo} />
    </div>
  );
}
