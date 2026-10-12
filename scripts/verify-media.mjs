// Exercise the error paths without depending on YouTube availability or credentials.
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = await readFile(new URL('../site.js', import.meta.url), 'utf8');
function fixture(protocol = 'https:') {
  const requests = [];
  const frames = [];
  const timers = new Map();
  const players = [];
  let timerId = 0;
  const element = () => ({
    hidden: false, textContent: '', innerHTML: '<span class="youtube-start-label">再生</span>',
    classList: { add() {}, remove() {}, toggle() {} },
    attributes: {}, listeners: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, fn) { this.listeners[name] = fn; },
    remove() { const i = frames.indexOf(this); if (i >= 0) frames.splice(i, 1); },
    querySelector() { return this.label ||= element(); },
    replaceWith(link) { this.replacement = link; }
  });
  const button = element();
  const status = element();
  status.hidden = true;
  const container = {
    dataset: { videoId: 'VSTdBP53KcU', videoTitle: 'Resonance Hunt PV' },
    querySelector(selector) { return selector === '.youtube-start' ? button : selector === '.youtube-status' ? status : frames[0]; },
    prepend(frame) { frames.unshift(frame); }
  };
  const document = {
    body: element(),
    head: { append(script) { requests.push(script); } },
    createElement() { return element(); },
    querySelector() { return null; },
    getElementById() { return null; },
    querySelectorAll(selector) { return selector === '.youtube-embed' ? [container] : []; },
    addEventListener() {}
  };
  const window = { addEventListener() {} };
  const location = { protocol, origin: 'https://portfolio.example', search: '', hash: '' };
  vm.runInNewContext(source, {
    document, window, location, URLSearchParams,
    matchMedia: () => ({ addEventListener() {} }),
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; },
    clearTimeout: id => timers.delete(id)
  });
  const readyApi = () => {
    window.YT = {
      PlayerState: { PLAYING: 1 },
      Player: class {
        constructor(frame, options) { this.frame = frame; this.events = options.events; players.push(this); }
        destroy() { this.frame.remove(); this.destroyed = true; }
      }
    };
    window.onYouTubeIframeAPIReady();
  };
  return { button, status, requests, frames, timers, players, readyApi };
}

const embedded = fixture();
assert.equal(embedded.requests.length, 0, 'YouTube is not contacted before a click');
const first = embedded.button.listeners.click();
assert.equal(embedded.requests.length, 1);
assert.equal(embedded.frames[0].referrerPolicy, 'strict-origin-when-cross-origin');
const url = new URL(embedded.frames[0].src);
assert.equal(url.searchParams.get('origin'), 'https://portfolio.example');
assert.equal(url.searchParams.get('enablejsapi'), '1');
embedded.readyApi();
await first;
embedded.players[0].events.onReady();
assert.equal(embedded.status.hidden, true);
embedded.players[0].events.onError({ data: 153 });
assert.match(embedded.status.textContent, /エラー153/);
assert.equal(embedded.button.hidden, false);
assert.equal(embedded.frames.length, 0, 'Remove a broken player');
assert.equal(embedded.players[0].destroyed, true);
await embedded.button.listeners.click();
assert.equal(embedded.frames.length, 1, 'Retry creates a single fresh player');
embedded.players[1].events.onAutoplayBlocked();
assert.match(embedded.status.textContent, /再生ボタン/);
embedded.players[1].events.onStateChange({ data: 1 });
assert.equal(embedded.status.hidden, true);
assert.equal(embedded.button.hidden, true);
embedded.players[1].events.onError({ data: 101 });
assert.match(embedded.status.textContent, /許可されていません/);

const failedApi = fixture();
const pending = failedApi.button.listeners.click();
failedApi.requests[0].onerror();
await pending;
assert.equal(failedApi.button.hidden, false);
assert.match(failedApi.status.textContent, /YouTubeリンク/);
assert.equal(failedApi.frames.length, 0, 'A failed API must not leave an empty frame above the fallback');

const timedOut = fixture();
const waiting = timedOut.button.listeners.click();
[...timedOut.timers.values()].forEach(callback => callback());
await waiting;
assert.equal(timedOut.status.hidden, false);
assert.equal(timedOut.button.hidden, false);
assert.equal(timedOut.frames.length, 0, 'Timeout must not leave an empty frame');

const directFile = fixture('file:');
assert.equal(directFile.requests.length, 0);
assert.equal(directFile.button.listeners.click, undefined);
assert.match(directFile.button.replacement.href, /youtube\.com\/watch\?v=VSTdBP53KcU/);
assert.match(directFile.button.replacement.attributes['aria-label'], /YouTubeで再生/);
console.log('PASS: deferred API loading; real origin; error 153 and embed restrictions; retry; autoplay blocking; network failure; timeout; file preview fallback.');
