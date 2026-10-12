import { createRequire } from 'node:module';
import { readFile, readdir, mkdir, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const root = process.cwd();
const host = 'http://127.0.0.1:4173';
const screenshots = resolve(root, '.qa');
await mkdir(screenshots, { recursive: true });
const files = ['index.html', ...(await readdir('works')).filter(f => f.endsWith('.html')).map(f => 'works/' + f)];
// Every local document/resource and fragment must resolve, including project contents.
for (const file of files) {
  const html = await readFile(file, 'utf8');
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1, `${file}: one page heading`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, `${file}: unique anchors`);
  for (const match of html.matchAll(/(?:href|src|poster)="([^"]+)"/g)) {
    const url = match[1];
    if (/^(https?:|mailto:|data:)/.test(url)) continue;
    const [path, fragment] = url.split('#');
    const target = path ? resolve(dirname(file), path.split('?')[0]) : resolve(file);
    await access(target);
    if (fragment) assert((await readFile(target, 'utf8')).includes(`id="${fragment}"`), `${file}: ${url}`);
  }
}
if (process.argv.includes('--static')) {
  console.log('PASS: 11 pages; local resources and anchors; unique headings and IDs.');
  process.exit(0);
}
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('https://www.youtube.com/**', route => route.abort());
const checkOverflow = async (label) => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: horizontal overflow`);
async function screenshot(name) {
  // Full-page screenshots otherwise omit images below the lazy-load threshold.
  await page.locator('img[loading="lazy"]').evaluateAll(images => images.forEach(img => img.loading = 'eager'));
  await page.evaluate(() => Promise.all([...document.images].map(img => img.decode().catch(() => {}))));
  assert.deepEqual(await page.locator('img[src]').evaluateAll(images => images.filter(img => !img.complete || !img.naturalWidth).map(img => img.src)), [], 'All page images load');
  await page.screenshot({ path: resolve(screenshots, name), fullPage: true });
}
await page.goto(host, { waitUntil: 'networkidle' });
await screenshot('home-desktop.png');
await checkOverflow('Desktop home');
assert(!(await page.locator('#project-archive').evaluate(el => el.open)), 'The archive starts compact');
await page.locator('#project-archive > summary').click();
assert(await page.locator('#project-archive').evaluate(el => el.open));
await page.getByRole('button', { name: 'ツール 2', exact: true }).click();
assert.equal(await page.locator('.works-grid .work-card:visible').count(), 2);
assert.match(page.url(), /field=tool/);
await page.reload();
assert.equal(await page.locator('.works-grid .work-card:visible').count(), 2);
await page.getByRole('button', { name: 'ゲーム 8', exact: true }).click();
assert.equal(await page.locator('.works-grid .work-card:visible').count(), 8);
await page.getByRole('button', { name: 'サウンド 6', exact: true }).click();
assert.equal(await page.locator('.works-grid .work-card:visible').count(), 6);
await page.getByRole('button', { name: 'すべて 10', exact: true }).click();
assert.equal(await page.locator('.works-grid .work-card:visible').count(), 10);
await page.getByRole('button', { name: 'ツール 2', exact: true }).click();
assert.equal(await page.locator('.works-grid .work-card:visible').count(), 2);
await page.locator('.works-grid a[href="works/voice-filter.html?field=tool"]').click();
assert.match(page.url(), /voice-filter\.html/);
assert.match(page.url(), /field=tool/);
assert.match(await page.locator('.pagination-all').getAttribute('href'), /field=tool#works$/);
await screenshot('tool-desktop.png');
assert.equal(await page.locator('audio').count(), 4);
const image = page.locator('.project-main-img');
await image.click();
assert(await page.locator('dialog').evaluate(el => el.open));
await page.keyboard.press('Escape');
assert(!(await page.locator('dialog').evaluate(el => el.open)));
assert(await image.evaluate(el => el === document.activeElement));
await page.locator('.project-toc a[href="#part-1"]').click();
assert.match(page.url(), /#part-1$/);
await checkOverflow('Desktop tool detail');
await page.goto(host + '/works/butto-bash.html');
assert.equal(await page.locator('video source').getAttribute('src'), '../assets/videos/butto-bash-pv-web.mp4');
await screenshot('game-desktop.png');
await page.goto(host + '/works/resonance-hunt.html');
assert.equal(await page.locator('.youtube-embed').getAttribute('data-video-id'), 'VSTdBP53KcU');
assert.equal(await page.locator('iframe').count(), 0, 'YouTube remains unloaded before the visitor acts');
await page.locator('.youtube-start').click();
await page.locator('.youtube-status').waitFor({ state: 'visible' });
assert.match(await page.locator('.youtube-status').textContent(), /YouTubeリンク/);
assert.equal(await page.locator('iframe').count(), 0, 'The blocked API falls back without leaving a broken player');
// Check every project at desktop and phone sizes; images stay unloaded until needed.
for (const width of [1440, 768, 390, 320]) {
  await page.setViewportSize({ width, height: 900 });
  for (const file of files) {
    await page.goto(host + '/' + file);
    await checkOverflow(`${width}px ${file}`);
  }
}
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(host);
await screenshot('home-mobile.png');
const menu = page.getByRole('button', { name: 'メニュー' });
await menu.click();
assert.equal(await menu.getAttribute('aria-expanded'), 'true');
await page.locator('.global-nav a[href="#works"]').click();
assert.equal(await menu.getAttribute('aria-expanded'), 'false');
await menu.click();
await page.keyboard.press('Escape');
assert.equal(await menu.getAttribute('aria-expanded'), 'false');
await page.goto(host + '/works/voice-filter.html');
await screenshot('tool-mobile.png');
await page.goto(host + '/index.html#butto-bash');
await page.waitForURL('**/works/butto-bash.html');
assert.deepEqual(errors, [], 'No JavaScript errors');
await browser.close();
console.log('PASS: 11 pages; local resources and anchors; 4 responsive widths; filters and retained state; project navigation; mobile menu; lightbox keyboard/focus; video controls; legacy bookmarks.');
