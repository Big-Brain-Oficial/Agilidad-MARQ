'use client';

import { useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { EQUIPO } from '@/content/equipo';
import type { WorldData } from './prepareWorld';
import { useExperience } from './store';

// Cuadros del equipo en la pared derecha del hall (la de piedra, cara +x). Cada uno muestra la foto
// de una persona; apuntándole con la mira, un clic (o un toque) abre su perfil de LinkedIn. Reusa la
// mecánica de InfoMarkers: con el puntero capturado no hay cursor para tocar el DOM, así que la
// selección se resuelve por el ángulo entre la mira y el centro del cuadro.

// Pared derecha del hall: cara interior en x ≈ 2.98, mirando hacia -x. La grilla es de 4 columnas
// (sobre el eje z) por 2 filas (sobre el eje y): 4 arriba y 4 abajo.
const WALL_X = 2.97; // apenas por delante de la piedra para no competir en z-fighting
const COLS = [-1.7, -3.3, -4.9, -6.5]; // centros en z, de la entrada hacia el ascensor
const ROWS = [2.78, 1.75]; // centros en y: fila de arriba y fila de abajo
const FRAME_W = 0.62; // ancho del cuadro (sobre z)
const FRAME_H = 0.93; // alto del cuadro (sobre y)
const BORDER = 0.05; // marco alrededor de la foto
const DEPTH = 0.04; // espesor del cuadro

const SHOW = 12; // distancia desde la que se evalúa
const AIM_DISTANCE = 5; // hasta dónde se puede clickear
const AIM_ANGLE = 0.12; // radianes entre la mira y el centro del cuadro (~7°)

// Posición de cada cuadro según su lugar en la lista: primeros cuatro arriba, siguientes abajo.
const SLOTS = EQUIPO.map((m, i) => ({
  ...m,
  position: new THREE.Vector3(WALL_X, ROWS[Math.floor(i / COLS.length)], COLS[i % COLS.length]),
}));

const IMAGES = EQUIPO.map((m) => `/equipo/${m.id}.webp`);

// Se descargan junto con el resto de la escena, antes de abrir la cortina.
useTexture.preload(IMAGES);

export function Cuadros({ world }: { world: WorldData }) {
  const camera = useThree((s) => s.camera);
  const textures = useTexture(IMAGES);
  const ray = useRef(new THREE.Ray()).current;
  const forward = useRef(new THREE.Vector3()).current;

  // El marco y su material se comparten entre los ocho cuadros.
  const frameMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 0.6, metalness: 0.1 }),
    [],
  );

  const photoMaterials = useMemo(
    () =>
      textures.map((t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        // Las fotos son verticales (2:3): se recortan al marco sin deformar.
        return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, metalness: 0 });
      }),
    [textures],
  );

  useFrame(() => {
    const ui = useExperience.getState();
    const active = ui.phase === 'playing' && !ui.riding;
    let aim: (typeof SLOTS)[number] | null = null;
    let bestAngle = AIM_ANGLE;
    camera.getWorldDirection(forward);
    if (active) {
      for (const slot of SLOTS) {
        const distance = camera.position.distanceTo(slot.position);
        if (distance > SHOW || distance > AIM_DISTANCE) continue;
        ray.origin.copy(camera.position);
        ray.direction.subVectors(slot.position, camera.position).normalize();
        // Sin una pared entre los ojos y el cuadro (el BVH de colisiones alcanza).
        if (world.collider.raycastFirst(ray, THREE.DoubleSide, 0, Math.max(0, distance - 0.3))) continue;
        const angle = forward.angleTo(ray.direction);
        if (angle < bestAngle) {
          bestAngle = angle;
          aim = slot;
        }
      }
    }
    ui.setLinkAim(aim ? { nombre: aim.nombre, linkedin: aim.linkedin } : null);
  });

  return (
    <group>
      {SLOTS.map((slot, i) => (
        // Rotado para mirar hacia -x (el plano mira a +z por defecto).
        <group key={slot.id} position={slot.position} rotation={[0, -Math.PI / 2, 0]}>
          {/* Marco: una caja fina detrás de la foto. */}
          <mesh material={frameMaterial} castShadow>
            <boxGeometry args={[FRAME_W + BORDER, FRAME_H + BORDER, DEPTH]} />
          </mesh>
          {/* Foto, apenas por delante del marco. */}
          <mesh material={photoMaterials[i]} position={[0, 0, DEPTH / 2 + 0.002]}>
            <planeGeometry args={[FRAME_W, FRAME_H]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
