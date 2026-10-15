'use client';

import { useLayoutEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createUrbanTextures, seededRandom } from './urbanTextures';
import { UrbanNature } from './UrbanNature';
import { SCENERY_LAYER } from './sceneryLayer';

// Ambientación ilustrativa, no un relevamiento de las manzanas reales de Resistencia.
// Fachadas fijas sobre volúmenes: mantienen perspectiva y sombras al caminar y desde el balcón.
// El contexto queda fuera de las colisiones; las superficies cercanas respetan el GLB existente.
export function Surroundings() {
  const root = useRef<THREE.Group>(null);
  const gl = useThree((state) => state.gl);

  useLayoutEffect(() => {
    const group = root.current!;
    const textures = createUrbanTextures(Math.min(8, gl.capabilities.getMaxAnisotropy()));
    const random = seededRandom(104);
    const materials = {
      asphalt: new THREE.MeshStandardMaterial({ map: textures.asphalt, roughness: .96 }),
      paving: new THREE.MeshStandardMaterial({ map: textures.paving, roughness: .9 }),
      ground: new THREE.MeshStandardMaterial({ color: '#aaa796', roughness: 1 }),
      terrain: new THREE.MeshStandardMaterial({
        color: '#89917d', roughness: 1, depthWrite: false,
        blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      }),
      paint: new THREE.MeshStandardMaterial({ color: '#e1ddc7', roughness: .95 }),
      metal: new THREE.MeshStandardMaterial({ color: '#4c5452', roughness: .65, metalness: .35 }),
      lamp: new THREE.MeshStandardMaterial({ color: '#e8e0c9', roughness: .6 }),
    };
    // Desvanece el límite del suelo hacia la foto para evitar un corte recto en el horizonte.
    materials.terrain.onBeforeCompile = (shader) => {
      shader.vertexShader = 'varying vec2 vUrbanGround;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vUrbanGround = (modelMatrix * vec4(transformed, 1.0)).xz;
      `);
      shader.fragmentShader = 'varying vec2 vUrbanGround;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        float edge = max(abs(vUrbanGround.x), abs(vUrbanGround.y));
        diffuseColor.a *= 1.0 - smoothstep(160.0, 220.0, edge);
      `);
    };
    materials.terrain.customProgramCacheKey = () => 'urban-ground-edge-fade-v1';
    const facades = textures.facades.map((map) => new THREE.MeshStandardMaterial({ map, roughness: .82 }));
    const batches = new Map<THREE.MeshStandardMaterial, THREE.BufferGeometry[]>();
    const add = (geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial) => {
      const batch = batches.get(material) ?? [];
      batch.push(geometry);
      batches.set(material, batch);
    };
    const box = (x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.MeshStandardMaterial) => {
      const geometry = new THREE.BoxGeometry(w, h, d);
      if (material === materials.paving) {
        const uv = geometry.getAttribute('uv');
        const position = geometry.getAttribute('position');
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (position.getX(i) + x) / 4, (position.getZ(i) + z) / 4);
      }
      geometry.translate(x, y, z);
      add(geometry, material);
    };
    const surface = (x: number, y: number, z: number, w: number, d: number, material: THREE.MeshStandardMaterial, tile = 4) => {
      const geometry = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x, y, z);
      const uv = geometry.getAttribute('uv');
      const position = geometry.getAttribute('position');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, position.getX(i) / tile, position.getZ(i) / tile);
      add(geometry, material);
    };

    surface(0, -.33, 0, 440, 440, materials.terrain);
    // Calle del modelo: z = 2…12, superficie a y = -0,11. La capa evita coplanaridad.
    const streets = [-113, -53, 7, 67, 127];
    const avenues = [-180, -120, -60, 60, 120, 180];
    for (const z of streets) surface(0, -.104, z, 370, 10, materials.asphalt);
    for (const x of avenues) surface(x, -.108, 7, 10, 300, materials.asphalt);
    for (let row = 0; row < streets.length - 1; row++) {
      const z = streets[row];
      for (let col = 0; col < avenues.length - 1; col++) {
        const left = avenues[col], right = avenues[col + 1];
        // No superponer una manzana con el terreno ni el acceso de Natalini.
        if (!(left === -60 && z === -53)) {
          box((left + right) / 2, -.12, z + 30, right - left - 10, .24, 50, materials.paving);
        }
        for (let x = left + 16; x <= right - 16; x += 22) for (const bz of [z + 20, z + 43]) {
          const w = 13 + Math.floor(random() * 5), d = 13 + Math.floor(random() * 5);
          if (x + w / 2 > -40 && x - w / 2 < 40 && bz + d / 2 > -26 && bz - d / 2 < 18) continue;
          const floors = random() < .15 ? 10 + Math.floor(random() * 10) : 2 + Math.floor(random() * 5);
          const h = floors * 3.2;
          const geometry = new THREE.BoxGeometry(w, h, d);
          const uv = geometry.getAttribute('uv');
          const normal = geometry.getAttribute('normal');
          for (let i = 0; i < uv.count; i++) {
            // Techos lisos, ventanas a escala constante en ambas orientaciones.
            if (Math.abs(normal.getY(i)) > .5) uv.setXY(i, .012, .012);
            else uv.setXY(i, uv.getX(i) * (Math.abs(normal.getX(i)) > .5 ? d : w) / 12, uv.getY(i) * h / 12.8);
          }
          geometry.translate(x, h / 2, bz);
          add(geometry, facades[Math.floor(random() * facades.length)]);
          // Remate de azotea y pequeño volumen técnico, visibles desde el departamento.
          box(x, h + .16, bz, w + .25, .32, d + .25, materials.ground);
          box(x + w * .18, h + .7, bz, 3, 1.1, 2.5, materials.paving);
        }
      }
    }
    surface(0, .012, 1.6, 27, 3.2, materials.paving);
    // Continuidad de la vereda propia, conservando el espacio del acceso.
    for (const x of [-34.25, 34.25]) box(x, -.12, .7, 41.5, .24, 5, materials.paving);

    // Pintura vial fija sobre la calzada. Se interrumpe en las calles transversales.
    for (const z of streets) for (let x = -175; x <= 175; x += 7) {
      if (avenues.some((avenue) => Math.abs(x - avenue) < 8)) continue;
      surface(x, -.096, z, 3, .12, materials.paint);
    }
    for (const x of [-51.5, 51.5]) {
      for (let z = 3; z < 12; z += 1.25) surface(x, -.094, z, 3.5, .65, materials.paint);
    }

    // Alumbrado de la vereda opuesta, sin invadir el área transitable.
    for (const x of [-26, -8, 10, 28]) {
      add(new THREE.CylinderGeometry(.065, .12, 6, 8).translate(x, 3, 13.1), materials.metal);
      box(x, 5.95, 12.45, .12, .12, 1.4, materials.metal);
      box(x, 5.88, 11.8, .38, .12, .8, materials.lamp);
    }

    // Una malla por material: ventanas y señalización no agregan cientos de draw calls.
    for (const [material, geometries] of batches) {
      const geometry = mergeGeometries(geometries);
      geometries.forEach((source) => source.dispose());
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `Entorno urbano · ${material.map?.name || material.uuid}`;
      mesh.castShadow = material !== materials.asphalt && material !== materials.paint && material !== materials.terrain;
      if (material === materials.terrain) {
        mesh.layers.set(SCENERY_LAYER);
        mesh.renderOrder = -5;
      }
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    gl.shadowMap.needsUpdate = true;
    return () => {
      for (const child of [...group.children]) {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
        group.remove(child);
      }
      [...Object.values(materials), ...facades].forEach((material) => material.dispose());
      textures.dispose();
    };
  }, [gl]);

  return <><group ref={root} name="Contexto urbano Natalini" /><UrbanNature /></>;
}
