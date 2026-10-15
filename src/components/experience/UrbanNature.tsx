'use client';

import { useLayoutEffect, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from './urbanTextures';
import { SCENERY_LAYER } from './sceneryLayer';
import { useExperience } from './store';

const RADIUS = 420;
const BACKDROP_HEIGHT = 240;
// La línea de horizonte de la fotografía está al 36 % desde su borde inferior.
const HORIZON_OFFSET = BACKDROP_HEIGHT * (.5 - .36);

export function UrbanNature() {
  const root = useRef<THREE.Group>(null);
  const backdrop = useRef<THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial> | null>(null);
  const { gl, camera } = useThree();
  const atmosphere = useExperience((state) => state.atmosphere);
  const [leafSource, citySource] = useLoader(THREE.TextureLoader, [
    '/archviz/urban/foliage.webp',
    '/archviz/urban/city-panorama.webp',
  ]);

  useLayoutEffect(() => {
    const group = root.current!;
    const random = seededRandom(718);
    // Las copias pertenecen a este montaje; no se destruye el caché de useLoader al salir.
    const leaves = leafSource.clone();
    const city = citySource.clone();
    for (const texture of [leaves, city]) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
      texture.needsUpdate = true;
    }
    // La unión enfrenta el mismo borde de la imagen, sin un salto visible al completar 360°.
    city.wrapS = THREE.MirroredRepeatWrapping;
    city.repeat.x = 2;
    const leafMaterial = new THREE.MeshStandardMaterial({
      map: leaves, roughness: .95, side: THREE.DoubleSide,
      emissiveMap: leaves, emissive: '#ffffff', emissiveIntensity: .12,
      alphaTest: .32, alphaToCoverage: true,
    });
    const bark = new THREE.MeshStandardMaterial({ color: '#766550', roughness: 1, vertexColors: true });
    const twigGeometry: THREE.BufferGeometry[] = [];
    const branch = (a: THREE.Vector3, b: THREE.Vector3, radius: number) => {
      const direction = b.clone().sub(a);
      const geometry = new THREE.CylinderGeometry(radius * .55, radius, direction.length(), 6);
      geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
      geometry.translate(...a.clone().add(b).multiplyScalar(.5).toArray());
      const colors = new Float32Array(geometry.getAttribute('position').count * 3);
      for (let i = 0; i < colors.length; i += 3) {
        const tone = .72 + random() * .28;
        colors.set([tone, tone, tone], i);
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      twigGeometry.push(geometry);
    };
    // Un solo dibujo para las 12 copas. Cada árbol usa 64 planos de dos triángulos,
    // repartidos en volumen para que también funcione la vista desde arriba.
    const cardsPerTree = 64;
    const foliage = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), leafMaterial, 12 * cardsPerTree);
    foliage.name = 'Copas con hojas recortadas';
    foliage.layers.set(SCENERY_LAYER);
    foliage.castShadow = true;
    // El recorte proyecta sombra sobre la vereda; evitamos la autosombra de planos
    // superpuestos, que oscurece artificialmente el interior de toda la copa.
    foliage.receiveShadow = false;
    const transform = new THREE.Object3D();
    const color = new THREE.Color();
    for (let tree = 0; tree < 12; tree++) {
      const x = -31 + tree * 5.5;
      const scale = .86 + random() * .24;
      const fork = new THREE.Vector3(x + .12, 2.3 * scale, 14.8);
      const clusters: THREE.Vector3[] = [];
      branch(new THREE.Vector3(x, 0, 14.8), fork, .19 * scale);
      for (let limb = 0; limb < 6; limb++) {
        const angle = limb * Math.PI / 3 + tree;
        const end = new THREE.Vector3(x + Math.cos(angle) * 1.2 * scale, (3.6 + random() * .8) * scale, 14.8 + Math.sin(angle) * 1.2 * scale);
        branch(fork, end, .085 * scale);
        branch(end, end.clone().add(new THREE.Vector3(Math.cos(angle) * .4, .65, Math.sin(angle) * .4)), .035 * scale);
        clusters.push(end.clone().add(new THREE.Vector3(0, .35 * scale, 0)));
      }
      for (let card = 0; card < cardsPerTree; card++) {
        const y = 1 - 2 * (card + .5) / cardsPerTree;
        const radius = Math.sqrt(1 - y * y);
        const angle = card * 2.399963 + tree;
        const normal = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        const depth = .4 + random() * .65;
        transform.position.copy(normal).multiply(new THREE.Vector3(.95, 1.1, .95)).multiplyScalar(scale * depth).add(clusters[card % clusters.length]);
        // La orientación no sigue una esfera: las ramas forman grupos irregulares
        // y los planos se cruzan dentro de la copa, sin una carcasa de aspecto sólido.
        const facing = new THREE.Vector3(random() - .5, random() - .3, random() - .5).normalize();
        transform.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), facing);
        transform.rotateZ(random() * Math.PI * 2);
        transform.scale.setScalar((1.25 + random() * .45) * scale);
        transform.updateMatrix();
        const index = tree * cardsPerTree + card;
        foliage.setMatrixAt(index, transform.matrix);
        foliage.setColorAt(index, color.setHSL(.22 + random() * .04, .08, .84 + random() * .12));
      }
    }
    foliage.computeBoundingSphere();
    const trunks = new THREE.Mesh(mergeGeometries(twigGeometry), bark);
    twigGeometry.forEach((geometry) => geometry.dispose());
    trunks.name = 'Troncos y ramas';
    trunks.castShadow = trunks.receiveShadow = true;

    // Una imagen en un cilindro abierto (128 triángulos), sin luces ni sombras adicionales.
    // Se mezcla en la cola opaca, después del cielo: así la captura de transmisión
    // de los vidrios también incluye el panorama (omite la cola transparente).
    const cityMaterial = new THREE.MeshBasicMaterial({
      map: city, side: THREE.BackSide, depthWrite: false, fog: false,
      blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    cityMaterial.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #include <map_fragment>
        diffuseColor.a *= 1.0 - smoothstep(0.76, 0.99, vMapUv.y);
      `);
    };
    cityMaterial.customProgramCacheKey = () => 'urban-panorama-top-fade-v1';
    const horizon = new THREE.Mesh(new THREE.CylinderGeometry(RADIUS, RADIUS, BACKDROP_HEIGHT, 64, 1, true), cityMaterial);
    horizon.name = 'Panorámica de ciudad y cielo';
    horizon.layers.set(SCENERY_LAYER);
    horizon.renderOrder = -10;
    horizon.position.copy(camera.position);
    horizon.position.y += HORIZON_OFFSET;
    backdrop.current = horizon;
    const hadLayer = camera.layers.isEnabled(SCENERY_LAYER);
    camera.layers.enable(SCENERY_LAYER);
    group.add(trunks, foliage, horizon);
    gl.shadowMap.needsUpdate = true;
    return () => {
      backdrop.current = null;
      group.remove(trunks, foliage, horizon);
      if (!hadLayer) camera.layers.disable(SCENERY_LAYER);
      trunks.geometry.dispose();
      foliage.geometry.dispose();
      foliage.dispose();
      horizon.geometry.dispose();
      bark.dispose(); leafMaterial.dispose(); cityMaterial.dispose();
      leaves.dispose(); city.dispose();
    };
  }, [leafSource, citySource, gl, camera]);

  useLayoutEffect(() => {
    backdrop.current?.material.color.set(atmosphere === 'dia' ? '#ffffff' : '#efcfad');
  }, [atmosphere]);

  useFrame(() => {
    if (!backdrop.current) return;
    // Fondo lejano: acompaña la altura del ascensor sin parecer una pared cercana.
    backdrop.current.position.copy(camera.position);
    backdrop.current.position.y += HORIZON_OFFSET;
  });

  return <group ref={root} name="Árboles y horizonte" />;
}
