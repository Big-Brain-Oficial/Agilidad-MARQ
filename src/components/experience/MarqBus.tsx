'use client';

import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useExperience } from './store';
import { BUS, BUS_DOOR } from './prepareWorld';

// El MARQ Bus: portal de salida del recorrido. Colectivo urbano de piso bajo estacionado junto al
// cordón, con el frente hacia +x y las puertas del lado de la vereda (-z). Subirse (E) vuelve al mapa.

const L = BUS.length, W = BUS.width;
/** Piso de la carrocería, techo y radio del canto redondeado (bevel de la extrusión). */
const Y0 = 0.3, Y1 = 3.05, BEVEL = 0.1;
const WHEEL_R = 0.505, WHEEL_Y = 0.5, ARCH_R = 0.6;
/** Ejes: voladizo delantero largo para que la puerta (BUS_DOOR) quede delante de la rueda. */
const AXLES = [2.35, -3.25];
/** El frente se inclina hacia atrás entre estas alturas (parabrisas apenas tumbado). */
const RAKE = { y0: 0.55, y1: 2.5, back: 0.12 };
const RAKE_ANGLE = Math.atan2(RAKE.back, RAKE.y1 - RAKE.y0);
const WINDOWS = { y0: 1.3, y1: 2.68 };
const DOORS = [BUS_DOOR.x, -1.85];
const DOOR_W = 1.1;
const SIDE = W / 2;

function textTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number, font: string) => void, w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const paint = () => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const font = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim() || 'sans-serif';
    ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h, font);
    texture.needsUpdate = true;
  };
  paint();
  // Repinta cuando termina de cargar la tipografía de la marca.
  void document.fonts?.ready.then(paint);
  return texture;
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, value: string) {
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = value;
}

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/**
 * Carrocería: silueta lateral (frente inclinado, techo abovedado y pasarruedas) extruida a lo ancho.
 * El bevel redondea todos los cantos; por eso la silueta se dibuja achicada en BEVEL.
 */
function bodyGeometry() {
  const b = BEVEL;
  const xf = L / 2 - b, xr = -L / 2 + b, yb = Y0 + b, yt = Y1 - b;
  const rFront = 0.45, rRear = 0.35, rLow = 0.15;
  const s = new THREE.Shape();
  s.moveTo(xr + rLow, yb);
  // Pasarruedas, de atrás hacia adelante (el contorno se recorre en sentido antihorario).
  for (const ax of [...AXLES].sort((a, c) => a - c)) {
    const r = ARCH_R + b;
    const dy = yb - WHEEL_Y;
    const dx = Math.sqrt(r * r - dy * dy);
    const a = Math.atan2(dy, dx);
    s.lineTo(ax - dx, yb);
    s.absarc(ax, WHEEL_Y, r, Math.PI - a, a, true);
  }
  s.lineTo(xf - rLow, yb);
  s.quadraticCurveTo(xf, yb, xf, yb + rLow);
  s.lineTo(xf - RAKE.back, RAKE.y1);
  s.quadraticCurveTo(xf - RAKE.back, yt, xf - RAKE.back - rFront, yt);
  s.lineTo(xr + rRear, yt);
  s.quadraticCurveTo(xr, yt, xr, yt - rRear);
  s.lineTo(xr, yb + rLow);
  s.quadraticCurveTo(xr, yb, xr + rLow, yb);
  const depth = W - 2 * b;
  return new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 5,
    curveSegments: 28,
  }).translate(0, 0, -depth / 2);
}

