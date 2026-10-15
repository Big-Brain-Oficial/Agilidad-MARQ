// Con el build servido: node node_modules/next/dist/bin/next start -p 3100
// node scripts/verify-performance.mjs [--software]
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { chromium } from '@playwright/test';

const source = await readFile(new URL('../src/components/experience/renderer.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { isSoftwareRenderer } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
for (const [renderer, expected] of [
  ['ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11)', true],
  ['ANGLE (Google, Vulkan (SwiftShader Device (Subzero)))', true],
  ['llvmpipe (LLVM)', true], ['softpipe', true],
  ['ANGLE (Intel, Intel UHD Graphics Direct3D11)', false],
  ['ANGLE (Apple, ANGLE Metal Renderer: Apple M2)', false],
  ['ANGLE (NVIDIA, GeForce RTX)', false], [null, false],
]) {
  assert.equal(isSoftwareRenderer({ getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 1 }), getParameter: () => renderer }), expected, String(renderer));
}
assert.equal(isSoftwareRenderer({ getExtension: () => null }), false);
assert.equal(isSoftwareRenderer({ getExtension: () => { throw Error('Privacidad'); } }), false);

const software = process.argv.includes('--software');
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: software ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const errors = [];
const requests = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => requests.push(request.url()));
try {
  await page.addInitScript(() => {
    window.qaShaders = [];
    const original = WebGL2RenderingContext.prototype.shaderSource;
    WebGL2RenderingContext.prototype.shaderSource = function (shader, source) {
      window.qaShaders.push(source);
      return original.call(this, shader, source);
    };
  });
  await page.goto('http://localhost:3100/recorrido/torre-natalini');
  await page.getByRole('button', { name: 'Comenzar recorrido' }).waitFor({ timeout: 180000 });
  const renderer = await page.locator('canvas').evaluate((canvas) => {
    const gl = canvas.getContext('webgl2');
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'No disponible';
  });
  const detectedSoftware = /basic render driver|swiftshader|llvmpipe|softpipe|software rasterizer/i.test(renderer);
  if (software) assert.ok(detectedSoftware, renderer);
  assert.equal(await page.getByLabel('Calidad').inputValue(), detectedSoftware ? 'fluida' : 'alta');
  assert.equal(await page.getByText('Activá la aceleración por hardware en tu navegador para una mejor experiencia.').count(), detectedSoftware ? 1 : 0);
  const shaders = await page.evaluate(() => ({
    shadows: window.qaShaders.some((s) => s.includes('#define USE_SHADOWMAP')),
    ssao: window.qaShaders.some((s) => /#define KERNEL_SIZE 16\b/.test(s)),
  }));
  if (detectedSoftware) {
    assert.equal(shaders.shadows, false, 'No compilar sombras al iniciar por software');
    assert.equal(shaders.ssao, false, 'No compilar SSAO al iniciar por software');
    assert.equal(await page.locator('canvas').evaluate((c) => c.width / c.clientWidth), 1);
  }
  assert.ok(requests.some((url) => url.endsWith('/rooftop_day/hdri-1k.hdr')));
  assert.ok(!requests.some((url) => url.endsWith('/rooftop_day/hdri.hdr')));
  await page.getByRole('button', { name: 'Comenzar recorrido' }).click();
  await page.waitForFunction(() => document.pointerLockElement?.tagName === 'CANVAS');
  await page.getByRole('button', { name: 'Comenzar recorrido' }).waitFor({ state: 'hidden' });
  await page.keyboard.press('Escape');
  // Chrome headless no siempre ejecuta la acción nativa de Escape.
  await page.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
  await page.getByRole('button', { name: 'Continuar', exact: true }).waitFor();
  await page.getByLabel('Calidad').selectOption('fluida');
  await page.waitForFunction(() => { const c = document.querySelector('canvas'); return c.width === c.clientWidth; });
  assert.deepEqual(errors, []);
  await mkdir('.cache/performance', { recursive: true });
  const result = { renderer, detectedSoftware, shaders, errors, url: page.url() };
  await writeFile(`.cache/performance/${software ? 'software' : 'default'}.json`, JSON.stringify(result, null, 2));
  await page.screenshot({ path: `.cache/performance/${software ? 'software' : 'default'}.png` });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(await page.locator('body').innerText());
  console.error('Errores de página:', errors);
  throw error;
} finally {
  await browser.close();
}
