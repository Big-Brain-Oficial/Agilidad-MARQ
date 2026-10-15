// Prepara fuentes nativas; nunca reemplaza los GLB optimizados de la web.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsUnlit } from '@gltf-transform/extensions';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = join(root, '.cache/unreal');
mkdirSync(output, { recursive: true });
const temporary = join(output, 'tmp');
mkdirSync(temporary, { recursive: true });

function findBlender() {
  if (process.env.BLENDER_PATH) return process.env.BLENDER_PATH;
  const base = join(process.env.ProgramFiles ?? 'C:/Program Files', 'Blender Foundation');
  if (existsSync(base)) {
    for (const folder of readdirSync(base).sort().reverse()) {
      const exe = join(base, folder, 'blender.exe');
      if (existsSync(exe)) return exe;
    }
  }
  return 'blender';
}

for (const name of ['foliage', 'city-panorama']) {
  await sharp(join(root, `public/archviz/urban/${name}.webp`)).png().toFile(join(output, `${name}.png`));
}
// Fachada repetible: el tamaño físico se aplica en las UV del entorno.
const windows = [];
for (let y = 15; y < 240; y += 64) for (let x = 14; x < 240; x += 64) {
  windows.push(`<rect x="${x}" y="${y}" width="32" height="39" fill="#526771"/><path d="M${x+16} ${y}v39 M${x} ${y+38}h32" stroke="#b7b4aa" stroke-width="2"/>`);
}
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#b9b4a7"/>${windows.join('')}</svg>`)).png().toFile(join(output, 'facade.png'));

const blend = join(root, 'modelos/Torre_Natalini/Torre_Natalini_Interpretativa.blend');
const result = spawnSync(findBlender(), [
  '--background', '--factory-startup', blend, '--python-exit-code', '1',
  '--python', join(root, 'scripts/blender/rebuild_archviz.py'),
  '--python', join(root, 'scripts/unreal/export_scene.py'), '--', output,
], { cwd: root, stdio: 'inherit', env: { ...process.env, TEMP: temporary, TMP: temporary } });
if (result.error) throw new Error(`No se pudo abrir Blender. Configurá BLENDER_PATH. ${result.error.message}`);
if (result.status !== 0) process.exit(result.status ?? 1);
const files = ['natalini.glb', 'entorno.glb'];
for (const file of files) if (!existsSync(join(output, file))) throw new Error(`Falta ${file}`);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const file of files) {
  const document = await io.read(join(output, file));
  for (const texture of document.getRoot().listTextures()) {
    const image = texture.getImage();
    if (!image) continue;
    const metadata = await sharp(image).metadata();
    if (Math.max(metadata.width ?? 0, metadata.height ?? 0) > 2048) {
      texture.setImage(await sharp(image).resize(2048, 2048, { fit: 'inside', withoutEnlargement: true }).png().toBuffer());
      texture.setMimeType('image/png');
    }
  }
  for (const material of document.getRoot().listMaterials()) {
    if (material.getName() === 'UE_Follaje') material.setAlphaMode('MASK').setAlphaCutoff(.35).setDoubleSided(true);
    if (material.getName() === 'UE_Panorama') {
      material.setExtension('KHR_materials_unlit', document.createExtension(KHRMaterialsUnlit).createUnlit());
    }
  }
  await io.write(join(output, file), document);
}
writeFileSync(join(output, 'source.json'), JSON.stringify({
  engine: '5.7', generatedAt: new Date().toISOString(),
  files: files.map((file) => {
    const data = readFileSync(join(output, file));
    return { file, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
  }),
}, null, 2) + '\n');
console.log('Fuentes listas en .cache/unreal. Con Unreal instalado: npm run unreal:import');
