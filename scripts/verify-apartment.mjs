// Con el build servido en :3100: node scripts/verify-apartment.mjs
// ?debug permite ubicar al visitante y usar el mismo movimiento/colisiones del recorrido.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const out = '.cache/apartment/verification';
await mkdir(out, { recursive: true });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => {
  if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
});

async function place(x, y, yaw, pitch = 0) {
  await page.evaluate(([x, y, yaw, pitch]) => {
    window.marq.teleport(x - 7.5, 29.9, -y);
    window.marq.look(yaw, pitch);
  }, [x, y, yaw, pitch]);
  await page.waitForTimeout(300);
}

async function walk(ms) {
  await page.evaluate((ms) => window.marq.press('KeyW', ms), ms);
  return page.evaluate(() => ({ pos: window.marq.state().pos, grounded: window.marq.state().onGround }));
}

try {
  const base = process.env.ARCHVIZ_TEST_URL ?? 'http://localhost:3100';
  await page.goto(`${base}/recorrido/torre-natalini?debug`);
  await page.waitForFunction(() => window.marq?.state().phase === 'intro', null, { timeout: 180000 });
  await page.getByRole('button', { name: 'Comenzar recorrido', exact: true }).click();
  await page.waitForFunction(() => window.marq.state().phase === 'playing');
  const report = [];
  for (const [name, x, y] of [['principal', 2.85, 6.765], ['secundario', 2.40, 3.885]]) {
    await place(x, y, Math.PI / 2);
    const crossed = await walk(1100);
    assert.ok(crossed.pos[0] + 7.5 < .65, `${name}: paso bloqueado ${crossed.pos}`);
    assert.ok(Math.abs(crossed.pos[2] + y) < .08, `${name}: desvío por colisión ${crossed.pos}`);
    assert.ok(crossed.grounded && Math.abs(crossed.pos[1] - 31.55) < .06, `${name}: perdió el piso`);
    await place(.45, y, 0);
    const side = await walk(550);
    assert.ok(side.pos[2] < -y - .9, `${name}: lateral bloqueado ${side.pos}`);
    assert.ok(Math.abs(side.pos[0] + 7.05) < .08 && side.grounded);
    report.push({ name, crossed, side });
  }
  // Cruza el umbral del baño en ambos sentidos, sin escalones ni huecos.
  await place(4.43, 5.75, 0);
  const inside = await walk(300);
  assert.ok(inside.pos[2] < -6.45 && inside.grounded, `Entrada baño: ${inside.pos}`);
  await page.evaluate(() => window.marq.look(Math.PI));
  const outside = await walk(300);
  assert.ok(outside.pos[2] > -5.95 && outside.grounded, `Salida baño: ${outside.pos}`);
  report.push({ name: 'bathroom', inside, outside });

  for (const [name, x, y, yaw, pitch] of [
    ['bathroom-threshold', 4.43, 6.72, Math.PI, -1],
    ['bedroom1', 2.88, 6.82, .75, -.65],
    ['bedroom2', 2.35, 4.05, .65, -.65],
    ['outlet-living', 5.12, 2.5, 0, -.9],
    ['outlet-bedroom', 4.65, 5.3, Math.PI / 2, -.8],
    ['outlet-bathroom', 6.5, 6.35, Math.PI / 2, -.85],
  ]) {
    await place(x, y, yaw, pitch);
    await page.screenshot({ path: `${out}/${name}.png` });
  }
  assert.deepEqual(errors, []);
  await writeFile(`${out}/report.json`, JSON.stringify({ report, errors }, null, 2) + '\n');
  console.log('APARTMENT_BROWSER_OK', JSON.stringify(report));
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
