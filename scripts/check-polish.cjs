// Real Chromium, isolated data, locally fulfilled production assets. No web server required.
const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const key = 'lumen-garden:local-repository';
const output = path.resolve('docs/evidence/polish');
const tests = [];
function test(name, run, options = {}) { tests.push({ name, run, options }); }
async function capture(page, text) {
  await page.getByLabel('New idea', { exact: true }).fill(text);
  await page.getByRole('button', { name: 'Add idea', exact: true }).click();
  await expect(page.getByRole('heading', { name: text, exact: true })).toBeVisible();
}
async function garden(page) { await page.getByRole('button', { name: 'Garden', exact: true }).click(); }
async function raw(page) { return page.evaluate(key => localStorage.getItem(key), key); }
async function layout(page, label) {
  const dimensions = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(dimensions.document, label).toBeLessThanOrEqual(dimensions.viewport);
}

test('pass1-selection-and-keyboard', async page => {
  const plant = page.getByRole('button', { name: /^Inspect / }).nth(3);
  const name = await plant.getAttribute('aria-label');
  await plant.focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Open idea & focus' }).focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /All ideas/ }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Your ideas, growing.' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('New idea', { exact: true })).toBeFocused();
  await page.keyboard.type('Keyboard-only idea'); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Keyboard-only idea', exact: true })).toBeFocused();
});

test('pass1-mobile-selection-and-draft', async page => {
  await page.getByLabel('New idea', { exact: true }).fill('Unfinished draft');
  await page.getByRole('button', { name: /^Inspect / }).nth(4).click();
  await expect(page.getByRole('region', { name: 'Selected idea' })).toBeFocused();
  const top = await page.getByRole('region', { name: 'Selected idea' }).evaluate(el => el.getBoundingClientRect().top);
  expect(top).toBeLessThan(800);
  await page.getByRole('button', { name: 'Notebook', exact: true }).click(); await garden(page);
  await expect(page.getByLabel('New idea', { exact: true })).toHaveValue('Unfinished draft');
  await page.getByRole('button', { name: 'Seed a goal' }).click();
  await expect(page.getByLabel('New idea', { exact: true })).toBeFocused();
}, { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });

test('pass2-responsive-long-content', async page => {
  await capture(page, 'Long content');
  const saved = JSON.parse(await raw(page));
  const seed = saved.seeds.find(seed => seed.text === 'Long content');
  seed.text = 'LongTitle'.repeat(25); seed.note = 'Context'.repeat(100); seed.nextAction = 'NextStep'.repeat(100);
  saved.focusSessions.push({ id: 'qa-outcome', seedId: seed.id, durationMinutes: 5, status: 'completed', startedAt: 1700000000000, endedAt: 1700000060000, accumulatedPauseMs: 0, previousSeedStatus: 'inbox', outcome: 'Evidence'.repeat(100) });
  await page.evaluate(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key, saved });
  await page.reload();
  await page.getByRole('button', { name: `Inspect ${seed.text}`, exact: true }).click();
  for (const width of [320, 360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await layout(page, `garden ${width}`);
    await expect(page.getByRole('region', { name: 'Selected idea' })).toContainText(seed.nextAction);
    const evidence = await page.locator('.garden-evidence').evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(evidence.scroll, `evidence ${width}`).toBeLessThanOrEqual(evidence.client);
    await page.getByRole('button', { name: 'Open idea & focus' }).click();
    await layout(page, `detail ${width}`);
    await garden(page);
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.screenshot({ path: path.join(output, 'long-content-320.png'), fullPage: true });
});

test('pass2-breakpoint-capture-and-navigation', async page => {
  for (const width of [320, 360, 760, 768, 820, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ['Garden', 'Notebook', 'Search', 'Settings']) {
      await page.getByRole('button', { name, exact: true }).click(); await layout(page, `${name} ${width}`);
    }
    await garden(page);
    const bounds = await page.getByLabel('New idea', { exact: true }).boundingBox();
    expect(bounds.width, `usable capture width at ${width}`).toBeGreaterThanOrEqual(150);
  }
});

test('pass2-readable-text-and-touch', async page => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({ path: path.join(output, 'garden-mobile.png'), fullPage: true });
  const inputFont = await page.getByLabel('New idea', { exact: true }).evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  const issues = [];
  if (inputFont < 16) issues.push(`Mobile capture font is ${inputFont}px; minimum 16px avoids forced zoom.`);
  for (const name of ['Garden', 'Notebook', 'Search', 'Settings', 'Seed a goal', 'Clear examples', 'Add idea']) {
    const bounds = await page.getByRole('button', { name, exact: true }).boundingBox();
    if (bounds.height < 44) issues.push(`${name} touch target is ${bounds.height}px; minimum 44px.`);
  }
  const contrast = await page.evaluate(() => {
    function rgb(value) { return value.match(/[\d.]+/g).slice(0, 3).map(Number); }
    function luminance(color) { return rgb(color).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((total, value, i) => total + value * [.2126, .7152, .0722][i], 0); }
    return ['.garden-inspector > .garden-eyebrow', '.growth-sprout', '.inspector-next .garden-eyebrow', '.evidence-empty small', '.inspector-local', '.garden-skin .lumen-footer'].map(selector => {
      const element = document.querySelector(selector); let ancestor = element;
      while (ancestor && getComputedStyle(ancestor).backgroundColor === 'rgba(0, 0, 0, 0)') ancestor = ancestor.parentElement;
      const foreground = luminance(getComputedStyle(element).color); const background = luminance(getComputedStyle(ancestor).backgroundColor);
      return { selector, ratio: (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05) };
    });
  });
  for (const result of contrast) if (result.ratio < 4.5) issues.push(`${result.selector} contrast is ${result.ratio.toFixed(2)}:1; minimum 4.5:1.`);
  expect(issues).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.screenshot({ path: path.join(output, 'garden-desktop.png'), fullPage: true });
});

