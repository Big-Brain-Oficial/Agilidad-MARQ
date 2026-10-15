'use client';

import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { OBJETOS_NATALINI } from '@/content/recorridos';
import type { WorldData } from './prepareWorld';
import { useExperience } from './store';
import styles from './Experience.module.css';

// Símbolo «i» flotando sobre los objetos con información. Se ve de lejos si no hay una pared en el
// medio; al acercarse se resalta y la tecla I o un clic abren la tarjeta del objeto (Hud). Apuntándole
// con la mira, el clic la abre desde más lejos: con el puntero capturado no hay cursor para tocar el DOM.

const SHOW = 12; // distancia desde la que se ve el símbolo
const NEAR = 2.5; // distancia horizontal a la que la tecla I abre la tarjeta
const CLOSE = 4.5; // más lejos, la tarjeta abierta se cierra sola
const AIM_DISTANCE = 4; // hasta dónde se puede clickear (menos que CLOSE, para que no se cierre enseguida)
const AIM_ANGLE = 0.12; // radianes entre la mira y el símbolo (~7°)

const OBJETOS = OBJETOS_NATALINI.map((o) => ({ id: o.id, position: new THREE.Vector3(...o.marcador) }));

type State = 'oculto' | 'lejos' | 'cerca' | 'apuntado';

export function InfoMarkers({ world }: { world: WorldData }) {
  const camera = useThree((s) => s.camera);
  const markers = useRef<(HTMLDivElement | null)[]>([]);
  const states = useRef<State[]>([]);
  const ray = useRef(new THREE.Ray()).current;
  const forward = useRef(new THREE.Vector3()).current;

  useFrame(() => {
    const ui = useExperience.getState();
    const active = ui.phase === 'playing' && !ui.riding;
    let seen: string | null = null;
    let best = NEAR;
    let aim: string | null = null;
    let bestAngle = AIM_ANGLE;
    camera.getWorldDirection(forward);
    OBJETOS.forEach((o, i) => {
      const distance = camera.position.distanceTo(o.position);
      let visible = active && distance < SHOW;
      if (visible) {
        // Sin una pared entre los ojos y el símbolo (el BVH de colisiones alcanza).
        ray.origin.copy(camera.position);
        ray.direction.subVectors(o.position, camera.position).normalize();
        visible = !world.collider.raycastFirst(ray, THREE.DoubleSide, 0, Math.max(0, distance - 0.3));
      }
      const flat = Math.hypot(camera.position.x - o.position.x, camera.position.z - o.position.z);
      const near = visible && flat < best;
      if (near) {
        seen = o.id;
        best = flat;
      }
      let aimed = false;
      if (visible && distance < AIM_DISTANCE) {
        const angle = forward.angleTo(ray.direction);
        aimed = angle < bestAngle;
        if (aimed) {
          aim = o.id;
          bestAngle = angle;
        }
      }
      // Se escribe en el DOM solo al cambiar: no hace falta volver a dibujar React en cada cuadro.
      const state: State = !visible ? 'oculto' : aimed ? 'apuntado' : flat < NEAR ? 'cerca' : 'lejos';
      const el = markers.current[i];
      if (el && states.current[i] !== state) {
        states.current[i] = state;
        el.dataset.state = state;
      }
    });
    ui.setInfo(seen);
    ui.setAim(aim);
    const open = OBJETOS.find((o) => o.id === ui.infoOpen);
    if (open && (ui.riding || camera.position.distanceTo(open.position) > CLOSE)) ui.closeInfo();
  });

  return OBJETOS.map((o, i) => (
    // zIndexRange en 0: el símbolo queda debajo del HUD y de los paneles de inicio y pausa.
    <Html key={o.id} position={o.position} center zIndexRange={[0, 0]} pointerEvents="none">
      <div ref={(el) => { markers.current[i] = el; }} className={styles.marker} data-state="oculto" aria-hidden="true">
        i
      </div>
    </Html>
  ));
}
