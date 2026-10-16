import * as THREE from 'three';
import type { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CABIN_FLOOR } from './cabinDoors';

// Se agrupan las piezas por material para no sumar una llamada de dibujo por moldura o botón.
function pieces(parent: THREE.Object3D) {
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const add = (material: THREE.Material, geometry: THREE.BufferGeometry) => {
    if (!groups.has(material)) groups.set(material, []);
    groups.get(material)!.push(geometry);
  };
  return {
    box(material: THREE.Material, size: [number, number, number], position: [number, number, number]) {
      add(material, new THREE.BoxGeometry(...size).translate(...position));
    },
    disc(material: THREE.Material, radius: number, depth: number, x: number, y: number, z: number) {
      add(material, new THREE.CylinderGeometry(radius, radius, depth, 24).rotateX(Math.PI / 2).translate(x, y, z));
    },
    arrow(material: THREE.Material, y: number, direction: number) {
      const shape = new THREE.Shape();
      shape.moveTo(-.018, -.012);
      shape.lineTo(.018, -.012);
      shape.lineTo(0, .018);
      shape.closePath();
      // Las cajas y cilindros tienen índices y UV; convertir evita mezclar formatos al unir.
      add(material, new THREE.ShapeGeometry(shape).rotateZ(direction < 0 ? Math.PI : 0).translate(0, y, .046));
    },
    finish() {
      for (const [material, geometries] of groups) {
        const plain = geometries.map((g) => g.index ? g.toNonIndexed() : g);
        const mesh = new THREE.Mesh(mergeGeometries(plain), material);
        mesh.receiveShadow = true;
        parent.add(mesh);
        new Set([...plain, ...geometries]).forEach((g) => g.dispose());
      }
    },
  };
}

/** Frente decorativo sobre un muro existente: no crea huecos ni tiene acciones de apertura. */
export function buildNeighborDoor(scene: THREE.Object3D, apartment: THREE.Object3D, collider: MeshBVH, panel: THREE.Material, metal: THREE.Material) {
  const width = Number(apartment.userData.width), height = Number(apartment.userData.height);
  const origin = apartment.getWorldPosition(new THREE.Vector3());
  origin.x += width / 2;
  origin.y += height / 2;
  origin.z -= .25;
  const wall = collider.raycastFirst(new THREE.Ray(origin, new THREE.Vector3(0, 0, -1)), THREE.DoubleSide);
  if (!wall || wall.distance > 3) throw new Error('No se encontró la pared frente al departamento');
  const door = new THREE.Group();
  door.name = 'puerta_vecino_decorativa';
  door.position.copy(wall.point).add(new THREE.Vector3(0, -height / 2, .003));
  const p = pieces(door);
  p.box(panel, [width, height, .04], [0, height / 2, .02]);
  for (const side of [-1, 1]) {
    p.box(panel, [.055, height + .06, .07], [side * (width / 2 + .03), height / 2, .035]);
    p.box(panel, [.022, height - .32, .012], [side * (width / 2 - .10), height / 2, .046]);
  }
  p.box(panel, [width + .115, .06, .07], [0, height + .03, .035]);
  for (const y of [.16, height - .16]) p.box(panel, [width - .18, .022, .012], [0, y, .046]);
  p.box(metal, [.035, .14, .018], [width / 2 - .11, 1.02, .05]);
  p.box(metal, [.025, .025, .065], [width / 2 - .11, 1.04, .08]);
  p.box(metal, [.12, .025, .025], [width / 2 - .16, 1.04, .11]);
  p.disc(metal, .012, .008, 0, 1.55, .045);
  p.finish();
  scene.add(door);
}

/** Botonera solidaria a la cabina. Los botones son decorativos; la acción elige la otra parada. */
export function buildElevatorPanel(cabin: THREE.Group, bounds: THREE.Box3, metal: THREE.Material, dark: THREE.Material, face: THREE.Material) {
  const panel = new THREE.Group();
  panel.name = 'botonera_ascensor';
  // Cara interior del lateral derecho, cerca de la entrada y fuera del barrido de las puertas.
  panel.position.set(bounds.max.x - .065, bounds.min.y + CABIN_FLOOR + 1.35, bounds.max.z - .55);
  panel.rotation.y = -Math.PI / 2;
  const p = pieces(panel);
  // Acabado satinado: la placa debe leerse aun cuando no recibe un reflejo del entorno.
  const satin = metal.clone() as THREE.MeshStandardMaterial;
  satin.roughness = .55;
  satin.metalness = .4;
  p.box(satin, [.24, .55, .025], [0, 0, 0]);
  p.box(dark, [.17, .065, .008], [0, .18, .017]);
  p.box(face, [.045, .008, .002], [0, .18, .023]);
  for (const [y, direction] of [[.055, 1], [-.105, -1]]) {
    p.disc(satin, .05, .014, 0, y, .025);
    p.disc(dark, .039, .012, 0, y, .037);
    p.arrow(face, y, direction);
  }
  for (const x of [-.09, .09]) for (const y of [-.245, .245]) p.disc(dark, .005, .004, x, y, .015);
  p.finish();
  cabin.add(panel);
  const inverse = new THREE.Matrix4(), ray = new THREE.Ray(), hit = new THREE.Vector3();
  // Un margen pequeño alrededor de la placa facilita apuntarla con el control táctil.
  const target = new THREE.Box3(new THREE.Vector3(-.15, -.305, -.015), new THREE.Vector3(.15, .305, .05));
  return {
    distance(eye: THREE.Vector3, direction: THREE.Vector3) {
      panel.updateWorldMatrix(true, false);
      inverse.copy(panel.matrixWorld).invert();
      ray.set(eye, direction).applyMatrix4(inverse);
      return ray.intersectBox(target, hit) ? hit.distanceTo(ray.origin) : Infinity;
    },
  };
}

export type ElevatorPanel = ReturnType<typeof buildElevatorPanel>;