/** Cubierta: perfil de banda de rodamiento con hombros redondeados, girado alrededor del eje. */
function tireGeometry() {
  const p = [
    [0.31, -0.15], [0.43, -0.157], [0.48, -0.14], [0.5, -0.11], [WHEEL_R, -0.06],
    [WHEEL_R, 0.06], [0.5, 0.11], [0.48, 0.14], [0.43, 0.157], [0.31, 0.15],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(p, 40).rotateX(Math.PI / 2);
}

/** Tramos vidriados de cada costado, partidos en paños de ~1,45 m con parantes entre medio. */
function sidePanes(side: 1 | -1) {
  const x0 = -L / 2 + 0.33, x1 = L / 2 - 0.33, gap = 0.075;
  const cuts = side < 0 ? DOORS.map((x) => [x - DOOR_W / 2 - 0.1, x + DOOR_W / 2 + 0.1]).sort((a, c) => a[0] - c[0]) : [];
  const spans: [number, number][] = [];
  let from = x0;
  for (const [a, c] of cuts) {
    spans.push([from, a]);
    from = c;
  }
  spans.push([from, x1]);
  return spans.flatMap(([a, c]) => {
    const n = Math.max(1, Math.round((c - a) / 1.45));
    const w = (c - a - (n - 1) * gap) / n;
    return Array.from({ length: n }, (_, i) => ({
      x: a + w / 2 + i * (w + gap),
      geometry: new THREE.ShapeGeometry(roundedRect(w, WINDOWS.y1 - WINDOWS.y0 - 0.1, 0.07), 6),
    }));
  });
}

function makeMaterials() {
  return {
    paint: new THREE.MeshStandardMaterial({ color: '#f4f3ef', roughness: 0.3, metalness: 0.08 }),
    // Vidrio polarizado opaco: sin interior que mostrar, refleja el cielo del entorno.
    glass: new THREE.MeshStandardMaterial({ color: '#5a6872', roughness: 0.06, metalness: 0.9, envMapIntensity: 1.6 }),
    aluminum: new THREE.MeshStandardMaterial({ color: '#8c9196', roughness: 0.35, metalness: 0.8 }),
    black: new THREE.MeshStandardMaterial({ color: '#111214', roughness: 0.55 }),
    trim: new THREE.MeshStandardMaterial({ color: '#2b2d30', roughness: 0.7 }),
    red: new THREE.MeshStandardMaterial({ color: '#A4070F', roughness: 0.38 }),
    tire: new THREE.MeshStandardMaterial({ color: '#161616', roughness: 0.9 }),
    rim: new THREE.MeshStandardMaterial({ color: '#c9cbcd', roughness: 0.28, metalness: 0.7 }),
    well: new THREE.MeshStandardMaterial({ color: '#0d0d0d', roughness: 1, side: THREE.DoubleSide }),
    roof: new THREE.MeshStandardMaterial({ color: '#e6e4de', roughness: 0.45 }),
    headlight: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff6e0', emissiveIntensity: 1.2 }),
    amber: new THREE.MeshStandardMaterial({ color: '#c77800', emissive: '#ff9a1f', emissiveIntensity: 0.5 }),
    tail: new THREE.MeshStandardMaterial({ color: '#7a0b10', emissive: '#ff2030', emissiveIntensity: 0.8 }),
    // Marco de la puerta delantera: brilla cuando el visitante está cerca (ver useFrame).
    glow: new THREE.MeshStandardMaterial({ color: '#A4070F', emissive: '#ff2a35', emissiveIntensity: 0.25 }),
  };
}

function makeGeometries() {
  const shape = (w: number, h: number, r: number) => new THREE.ShapeGeometry(roundedRect(w, h, r), 6);
  return {
    body: bodyGeometry(),
    tire: tireGeometry(),
    rim: new THREE.CylinderGeometry(0.315, 0.315, 0.29, 32).rotateX(Math.PI / 2),
    hub: new THREE.CylinderGeometry(0.11, 0.13, 0.33, 20).rotateX(Math.PI / 2),
    rimDish: new THREE.RingGeometry(0.15, 0.27, 32),
    // Interior del pasarruedas y su moldura negra sobre el costado.
    well: new THREE.CylinderGeometry(ARCH_R - 0.005, ARCH_R - 0.005, W - 0.08, 28, 1, true, Math.PI / 2 - 0.35, Math.PI + 0.7).rotateX(Math.PI / 2),
    archTrim: new THREE.RingGeometry(ARCH_R, ARCH_R + 0.05, 28, 1, -0.2, Math.PI + 0.4),
    band: shape(L - 0.56, WINDOWS.y1 - WINDOWS.y0 + 0.04, 0.1),
    stripe: new THREE.PlaneGeometry(L - 0.5, 0.09),
    doorFrame: shape(DOOR_W + 0.08, WINDOWS.y1 - Y0 - 0.02, 0.05),
    // Hoja de aluminio con un paño alto y uno bajo, separados por el travesaño.
    doorLeaf: shape(DOOR_W / 2 - 0.05, WINDOWS.y1 - Y0 - 0.14, 0.04),
    doorPane: shape(DOOR_W / 2 - 0.13, 1.4, 0.03),
    doorPaneLow: shape(DOOR_W / 2 - 0.13, 0.62, 0.03),
    windshieldFrame: shape(W - 0.19, 1.48, 0.14),
    windshield: shape(W - 0.27, 1.4, 0.11),
    sign: new THREE.PlaneGeometry(1.9, 0.24),
    signBack: shape(2.02, 0.32, 0.03),
    headlightHousing: shape(0.5, 0.21, 0.06),
    headlight: shape(0.42, 0.14, 0.05),
    indicator: shape(0.12, 0.14, 0.03),
    rearWindowFrame: shape(1.98, 0.7, 0.1),
    rearWindow: shape(1.88, 0.6, 0.08),
    grille: shape(1.7, 0.55, 0.06),
    tailLight: shape(0.2, 0.66, 0.06),
    frontLabel: new THREE.PlaneGeometry(1.0, 0.166),
    rearLabel: new THREE.PlaneGeometry(1.3, 0.216),
    sideLabel: new THREE.PlaneGeometry(2.8, 0.47),
    // Espejos «orejas de conejo»: brazo que sale del techo hacia adelante y baja frente al parabrisas.
    mirrorArm: new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(L / 2 - 0.28, 2.82, SIDE - 0.08),
        new THREE.Vector3(L / 2 + 0.08, 2.96, SIDE + 0.04),
        new THREE.Vector3(L / 2 + 0.3, 2.78, SIDE + 0.12),
        new THREE.Vector3(L / 2 + 0.33, 2.5, SIDE + 0.13),
      ]),
      24, 0.022, 8
    ),
  };
}

