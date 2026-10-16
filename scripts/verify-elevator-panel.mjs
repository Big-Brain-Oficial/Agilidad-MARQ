// Servir el build en :3100. La API debug solo posiciona; las acciones usan E/clic y el HUD táctil.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, devices } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const out = '.cache/elevator-panel';
await mkdir(out, { recursive: true });
const errors = [], report = [];
let page;
async function aimPanel() {
  await page.evaluate(() => window.marq.look(Math.atan2(-1.025, -.275), Math.atan2(-.30, Math.hypot(1.025, .275))));
}
try {
  for (const touch of [false, true]) {
    page = await browser.newPage(touch ? { ...devices['iPhone 13'], deviceScaleFactor: 1 } : { viewport: { width: 1280, height: 900 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://localhost:3100/recorrido/torre-natalini?debug');
    await page.getByRole('button', { name: 'Comenzar recorrido', exact: true }).waitFor({ timeout: 180000 });
    await page.getByRole('button', { name: 'Comenzar recorrido', exact: true }).click();
    await page.evaluate(() => { window.marq.teleport(0, .08, -9.45); window.marq.look(0); });
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => window.marq.state().prompt), null, 'Mirar al fondo no debe activar la botonera');
    await page.keyboard.press('KeyE');
    assert.equal(await page.evaluate(() => window.marq.state().riding), false);
    await aimPanel();
    await page.waitForFunction(() => window.marq.state().prompt?.startsWith('Subir al departamento'));
    await page.screenshot({ path: `${out}/${touch ? 'touch' : 'desktop'}-panel.png` });
    if (touch) await page.getByRole('button', { name: /Subir al departamento muestra/ }).click();
    else await page.keyboard.press('KeyE');
    await page.waitForFunction(() => window.marq.state().riding);
    await page.waitForFunction(() => !window.marq.state().riding && window.marq.state().level === 1, null, { timeout: 60000 });
    const upstairs = await page.evaluate(() => window.marq.state().pos);
    assert.ok(Math.abs(upstairs[1] - 31.55) < .08);
    await aimPanel();
    await page.waitForFunction(() => window.marq.state().prompt === 'Bajar al hall');
    await page.screenshot({ path: `${out}/${touch ? 'touch' : 'desktop'}-upstairs.png` });
    if (touch) await page.getByRole('button', { name: 'Bajar al hall', exact: true }).click();
    else {
      await page.waitForFunction(() => !!document.pointerLockElement);
      await page.mouse.click(640, 450);
    }
    await page.waitForFunction(() => window.marq.state().riding);
    await page.waitForFunction(() => !window.marq.state().riding && window.marq.state().level === 0, null, { timeout: 60000 });
    const downstairs = await page.evaluate(() => window.marq.state().pos);
    assert.ok(Math.abs(downstairs[1] - 1.73) < .08);
    if (!touch) {
      await page.evaluate(() => { window.marq.teleport(-1.57, 29.9, -7.95); window.marq.look(0, -.2); });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${out}/neighbor-door.png` });
      assert.equal(await page.evaluate(() => window.marq.state().prompt), null, 'La puerta del vecino no tiene acción');
      await page.keyboard.press('KeyE');
      await page.evaluate(() => window.marq.press('KeyW', 900));
      const stopped = await page.evaluate(() => window.marq.state().pos);
      assert.ok(stopped[2] > -8.94, `No se puede atravesar la puerta decorativa: ${stopped}`);
      await page.evaluate(() => { window.marq.teleport(-1.57, 29.9, -8.35); window.marq.look(-Math.PI / 2); });
      await page.evaluate(() => window.marq.press('KeyW', 900));
      assert.ok((await page.evaluate(() => window.marq.state().pos))[0] > .5, 'La puerta deja libre el pasillo');
    }
    report.push({ touch, upstairs, downstairs });
    await page.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${out}/report.json`, JSON.stringify({ report, errors }, null, 2));
  console.log('ELEVATOR_PANEL_OK', JSON.stringify(report));
} catch (e) {
  console.error(await page?.evaluate(() => { const s = window.marq?.state(); return s && { pos: s.pos, level: s.level, phase: s.phase, riding: s.riding, prompt: s.prompt }; }).catch(() => null), errors);
  await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw e;
} finally {
  await browser.close();
}
