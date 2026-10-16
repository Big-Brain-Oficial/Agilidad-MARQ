import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCollider, resolveCapsule } from './collision';

/** Hoja batiente independiente del BVH estático, con bisagra del lado del dormitorio. */
export function buildApartmentDoor(scene: THREE.Object3D, anchor: THREE.Object3D, panel: THREE.Material, metal: THREE.Material) {
  const width = Number(anchor.userData.width);
  const height = Number(anchor.userData.height);
  const depth = .045;
  const hinge = new THREE.Group();
  hinge.name = 'puerta_departamento';
  hinge.position.copy(anchor.getWorldPosition(new THREE.Vector3()));
  scene.add(hinge);
  const pieces = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const piece = (material: THREE.Material, size: [number, number, number], position: [number, number, number]) => {
    const geometry = new THREE.BoxGeometry(...size).translate(...position);
    if (!pieces.has(material)) pieces.set(material, []);
    pieces.get(material)!.push(geometry);
  };
  piece(panel, [width, height, depth], [width / 2, height / 2, 0]);
  // Molduras y manijas de ambos lados; la hoja no invade el pasillo común al abrir.
  for (const side of [-1, 1]) {
    for (const x of [.10, width - .10]) piece(panel, [.022, height - .32, .012], [x, height / 2, side * .027]);
    for (const y of [.16, height - .16]) piece(panel, [width - .18, .022, .012], [width / 2, y, side * .027]);
    piece(metal, [.035, .14, .018], [width - .11, 1.02, side * .035]);
    piece(metal, [.025, .025, .065], [width - .11, 1.04, side * .06]);
    piece(metal, [.12, .025, .025], [width - .16, 1.04, side * .09]);
  }
  // Dos mallas para toda la puerta: panel y herrajes comparten los materiales del GLB.
  for (const [material, geometries] of pieces) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
    mesh.receiveShadow = true; // No deja una sombra fija cuando se abre.
    hinge.add(mesh);
    geometries.forEach((g) => g.dispose());
  }
  const geometry = new THREE.BoxGeometry(width, height, depth).translate(width / 2, height / 2, 0);
  const collider = buildCollider([], [geometry]);
  geometry.dispose();
  const inverse = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), correction = new THREE.Vector3();
  const point = new THREE.Vector3(), nearest = new THREE.Vector3();
  const ray = new THREE.Ray(), hit = new THREE.Vector3();
  const bounds = new THREE.Box3(new THREE.Vector3(0, 0, -depth / 2), new THREE.Vector3(width, height, depth / 2));
  let target = 0;
  const sync = () => {
    hinge.updateMatrixWorld(true);
    inverse.copy(hinge.matrixWorld).invert();
    hinge.getWorldQuaternion(rotation);
  };
  sync();
  const clearance = (eye: THREE.Vector3) => {
    point.copy(eye).applyMatrix4(inverse);
    if (point.y <= 0 || point.y >= height + .3) return Infinity;
    nearest.set(THREE.MathUtils.clamp(point.x, 0, width), point.y, THREE.MathUtils.clamp(point.z, -depth / 2, depth / 2));
    return point.distanceToSquared(nearest);
  };

  return {
    get label() { return target === 0 ? 'Abrir puerta del departamento' : 'Cerrar puerta del departamento'; },
    toggle: () => { target = target === 0 ? -Math.PI / 2 : 0; },
    /** La mira debe alcanzar la hoja: no ofrece la acción desde el baño o detrás de un muro. */
    distance: (eye: THREE.Vector3, direction: THREE.Vector3) => {
      ray.set(eye, direction).applyMatrix4(inverse);
      if (!ray.intersectBox(bounds, hit)) return Infinity;
      return hit.distanceTo(ray.origin);
    },
    update: (eye: THREE.Vector3, dt: number, radius: number) => {
      const step = Math.min(dt, .05) * 1.8;
      const next = THREE.MathUtils.clamp(target, hinge.rotation.y - step, hinge.rotation.y + step);
      if (next === hinge.rotation.y) return;
      // Comprobar el barrido en pasos pequeños. La animación espera si alguien ocupa el vano;
      // nunca empuja al visitante contra una pared ni le cierra la hoja encima.
      const previous = hinge.rotation.y;
      const steps = Math.ceil(Math.abs(next - previous) / .015);
      let previousClearance = clearance(eye);
      for (let i = 1; i <= steps; i++) {
        hinge.rotation.y = previous + (next - previous) * i / steps;
        sync();
        const nextClearance = clearance(eye);
        // Si ya está apoyado en la hoja, permitir que esta se aleje del cuerpo.
        if (nextClearance < (radius + .025) ** 2 && nextClearance < previousClearance - 1e-10) {
          hinge.rotation.y = previous + (next - previous) * (i - 1) / steps;
          sync();
          break;
        }
        previousClearance = nextClearance;
      }
    },
    resolve: (start: THREE.Vector3, end: THREE.Vector3, radius: number, out: THREE.Vector3) => {
      a.copy(start).applyMatrix4(inverse);
      b.copy(end).applyMatrix4(inverse);
      resolveCapsule(collider, a, b, radius, correction);
      return out.copy(correction).applyQuaternion(rotation);
    },
  };
}

export type ApartmentDoor = ReturnType<typeof buildApartmentDoor>;