export function MarqBus({ position }: { position: THREE.Vector3 }) {
  const sideLabel = useMemo(
    () =>
      textTexture((ctx, w, h, font) => {
        ctx.fillStyle = '#1d1d1f';
        ctx.font = `800 120px ${font}`;
        ctx.textBaseline = 'middle';
        setLetterSpacing(ctx, '18px');
        ctx.fillText('MARQ', 40, h / 2 + 6);
        const mw = ctx.measureText('MARQ').width;
        setLetterSpacing(ctx, '0px');
        ctx.font = `500 110px ${font}`;
        ctx.fillStyle = '#A4070F';
        ctx.fillText('Bus', 40 + mw + 40, h / 2 + 6);
      }, 1024, 170),
    []
  );

  // Cartel de destino LED: texto ámbar y una grilla oscura encima que marca los puntos.
  const sign = useMemo(
    () =>
      textTexture((ctx, w, h, font) => {
        ctx.fillStyle = '#0b0b0b';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ffb547';
        ctx.shadowColor = '#ff9a1f';
        ctx.shadowBlur = 10;
        ctx.font = `700 84px ${font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        setLetterSpacing(ctx, '8px');
        ctx.fillText('CIUDAD MARQ', w / 2, h / 2 + 4);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(11, 11, 11, 0.6)';
        for (let x = 0; x < w; x += 6) ctx.fillRect(x, 0, 2, h);
        for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 2);
      }, 1024, 128),
    []
  );

  const m = useMemo(makeMaterials, []);
  const g = useMemo(makeGeometries, []);
  const panes = useMemo(() => ({ 1: sidePanes(1), [-1]: sidePanes(-1) }), []);

  useEffect(() => () => {
    sideLabel.dispose();
    sign.dispose();
    for (const material of Object.values(m)) material.dispose();
    for (const geometry of Object.values(g)) geometry.dispose();
    for (const pane of [...panes[1], ...panes[-1]]) pane.geometry.dispose();
  }, [sideLabel, sign, m, g, panes]);

  // La puerta brilla cuando el visitante está lo bastante cerca para subir.
  useFrame(({ clock }) => {
    const near = useExperience.getState().prompt?.includes('MARQ Bus');
    m.glow.emissiveIntensity = near ? 1.4 + Math.sin(clock.elapsedTime * 5) * 0.6 : 0.25;
  });

  const winY = (WINDOWS.y0 + WINDOWS.y1) / 2;
  const doorH = WINDOWS.y1 - Y0;
  const doorY = Y0 + doorH / 2;
  const front = { x: L / 2, y: RAKE.y0 };

  return (
    <group position={position}>
      <mesh geometry={g.body} material={m.paint} castShadow receiveShadow />

      {/* Costados: banda negra de ventanillas, paños, franja roja MARQ, rótulo y pasarruedas. */}
      {([1, -1] as const).map((side) => {
        const z = side * SIDE;
        const ry = side > 0 ? 0 : Math.PI;
        return (
          <group key={side}>
            <mesh geometry={g.band} material={m.black} position={[0, winY, z + side * 0.003]} rotation-y={ry} />
            {panes[side].map(({ x, geometry }) => (
              <mesh key={x} geometry={geometry} material={m.glass} position={[x, winY, z + side * 0.006]} rotation-y={ry} />
            ))}
            <mesh geometry={g.stripe} material={m.red} position={[0, 1.19, z + side * 0.003]} rotation-y={ry} />
            <mesh geometry={g.sideLabel} position={[-0.45, 0.82, z + side * 0.01]} rotation-y={ry}>
              <meshBasicMaterial map={sideLabel} transparent toneMapped={false} />
            </mesh>
            {AXLES.map((ax) => (
              <mesh key={ax} geometry={g.archTrim} material={m.black} position={[ax, WHEEL_Y, z + side * 0.004]} rotation-y={ry} />
            ))}
          </group>
        );
      })}
      {AXLES.map((ax) => (
        <mesh key={ax} geometry={g.well} material={m.well} position={[ax, WHEEL_Y, 0]} />
      ))}

      {/* Puertas de dos hojas del lado de la vereda; solo la delantera lleva el marco luminoso. */}
      {DOORS.map((x, i) => (
        <group key={x} position={[x, doorY, -SIDE]} rotation-y={Math.PI}>
          <mesh geometry={g.doorFrame} material={m.black} position-z={0.008} />
          {[-1, 1].map((leaf) => (
            <group key={leaf} position={[leaf * (DOOR_W / 4 + 0.005), 0.03, 0]}>
              <mesh geometry={g.doorLeaf} material={m.aluminum} position-z={0.011} />
              <mesh geometry={g.doorPane} material={m.glass} position={[0, 0.38, 0.014]} />
              <mesh geometry={g.doorPaneLow} material={m.glass} position={[0, -0.72, 0.014]} />
            </group>
          ))}
          <mesh material={m.black} position-z={0.016}>
            <boxGeometry args={[0.03, doorH - 0.14, 0.01]} />
          </mesh>
          {i === 0 && (
            <>
              {[-1, 1].map((edge) => (
                <mesh key={edge} material={m.glow} position={[edge * (DOOR_W / 2 + 0.06), 0, 0.016]}>
                  <boxGeometry args={[0.05, doorH, 0.02]} />
                </mesh>
              ))}
              <mesh material={m.glow} position={[0, doorH / 2 + 0.035, 0.016]}>
                <boxGeometry args={[DOOR_W + 0.17, 0.05, 0.02]} />
              </mesh>
            </>
          )}
        </group>
      ))}

      {/* Frente, apoyado sobre el plano inclinado: parabrisas, cartel de destino, faros y limpiaparabrisas. */}
      <group position={[front.x, front.y, 0]} rotation-z={RAKE_ANGLE}>
        <group rotation-y={Math.PI / 2}>
          <mesh geometry={g.windshieldFrame} material={m.black} position={[0, 1.25, 0.004]} />
          <mesh geometry={g.windshield} material={m.glass} position={[0, 1.25, 0.008]} />
          <mesh geometry={g.signBack} material={m.black} position={[0, 1.76, 0.011]} />
          <mesh geometry={g.sign} position={[0, 1.76, 0.014]}>
            <meshBasicMaterial map={sign} toneMapped={false} />
          </mesh>
          {[-0.5, 0.25].map((x) => (
            <mesh key={x} material={m.black} position={[x, 0.66, 0.03]} rotation-z={0.18}>
              <boxGeometry args={[0.85, 0.025, 0.03]} />
            </mesh>
          ))}
          <mesh geometry={g.frontLabel} position={[0, 0.38, 0.004]}>
            <meshBasicMaterial map={sideLabel} transparent toneMapped={false} />
          </mesh>
          {[1, -1].map((s) => (
            <group key={s} position={[s * 0.8, 0.17, 0]}>
              <mesh geometry={g.headlightHousing} material={m.black} position-z={0.003} />
              <mesh geometry={g.headlight} material={m.headlight} position-z={0.006} />
              <mesh geometry={g.indicator} material={m.amber} position={[s * 0.36, 0, 0.004]} />
            </group>
          ))}
        </group>
      </group>
      <RoundedBox args={[0.16, 0.3, W - 0.04]} radius={0.06} smoothness={3} position={[L / 2 - 0.02, 0.44, 0]} material={m.trim} castShadow />

      {/* Espejos. */}
      {[1, -1].map((s) => (
        <group key={s} scale-z={s}>
          <mesh geometry={g.mirrorArm} material={m.black} castShadow />
          <RoundedBox args={[0.07, 0.42, 0.24]} radius={0.03} smoothness={2} position={[L / 2 + 0.33, 2.32, SIDE + 0.15]} material={m.black} castShadow />
        </group>
      ))}

      {/* Trasera: luneta, rejilla del motor, faros y paragolpes. */}
      <group position={[-L / 2, 0, 0]} rotation-y={-Math.PI / 2}>
        <mesh geometry={g.rearWindowFrame} material={m.black} position={[0, 2.2, 0.004]} />
        <mesh geometry={g.rearWindow} material={m.glass} position={[0, 2.2, 0.008]} />
        <mesh geometry={g.rearLabel} position={[0, 1.62, 0.004]}>
          <meshBasicMaterial map={sideLabel} transparent toneMapped={false} />
        </mesh>
        <mesh geometry={g.grille} material={m.black} position={[0, 0.98, 0.004]} />
        {[0.8, 0.9, 1.0, 1.1, 1.2].map((y) => (
          <mesh key={y} material={m.trim} position={[0, y - 0.04, 0.012]}>
            <boxGeometry args={[1.58, 0.035, 0.012]} />
          </mesh>
        ))}
        {[1, -1].map((s) => (
          <group key={s} position={[s * 1.02, 1.0, 0]}>
            <mesh geometry={g.tailLight} material={m.tail} position-z={0.005} />
            <mesh geometry={g.indicator} material={m.amber} position={[0, 0.44, 0.005]} />
          </group>
        ))}
      </group>
      <RoundedBox args={[0.16, 0.3, W - 0.04]} radius={0.06} smoothness={3} position={[-L / 2 + 0.02, 0.44, 0]} material={m.trim} castShadow />

      {/* Ruedas: cubierta, llanta y maza. */}
      {AXLES.flatMap((x) =>
        [1, -1].map((side) => (
          <group key={`${x}${side}`} position={[x, WHEEL_Y, side * (SIDE - 0.18)]} scale-z={side}>
            <mesh geometry={g.tire} material={m.tire} castShadow />
            <mesh geometry={g.rim} material={m.rim} />
            <mesh geometry={g.rimDish} material={m.trim} position-z={0.147} />
            <mesh geometry={g.hub} material={m.rim} />
          </group>
        ))
      )}

      {/* Equipo de aire acondicionado y escotilla en el techo. */}
      <RoundedBox args={[3.2, 0.24, 1.9]} radius={0.08} smoothness={3} position={[-0.6, Y1 + 0.1, 0]} material={m.roof} castShadow />
      <RoundedBox args={[0.75, 0.07, 0.75]} radius={0.03} smoothness={2} position={[-4.1, Y1 + 0.02, 0]} material={m.roof} />
    </group>
  );
}