test('pass3-storage-getter-denied', async page => {
  await expect(page.getByRole('alert')).toContainText(/storage/i);
  await page.getByLabel('New idea', { exact: true }).fill('Retain denied draft');
  await page.getByRole('button', { name: 'Add idea', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(/could not save/i);
  await expect(page.getByLabel('New idea', { exact: true })).toHaveValue('Retain denied draft');
}, { init: () => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage disabled', 'SecurityError'); } }) });

test('pass3-storage-read-fails-no-overwrite', async page => {
  await expect(page.getByRole('alert')).toContainText(/storage/i);
  await page.getByLabel('New idea', { exact: true }).fill('Must not replace unread notebook');
  await page.getByRole('button', { name: 'Add idea', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(/could not save/i);
  expect(await page.evaluate(() => window.qaWriteAttempts)).toBe(0);
}, { init: () => { window.qaWriteAttempts = 0; Storage.prototype.getItem = () => { throw new DOMException('Read denied', 'SecurityError'); }; Storage.prototype.setItem = () => { window.qaWriteAttempts++; }; } });

test('pass3-quota-and-retry', async page => {
  await capture(page, 'Accepted original'); await garden(page);
  const before = await raw(page);
  await page.evaluate(() => { window.qaSetItem = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new DOMException('Storage quota exceeded', 'QuotaExceededError'); }; });
  await page.getByLabel('New idea', { exact: true }).fill('Retry my draft');
  await page.getByRole('button', { name: 'Add idea', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(/quota/i);
  await expect(page.getByLabel('New idea', { exact: true })).toHaveValue('Retry my draft');
  expect(await raw(page)).toBe(before);
  await page.evaluate(() => { Storage.prototype.setItem = window.qaSetItem; });
  await page.getByRole('button', { name: 'Add idea', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Retry my draft', exact: true })).toBeVisible();
  const state = JSON.parse(await raw(page));
  expect(state.seeds.filter(seed => seed.text === 'Retry my draft')).toHaveLength(1);
  await page.reload(); await expect(page.getByRole('button', { name: 'Inspect Accepted original' })).toBeVisible();
});

test('pass3-paused-focus-and-evidence-reload', async page => {
  await capture(page, 'Persistent focus');
  await page.getByRole('button', { name: 'Start focus', exact: true }).click();
  await page.getByRole('textbox', { name: 'What changed?', exact: true }).fill('A durable unfinished observation');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const before = await raw(page); await page.reload();
  await page.getByRole('button', { name: 'Inspect Persistent focus', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Selected idea' })).toContainText('Paused');
  expect(await raw(page)).toBe(before);
  await page.getByRole('button', { name: 'Open idea & focus' }).click();
  await expect(page.getByRole('textbox', { name: 'What changed?', exact: true })).toHaveValue('A durable unfinished observation');
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Save progress', exact: true }).click();
  await page.reload(); await page.getByRole('button', { name: 'Inspect Persistent focus', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Selected idea' })).toContainText('A durable unfinished observation');
  await expect(page.getByRole('region', { name: 'Selected idea' })).toContainText('Progress recorded');
});

test('pass3-clear-cancel-undo-and-archive', async page => {
  await capture(page, 'Keep my personal idea'); await garden(page);
  const before = await raw(page);
  page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: 'Clear examples', exact: true }).click();
  expect(await raw(page)).toBe(before);
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Clear examples', exact: true }).click();
  expect(JSON.parse(await raw(page)).seeds.map(seed => seed.text)).toEqual(['Keep my personal idea']);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); expect(await raw(page)).toBe(before);
  await page.getByRole('button', { name: 'Inspect Keep my personal idea', exact: true }).click();
  await page.getByRole('button', { name: 'Open idea & focus' }).click();
  await page.getByRole('button', { name: 'Archive idea', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Inspect Keep my personal idea', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByLabel('Search ideas', { exact: true }).fill('Keep my personal');
  await page.getByRole('button', { name: 'Open Keep my personal idea', exact: true }).click();
  await page.getByRole('button', { name: 'Restore idea', exact: true }).click();
  await garden(page); await expect(page.getByRole('button', { name: 'Inspect Keep my personal idea', exact: true })).toBeVisible();
});

test('pass3-import-validation-confirmation-and-undo', async page => {
  await capture(page, 'Keep my existing notebook'); const before = await raw(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByText('Restore from a backup', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Import JSON', exact: true }).fill('{broken');
  await page.getByRole('button', { name: 'Preview import', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible(); expect(await raw(page)).toBe(before);
  await expect(page.getByRole('button', { name: 'Replace local data', exact: true })).toHaveCount(0);
  const replacement = JSON.parse(before); replacement.seeds = []; replacement.beds = []; replacement.threads = []; replacement.focusSessions = [];
  await page.getByRole('textbox', { name: 'Import JSON', exact: true }).fill(JSON.stringify(replacement));
  await page.getByRole('button', { name: 'Preview import', exact: true }).click();
  expect(await raw(page)).toBe(before);
  page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: 'Replace local data', exact: true }).click();
  expect(await raw(page)).toBe(before);
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Replace local data', exact: true }).click();
  expect(JSON.parse(await raw(page)).seeds).toEqual([]);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); expect(await raw(page)).toBe(before);
  await garden(page); await expect(page.getByRole('button', { name: 'Inspect Keep my existing notebook', exact: true })).toBeVisible();
});

test('pass3-corrupt-storage-recovery', async page => {
  await expect(page.getByRole('alert')).toContainText(/preserved for recovery/i);
  expect(await raw(page)).toBe('{original malformed notebook');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export recovery copy', exact: true }).click();
  const downloaded = await downloadEvent;
  expect(fs.readFileSync(await downloaded.path(), 'utf8')).toBe('{original malformed notebook');
  await garden(page); await capture(page, 'Recovered fresh idea');
  expect(await page.evaluate(key => localStorage.getItem(key + ':recovery'), key)).toBe('{original malformed notebook');
  await page.reload(); await expect(page.getByRole('button', { name: 'Inspect Recovered fresh idea', exact: true })).toBeVisible();
}, { init: () => { if (!sessionStorage.getItem('qa-corrupt-loaded')) { localStorage.setItem('lumen-garden:local-repository', '{original malformed notebook'); sessionStorage.setItem('qa-corrupt-loaded', '1'); } } });

test('pass3-empty-capture-and-export', async page => {
  const before = await raw(page);
  await page.getByLabel('New idea', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Add idea', exact: true }).click(); expect(await raw(page)).toBe(before);
  await capture(page, '<script>window.qaInjected = true</script>');
  expect(await page.evaluate(() => window.qaInjected)).toBeUndefined();
  const saved = await raw(page); await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const downloadEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  const downloaded = await downloadEvent; expect(fs.readFileSync(await downloaded.path(), 'utf8')).toBe(saved);
  await page.getByRole('button', { name: 'Open advanced workspace', exact: true }).click();
  await expect(page.getByText('<script>window.qaInjected = true</script>', { exact: true }).first()).toBeVisible();
});

test('pass2-reduced-motion', async page => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const plant = page.getByRole('button', { name: /^Inspect / }).first(); await plant.hover();
  const motion = await plant.evaluate(el => ({ transform: getComputedStyle(el).transform, duration: getComputedStyle(el).transitionDuration }));
  expect(motion.transform).toBe('none'); expect(motion.duration).toBe('0s');
});

test('pass2-empty-state-contrast', async page => {
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Clear examples', exact: true }).click();
  await expect(page.getByText('Every garden starts with one idea.', { exact: true })).toBeVisible();
  const ratio = await page.locator('.inspector-placeholder > p:not(.garden-eyebrow)').evaluate(el => {
    const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const text = luminance(getComputedStyle(el).color); const background = luminance(getComputedStyle(el.closest('.garden-inspector')).backgroundColor);
    return (Math.max(text, background) + .05) / (Math.min(text, background) + .05);
  });
  expect(ratio, 'empty inspector guidance contrast').toBeGreaterThanOrEqual(4.5);
  await page.getByRole('button', { name: 'Plant your first idea', exact: true }).click();
  await expect(page.getByLabel('New idea', { exact: true })).toBeFocused();
});

test('pass3-clear-examples-with-personal-cross-link', async page => {
  await capture(page, 'Personal work in example project');
  const state = JSON.parse(await raw(page));
  const seed = state.seeds.find(item => item.text === 'Personal work in example project');
  seed.bedId = state.beds[0].id; seed.status = 'active';
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state }); await page.reload();
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Clear examples', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Inspect Personal work in example project', exact: true })).toBeVisible();
  expect(JSON.parse(await raw(page)).seeds[0].bedId).toBeUndefined();
});

test('pass3-invalid-date-import', async page => {
  await capture(page, 'Valid timestamp goal');
  await page.getByRole('button', { name: 'Start focus', exact: true }).click();
  await page.getByRole('textbox', { name: 'What changed?', exact: true }).fill('Valid outcome');
  await page.getByRole('button', { name: 'Save progress', exact: true }).click();
  const before = await raw(page); const payload = JSON.parse(before); payload.focusSessions[0].endedAt = 1e20;
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByText('Restore from a backup', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Import JSON', exact: true }).fill(JSON.stringify(payload));
  await page.getByRole('button', { name: 'Preview import', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(/focus session/i);
  await expect(page.getByRole('button', { name: 'Replace local data', exact: true })).toHaveCount(0);
  expect(await raw(page)).toBe(before);
});

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, headless: true });
  const results = [];
  try {
    for (const spec of tests.filter(test => !process.argv[2] || test.name.includes(process.argv[2]))) {
      const { init, ...contextOptions } = spec.options;
      const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, ...contextOptions });
      const errors = []; let page;
      try {
        await context.route('**/*', async route => {
          const url = new URL(route.request().url());
          if (url.origin !== 'http://lumen.test') return route.abort();
          const file = path.resolve('dist', '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
          if (!file.startsWith(path.resolve('dist') + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'Not found' });
          await route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html' });
        });
        if (init) await context.addInitScript(init);
        page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://lumen.test/');
        await expect(page.getByRole('heading', { name: 'Your ideas, growing.' })).toBeVisible({ timeout: 4000 });
        await spec.run(page);
        expect(errors).toEqual([]);
        results.push({ name: spec.name, status: 'passed', pageErrors: errors });
      } catch (error) {
        if (page) { await page.screenshot({ path: path.join(output, spec.name + '-failure.png'), fullPage: true }); fs.writeFileSync(path.join(output, spec.name + '-failure.txt'), await page.locator('body').innerText() + '\n\n' + await page.locator('body').ariaSnapshot() + '\n' + await page.locator('textarea').evaluateAll(els=>els.map(el=>el.outerHTML).join('\n'))); }
        results.push({ name: spec.name, status: 'failed', error: error.message, pageErrors: errors });
      } finally { await context.close(); }
      console.log(`${results.at(-1).status}: ${spec.name}`);
    }
  } finally { await browser.close(); }
  const report = { date: new Date().toISOString(), browser: 'Chromium', transport: 'Production assets fulfilled locally by Playwright; no HTTP server integration.', data: 'Fresh isolated browser contexts; only synthetic QA records and labeled examples.', results };
  fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(report, null, 2));
  for (const result of results.filter(r => r.status === 'failed')) console.error(`${result.name}: ${result.error}\nPage errors: ${result.pageErrors.join('; ')}`);
  if (results.some(result => result.status === 'failed')) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
