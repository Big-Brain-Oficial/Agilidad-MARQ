import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

// Comparación reproducible antes/después, siempre contra una compilación de producción.
// NATURAL_QA_LABEL=before|after conserva ambos informes y capturas.
const label = process.env.NATURE_QA_LABEL ?? 'after';
const out = resolve('.cache/nature-qa', label);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [], failures = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/pointer.?lock/i.test(message.text())) errors.push(message.text());
  });
  page.on('response', (response) => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  // Cuenta también los pases de postproceso. No modifica la aplicación ni sus materiales.
  await page.addInitScript(() => {
    window.natureQA = { draws: 0, triangles: 0 };
    for (const method of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const original = WebGL2RenderingContext.prototype[method];
      WebGL2RenderingContext.prototype[method] = function (...args) {
        window.natureQA.draws++;
        if (args[0] === this.TRIANGLES) {
          const count = method.includes('Elements') ? args[1] : args[2];
          const instances = method.endsWith('Instanced') ? args.at(-1) : 1;
          window.natureQA.triangles += count * instances / 3;
        }
        return original.apply(this, args);
      };
    }
  });
  const start = Date.now();
  await page.goto((process.env.ARCHVIZ_TEST_URL ?? 'http://localhost:3112') + '/recorrido/torre-natalini?debug', { timeout: 120000 });
  await page.waitForFunction(() => window.marq?.state().phase === 'intro', null, { timeout: 180000 });
  const loadMs = Date.now() - start;
  await page.getByRole('button', { name: 'Comenzar recorrido', exact: true }).click();
  const samples = [];
  for (const quality of ['alta', 'fluida']) {
    for (const view of ['calle', 'balcon']) {
      await page.evaluate(({ quality, view }) => {
        const api = window.marq;
        api.state().setQuality(quality);
        api.state().setAtmosphere('dia');
        if (view === 'calle') {
          api.teleport(-6.4, 0, 1.4);
          api.look(Math.PI, .12);
        } else {
          const balcony = api.state().views.find((item) => item.label === 'Balcón');
          api.state().visit(balcony.id);
        }
      }, { quality, view });
      await page.waitForTimeout(1500);
      const sample = await page.evaluate(() => new Promise((done) => {
        const intervals = [], draws = [], triangles = [];
        let previous = 0;
        const tick = (now) => {
          if (previous) {
            intervals.push(now - previous);
            draws.push(window.natureQA.draws);
            triangles.push(window.natureQA.triangles);
          }
          window.natureQA.draws = window.natureQA.triangles = 0;
          previous = now;
          if (intervals.length < 180) return requestAnimationFrame(tick);
          intervals.sort((a, b) => a - b);
          const mean = (items) => items.reduce((a, b) => a + b, 0) / items.length;
          done({ fps: +(1000 / mean(intervals)).toFixed(1), p95ms: +intervals[170].toFixed(1), draws: Math.round(mean(draws)), triangles: Math.round(mean(triangles)) });
        };
        requestAnimationFrame(tick);
      }));
      samples.push({ quality, view, ...sample });
      await page.screenshot({ path: resolve(out, `${view}-${quality}.png`) });
    }
  }
  // Mira las cuatro orientaciones para inspeccionar el cierre y la altura del horizonte.
  for (let direction = 0; direction < 4; direction++) {
    await page.evaluate((direction) => window.marq.look(direction * Math.PI / 2, -.08), direction);
    await page.waitForTimeout(200);
    await page.screenshot({ path: resolve(out, `horizonte-${direction}.png`) });
  }
  await page.evaluate(() => {
    window.marq.state().setAtmosphere('tarde');
    window.marq.teleport(-6.4, 0, 1.4);
    window.marq.look(Math.PI, .12);
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(out, 'calle-tarde.png') });
  await page.evaluate(() => {
    window.marq.state().setAtmosphere('dia');
    window.marq.state().setQuality('alta');
    window.marq.teleport(3, 0, 1.4);
    window.marq.look(Math.PI, .16);
  });
  await page.waitForTimeout(750);
  await page.screenshot({ path: resolve(out, 'arboles-detalle.png') });
  const renderer = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2');
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'unavailable';
  });
  const report = { label, viewport: '1440x900, DPR 1', renderer, loadMs, samples, errors, failures };
  await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
} finally {
  await browser.close();
}
