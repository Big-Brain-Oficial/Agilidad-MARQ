// Con el build servido en :3100: node scripts/verify-apartment.mjs
// ?debug permite ubicar al visitante y usar el mismo movimiento/colisiones del recorrido.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, devices } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
let activePage = page;
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

  // La entrada cierra el paso desde ambos lados y responde a la tecla real, no a la API debug.
  await place(5.93, 8.8, Math.PI, -.25);
  await page.screenshot({ path: `${out}/entrance-closed.png` });
  await place(5.93, 8.25, Math.PI);
  const closed = await walk(500);
  assert.ok(closed.pos[2] < -7.75 && closed.grounded, `Puerta cerrada atravesable: ${closed.pos}`);
  assert.equal(await page.evaluate(() => window.marq.state().prompt), 'Abrir puerta del departamento');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(1200);
  const entered = await walk(550);
  assert.ok(entered.pos[2] > -6.65 && entered.grounded, `Puerta abierta bloquea entrada: ${entered.pos}`);
  await place(5.93, 6.35, .53);
  assert.equal(await page.evaluate(() => window.marq.state().prompt), 'Cerrar puerta del departamento');
  await page.screenshot({ path: `${out}/entrance-open.png` });
  // Clic con pointer lock: el mismo control que usa el visitante en escritorio.
  await page.waitForFunction(() => document.pointerLockElement?.tagName === 'CANVAS');
  await page.mouse.click(640, 450);
  await page.waitForTimeout(1200);
  await place(5.93, 6.75, 0);
  const closedInside = await walk(500);
  assert.ok(closedInside.pos[2] > -7.27, `Puerta cerrada atravesable desde adentro: ${closedInside.pos}`);
  // Desde adentro hay que dejar libre el barrido antes de abrir hacia uno mismo.
  await place(5.93, 6.35, 0);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(1200);
  const exited = await walk(650);
  assert.ok(exited.pos[2] < -7.9 && exited.grounded, `Puerta abierta bloquea salida: ${exited.pos}`);
  report.push({ name: 'entrance', closed, entered, closedInside, exited });

  // El antiguo lugar de la butaca no conserva un colisionador invisible.
  await place(4, .55, 0);
  const living = await walk(400);
  assert.ok(living.pos[2] < -1.4 && living.grounded, `Butaca invisible: ${living.pos}`);
  report.push({ name: 'living-passage', living });

  for (const [name, x, y, yaw, pitch] of [
    ['bathroom-threshold', 4.43, 6.72, Math.PI, -1],
    ['bedroom1', 2.88, 6.82, .75, -.65],
    ['bedroom2', 2.35, 4.05, .65, -.65],
    ['outlet-living', 5.12, 2.5, 0, -.9],
    ['outlet-bedroom', 4.65, 5.3, Math.PI / 2, -.8],
    ['outlet-bathroom', 6.5, 6.35, Math.PI / 2, -.85],
    ['kitchen-wall', 7.1, 2.9, -.4, -.08],
    ['living-passage', 7.1, .9, 1.38, -.2],
    ['living-decoration', 4.4, .8, .64, -.05],
  ]) {
    await place(x, y, yaw, pitch);
    await page.screenshot({ path: `${out}/${name}.png` });
  }
  assert.deepEqual(errors, []);
  // Emulación táctil: el botón visible usa la misma acción que E/clic.
  await page.close();
  const mobile = await browser.newPage({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
  activePage = mobile;
  mobile.on('pageerror', (error) => errors.push(error.message));
  await mobile.goto(`${base}/recorrido/torre-natalini?debug`);
  await mobile.getByRole('button', { name: 'Comenzar recorrido', exact: true }).waitFor({ timeout: 180000 });
  await mobile.getByRole('button', { name: 'Comenzar recorrido', exact: true }).click();
  await mobile.evaluate(() => {
    window.marq.teleport(-1.57, 29.9, -8.25);
    window.marq.look(Math.PI);
  });
  await mobile.getByRole('button', { name: 'Abrir puerta del departamento', exact: true }).click();
  await mobile.waitForTimeout(1200);
  await mobile.evaluate(() => window.marq.look(2.79));
  await mobile.getByRole('button', { name: 'Cerrar puerta del departamento', exact: true }).click();
  await mobile.waitForTimeout(1200);
  await mobile.evaluate(() => window.marq.look(Math.PI));
  await mobile.getByRole('button', { name: 'Abrir puerta del departamento', exact: true }).waitFor();
  await mobile.screenshot({ path: `${out}/entrance-touch.png` });
  await mobile.close();
  report.push({ name: 'touch-door', openedAndClosed: true });
  assert.deepEqual(errors, []);
  await writeFile(`${out}/report.json`, JSON.stringify({ report, errors }, null, 2) + '\n');
  console.log('APARTMENT_BROWSER_OK', JSON.stringify(report));
} catch (error) {
  await activePage.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
