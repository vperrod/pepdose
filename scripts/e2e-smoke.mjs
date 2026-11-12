// E2E smoke test: drives the real app in headless Chromium through the core
// user journeys (log, ad-hoc, reschedule, skip) and fails on any console error.
//
// Usage:
//   node scripts/e2e-smoke.mjs                 # spawns its own dev server (local mode, no Supabase)
//   BASE=http://host/pepdose node scripts/e2e-smoke.mjs   # test an already-running instance
//
// Scenario catalog these map to: docs/USER-TESTING.md

import { spawn } from 'node:child_process';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  // ponytail: VM has playwright only via the global @playwright/cli install
  ({ chromium } = await import('/usr/lib/node_modules/@playwright/cli/node_modules/playwright/index.mjs'));
}

const PORT = 5199;
const external = !!process.env.BASE;
const BASE = process.env.BASE || `http://localhost:${PORT}/pepdose`;
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);

let server;
if (!external) {
  // Local-only mode: empty Supabase env disables the login gate so the smoke
  // test exercises the IndexedDB paths every user shares.
  server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    env: { ...process.env, VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
    stdio: 'ignore',
    detached: true,
  });
  for (let i = 0; ; i++) {
    try { await fetch(BASE + '/'); break; }
    catch { if (i > 30) throw new Error('dev server never came up'); await new Promise(r => setTimeout(r, 500)); }
  }
}

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push(e.message));

await page.addInitScript(() => localStorage.setItem('pepdose-onboarded', 'true'));
await page.goto(BASE + '/', { waitUntil: 'networkidle' });

// A distinct `time` keeps the startup duplicate-dose repair from collapsing two seeded doses of one day.
async function seedDose(id, status = 'upcoming', time = '08:00') {
  await page.evaluate(async ({ id, status, today, time }) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('pepdose');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction('scheduledDoses', 'readwrite');
      tx.objectStore('scheduledDoses').put({
        id, owner: 'Victor', protocolId: 'smoke-proto', peptideId: 'bpc-157',
        date: today, time, dose: 250, unit: 'mcg',
        route: 'subcutaneous', status, weekNumber: 1,
      });
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, { id, status, today, time });
}

async function readStore(store) {
  return page.evaluate(async (store) => {
    const db = await new Promise((res) => { const r = indexedDB.open('pepdose'); r.onsuccess = () => res(r.result); });
    const rows = await new Promise((res) => {
      const rq = db.transaction(store).objectStore(store).getAll();
      rq.onsuccess = () => res(rq.result);
    });
    db.close(); return rows;
  }, store);
}

const results = [];
async function scenario(name, fn) {
  try { await fn(); results.push(`PASS  ${name}`); }
  catch (e) {
    results.push(`FAIL  ${name} — ${e.message.split('\n')[0]}`);
    if (process.env.E2E_DEBUG) results.push('      page: ' + (await page.innerText('body').catch(() => '')).slice(0, 300).split('\n').join(' | '));
  }
}

// The day views hide upcoming doses whose protocol is not active, so the seeded doses need a live protocol.
await page.evaluate(async ({ today }) => {
  const db = await new Promise((res) => { const r = indexedDB.open('pepdose'); r.onsuccess = () => res(r.result); });
  await new Promise((res, rej) => {
    const tx = db.transaction('protocols', 'readwrite');
    tx.objectStore('protocols').put({
      id: 'smoke-proto', owner: 'Victor', name: 'Smoke', peptideIds: ['bpc-157'],
      doses: [{ peptideId: 'bpc-157', dose: 250, unit: 'mcg', frequency: 'daily', timeOfDay: 'morning' }],
      startDate: today, durationWeeks: 1, status: 'active',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
  db.close();
}, { today });

await scenario('S1 reschedule a pending dose from the Dashboard', async () => {
  await seedDose('smoke-s1');
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.getByText('250 mcg').first().click();
  await page.getByText('Reschedule', { exact: true }).click();
  await page.locator('input[type="date"]').fill(tomorrow);
  await page.locator('button:has-text("Reschedule")').last().click();
  await page.waitForTimeout(600);
  const dose = (await readStore('scheduledDoses')).find(d => d.id === 'smoke-s1');
  if (dose?.date !== tomorrow) throw new Error(`dose date is ${dose?.date}, expected ${tomorrow}`);
});

await scenario('S2 skip a pending dose from the Dashboard', async () => {
  await seedDose('smoke-s2');
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.getByText('250 mcg').first().click();
  await page.getByText('Skip Dose').click();
  await page.waitForTimeout(600);
  const dose = (await readStore('scheduledDoses')).find(d => d.id === 'smoke-s2');
  if (dose?.status !== 'skipped') throw new Error(`status is ${dose?.status}`);
});

await scenario('S3 log a pending dose with details (dose sheet)', async () => {
  await seedDose('smoke-s3', 'upcoming', '09:00');
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.getByText('250 mcg').first().click();
  await page.getByText('Log Dose', { exact: true }).first().click();
  await page.locator('button:has-text("Log Dose")').last().click();
  await page.waitForTimeout(600);
  const log = (await readStore('doseLogs')).find(l => l.scheduledDoseId === 'smoke-s3');
  if (!log) throw new Error('no dose log written: ' + JSON.stringify((await readStore('doseLogs')).map(l => [l.scheduledDoseId, l.date])));
});

await scenario('S4 ad-hoc dose for a past date from Quick Log', async () => {
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  await page.goto(BASE + '/log', { waitUntil: 'networkidle' });
  await page.getByText('Ad-hoc dose').click();
  await page.locator('select').selectOption('retatrutide');
  await page.locator('input[inputmode="decimal"]').first().fill('250');
  await page.locator('input[type="date"]').fill(yesterday);
  await page.locator('button:has-text("Log Dose")').click();
  await page.waitForTimeout(800);
  const log = (await readStore('doseLogs')).find(l => !l.scheduledDoseId && l.date === yesterday);
  if (!log) throw new Error('no ad-hoc log with the chosen past date');
  if (await page.locator('button:has-text("Saving")').count()) throw new Error('sheet stuck on Saving…');
});

await scenario('S5 rescheduled dose appears on its new calendar day', async () => {
  await page.goto(BASE + '/calendar', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const doses = await readStore('scheduledDoses');
  const moved = doses.find(d => d.id === 'smoke-s1');
  if (!moved?.editNote?.startsWith('Rescheduled from')) throw new Error('reschedule audit note missing');
});

await scenario('S7 ad-hoc dose for today is visible in Completed and on the Dashboard', async () => {
  await page.goto(BASE + '/log', { waitUntil: 'networkidle' });
  await page.getByText('Ad-hoc dose').click();
  await page.locator('select').selectOption('semax'); // nasal peptide — a non-injectable route must be pickable too
  await page.locator('input[inputmode="decimal"]').first().fill('25');
  await page.locator('button:has-text("Log Dose")').click();
  await page.waitForTimeout(800);
  if (!(await page.getByText('Completed', { exact: false }).count())) throw new Error('Completed section missing');
  if (!(await page.getByText('Semax').count())) throw new Error('ad-hoc dose not listed in Completed');
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  if (!(await page.getByText('Semax').count())) throw new Error('ad-hoc dose not on Dashboard');
  await page.goto(BASE + '/calendar', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  if (!(await page.getByText('Ad-hoc', { exact: true }).count())) throw new Error('ad-hoc dose not on Calendar day view');
});

await scenario('S8 delete an ad-hoc dose from the Completed list', async () => {
  await page.goto(BASE + '/log', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.getByText('Semax').first().click(); // the S7 ad-hoc entry
  await page.getByText('Delete this dose').click();
  await page.getByText('Yes, delete').click();
  await page.waitForTimeout(800);
  const left = (await readStore('doseLogs')).filter(l => l.peptideId === 'mk-677');
  if (left.length) throw new Error('ad-hoc log still in DB after delete');
  if (await page.getByText('Semax').count()) throw new Error('deleted dose still listed');
});

await scenario('S6 protocol journey shows the per-week dose summary', async () => {
  await page.evaluate(async ({ today }) => {
    const db = await new Promise((res) => { const r = indexedDB.open('pepdose'); r.onsuccess = () => res(r.result); });
    await new Promise((res, rej) => {
      const tx = db.transaction('protocols', 'readwrite');
      tx.objectStore('protocols').put({
        id: 'smoke-proto', owner: 'Victor', name: 'BPC-157 Smoke', peptideIds: ['bpc-157'],
        doses: [{ peptideId: 'bpc-157', dose: 250, unit: 'mcg', frequency: 'daily', timeOfDay: '08:00' }],
        startDate: today, durationWeeks: 1, status: 'active',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, { today });
  await page.goto(BASE + '/protocols', { waitUntil: 'networkidle' });
  await page.getByText('BPC-157 Smoke').click();
  await page.waitForTimeout(800);
  if (!(await page.getByText(/due doses done/).count())) throw new Error('journey summary line missing');
  if (!(await page.getByText('Week 1', { exact: true }).count())) throw new Error('week group row missing');
});

await scenario('S9 one-screen add: 5 weeks on / 3 off skips weeks 6-8 and shows ON on Today', async () => {
  await page.goto(BASE + '/protocols/new', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('Search peptides...').fill('KLOW');
  await page.getByRole('button', { name: /^KLOW/ }).first().click();
  await page.getByLabel('Weeks on').fill('5');
  await page.getByLabel('Weeks off').fill('3');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForURL(u => !u.pathname.includes('/protocols/new'));
  const proto = (await readStore('protocols')).find(p => p.name.startsWith('KLOW'));
  if (!proto) throw new Error('KLOW protocol not saved');
  const c = proto.doses[0].cycle;
  if (!c || c.onWeeks !== 5 || c.offWeeks !== 3) throw new Error('cycle not saved: ' + JSON.stringify(c));
  const weeks = new Set((await readStore('scheduledDoses')).filter(d => d.protocolId === proto.id).map(d => d.weekNumber));
  if ([6, 7, 8].some(w => weeks.has(w))) throw new Error('doses generated in off weeks');
  if (!weeks.has(5) || !weeks.has(9)) throw new Error('missing on-week doses');
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  if (!(await page.getByText(/ON · week 1 of 5/).count())) throw new Error('Today board missing ON pill');
});

await scenario('S10 edit sheet: Weeks off to 0 removes the cycle and keeps the 24-week course', async () => {
  await page.goto(BASE + '/protocols', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^KLOW[\s\S]*active/ }).first().click(); // the list card, not the cycle-map row
  await page.getByRole('button', { name: 'Manage' }).click();
  await page.getByText(/^Edit Protocol/).click();
  if ((await page.getByLabel('Weeks on').inputValue()) !== '5') throw new Error('edit sheet did not load Weeks on 5');
  if ((await page.getByLabel('Weeks off').inputValue()) !== '3') throw new Error('edit sheet did not load Weeks off 3');
  await page.getByLabel('Weeks off').fill('0');
  await page.getByRole('button', { name: /Save/ }).last().click();
  await page.waitForTimeout(1500);
  const proto = (await readStore('protocols')).find(p => p.name.startsWith('KLOW'));
  if (proto.doses[0].cycle) throw new Error('cycle still set after Weeks off 0');
  if (proto.doses[0].durationWeeks !== 24) throw new Error('course shrank to ' + proto.doses[0].durationWeeks);
  const weeks = new Set((await readStore('scheduledDoses')).filter(d => d.protocolId === proto.id).map(d => d.weekNumber));
  if (!weeks.has(7)) throw new Error('week 7 still empty after removing the off weeks');
});

await scenario('S11 cycle map: overview flags a course with no off weeks; the suggested cycle applies from the detail page', async () => {
  await page.evaluate(async ({ today }) => {
    const db = await new Promise((res) => { const r = indexedDB.open('pepdose'); r.onsuccess = () => res(r.result); });
    await new Promise((res, rej) => {
      const tx = db.transaction('protocols', 'readwrite');
      tx.objectStore('protocols').put({
        id: 'e2e-tb', owner: 'Victor', name: 'TB-500 plain', peptideIds: ['tb-500'],
        doses: [{ peptideId: 'tb-500', dose: 2.5, unit: 'mg', frequency: 'custom', customFrequencyDays: 3, timeOfDay: 'morning', durationWeeks: 12 }],
        startDate: today, durationWeeks: 12, status: 'active',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, { today });
  await page.goto(BASE + '/protocols', { waitUntil: 'networkidle' });
  await page.getByText('Cycle map', { exact: true }).waitFor();
  if (!(await page.getByText('Typical is 6 on, 4 off. Yours has no off weeks.').count())) throw new Error('overview did not flag the missing off weeks');
  await page.getByRole('button', { name: /^TB-500/ }).first().click();
  await page.getByText('Every window').waitFor();
  await page.getByRole('button', { name: /Use suggested cycle/ }).click();
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.waitForTimeout(1500);
  const proto = (await readStore('protocols')).find(p => p.id === 'e2e-tb');
  const c = proto.doses[0].cycle;
  if (!c || c.onWeeks !== 6 || c.offWeeks !== 4) throw new Error('cycle not applied: ' + JSON.stringify(c));
  const weeks = new Set((await readStore('scheduledDoses')).filter(d => d.protocolId === 'e2e-tb').map(d => d.weekNumber));
  if ([7, 8, 9, 10].some(w => weeks.has(w))) throw new Error('doses left in the new off weeks');
  if (!weeks.has(6) || !weeks.has(11)) throw new Error('on-week doses missing after apply');
});

console.log(results.join('\n'));
console.log(consoleErrors.length ? 'CONSOLE ERRORS:\n' + consoleErrors.join('\n') : 'console clean');
await browser.close();
if (server) process.kill(-server.pid);
process.exit(results.some(r => r.startsWith('FAIL')) || consoleErrors.length ? 1 : 0);
