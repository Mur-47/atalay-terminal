'use strict';

// What's new, and tips (tips on the Mac only).
//  · What's new: every release's notes, newest first: on the Mac from the API (GET v1/releases), on Windows from the
//    CHANGELOG inside the app (the "releases" call, windows/src/releasenotes.js). They show after an update (the
//    corner's "updated" note, messages.js), in the notifications, in Settings and under Help → What's New (cloud.js):
//    only this platform's lines, the changes you voted for on the Roadmap first and marked, the first few as the
//    highlights and the rest behind "all changes".
//  · Tips: Help → Tips lists the features few people find (cloud.js). The dashboard also shows one of them, at most one a
//    day, beside its control, and only to someone who never used that feature; × puts it away for good. No tour. Its
//    tips name the Mac's keys, so Windows has none.
window.WhatsNew = (() => {
  const WIN = window.__platform === 'win32';
  const ON = true;
  const TIPS_ON = !WIN;
  const api = (path) =>
    window.webkit.messageHandlers.cloud.postMessage({ type: 'social', method: 'GET', path }).catch(() => ({ error: 'offline' }));
  const TOP = 3; // the highlights: the corner's note and the window show these first

  // ---------- a release's lines ----------
  // A line for the other platform goes: on the Mac "Windows: …", or one marked "(Windows only)" or "(Windows)"; on
  // Windows "Mac: …", one marked "(Mac)" or "(Mac only)", or one naming the Mac's keys (⌘, ⌥). A line marked for this one
  // loses the mark ("(Mac)" says nothing on a Mac, "Windows: " nothing on Windows).
  const OTHER = WIN ? /^\s*mac(os)?\s*:|\(\s*mac(os)?(\s+only)?\s*\)|[⌘⌥]/i : /^\s*windows\s*:|\(\s*windows(\s+only)?\s*\)/i;
  const OWN = WIN ? /^\s*windows\s*:\s*|\s*\(\s*windows(\s+only)?\s*\)/gi : /\s*\(\s*mac(os)?(\s+only)?\s*\)/gi;
  const lines = (notes) =>
    String(notes || '')
      .split(/\n+/)
      .map((l) => l.replace(/^\s*[-•*]\s*/, '').trim())
      .filter((l) => l && !OTHER.test(l))
      .map((l) => l.replace(OWN, '').trim())
      .filter(Boolean);
  // One short line, for the corner and the notifications: no credits, up to its first full stop or semicolon (the
  // corner cuts what's still too long).
  const short = (l) => String(l).replace(/\.?\s*\bThanks to\b.*$/i, '').split(/[.;]\s/)[0].trim();

  // "0.21.0", "0.21", "v0.21.0-staging" are one version.
  const norm = (v) => String(v || '').trim().replace(/^v/i, '').replace(/-.*$/, '').replace(/(\.0)+$/, '');
  // Words to match a Roadmap feature with a line's topic ("Codex: …" for "Codex optimization").
  const words = (s) => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3).map((w) => w.replace(/s$/, ''));
  const topic = (l) => (/^([^:]{1,40}):\s/.exec(l) || [])[1] || '';

  // A release as it shows: what you voted for first, each marked (`voted`), on the line about it or, when no line is,
  // on a line of its own (the feature's name); then the others as written (the notes lead with what matters most).
  // `top` are the highlights, `more` the rest.
  function arrange(release, items) {
    const rest = lines(release && release.notes).map((text) => ({ text, voted: false }));
    const first = [];
    for (const it of items || []) {
      const w = words(it.title);
      const at = rest.findIndex((l) => words(topic(l.text)).some((x) => w.includes(x)));
      first.push(at >= 0 ? { ...rest.splice(at, 1)[0], voted: true } : { text: it.title, voted: true });
    }
    const all = [...first, ...rest], n = Math.max(TOP, first.length);
    return { top: all.slice(0, n), more: all.slice(n) };
  }

  // ---------- releases ----------
  let list = null;
  let loading = null;
  const releases = (again) => {
    if (!ON) return Promise.resolve(null);
    if (list && !again) return Promise.resolve(list);
    // Windows: the app's own CHANGELOG (no network, no build numbers).
    const ask = () => WIN
      ? window.webkit.messageHandlers.cloud.postMessage({ type: 'releases' }).catch(() => ({ error: 'offline' }))
      : api('v1/releases?limit=8');
    loading =
      loading ||
      ask().then((r) => {
        loading = null;
        if (r && Array.isArray(r.releases)) list = r.releases;
        return list;
      });
    return loading;
  };
  // A version's release: by its build, else by its number, else (a staging build: its own version isn't out) the newest
  // one before it.
  const exact = (rs, version, build) => {
    const v = norm(version);
    return (rs || []).find((r) => build && r.build === build) || (rs || []).find((r) => norm(r.version) === v) || null;
  };
  function find(rs, version, build) {
    if (!rs || !rs.length) return null;
    return exact(rs, version, build) || (build ? rs.find((r) => r.build < build) : null) || null;
  }
  // The same, for a build older than the newest few: asked for by itself (GET v1/releases?build=), then kept in the list,
  // so the notifications show it too. Only a reply for that very build counts (an API without ?build= sends the newest).
  async function release(version, build) {
    const rs = await releases();
    if (!rs) return null;
    if (!exact(rs, version, build) && build) {
      const got = await api(`v1/releases?build=${encodeURIComponent(build)}`);
      const r = got && Array.isArray(got.releases) ? got.releases.find((x) => x.build === build) : null;
      if (r && !rs.some((x) => x.build === r.build)) {
        rs.push(r);
        rs.sort((a, b) => b.build - a.build);
      }
    }
    return find(rs, version, build);
  }
  // The Roadmap features you voted for that shipped in a version (GET v1/roadmap: `mine`, and the version it shipped in).
  async function voted(version) {
    const r = await api('v1/roadmap');
    const v = norm(version);
    return r && Array.isArray(r.moved) ? r.moved.filter((i) => i.status === 'shipped' && i.mine && norm(i.version) === v) : [];
  }

  // ---------- tips ----------
  // `at`: the control a tip shows beside on the dashboard (none: Help → Tips only). `key`: the shortcut it names, as the
  // user set it (Settings › Shortcuts); a tip whose keys were taken off is left out of the list.
  const TIPS = [
    { id: 'wheel', title: 'Shortcut wheel', at: '#newchat', key: 'shortcutsWheel',
      text: (k) => `Click with four fingers anywhere in the app${k ? `, or ${k},` : ''} to open your shortcut wheel of favourite folders.` },
    { id: 'notes', title: 'Quick note', at: '#p-notes > header',
      text: () => 'Press ⇧⌘J to type in your note from anywhere on the dashboard.' },
    { id: 'streamer', title: 'Streamer mode', at: '#strm',
      text: () => 'Recording or sharing your screen? Turn on streamer and every project, chat and file gets a made-up name.' },
    { id: 'copyReply', title: 'Copy a reply', key: 'copyReply', need: true,
      text: (k) => `Press ${k} to copy Claude's whole last reply in the chat in front.` },
    { id: 'undoClose', title: 'Undo close', key: 'undoClose', need: true,
      text: (k) => `Closed a tab or window by mistake? Press ${k} to bring it back.` },
    { id: 'tile', title: 'Snap a window',
      text: () => 'Hold fn and ⌃ and press an arrow key to snap a chat window to that side of the screen.' },
    { id: 'themes', title: 'Themes', at: '#activity [data-view=themes]',
      text: () => 'Point at a theme to see the whole app in it, then click to keep it.' },
    { id: 'keys', title: 'Your own keys', key: 'keyboardShortcuts',
      text: (k) => `${k ? `Press ${k}` : 'Open Help › Keyboard Shortcuts'} to see every shortcut, and change any of them in Settings › Shortcuts.` },
  ];
  // `keyOf(id)`: a shortcut's keys as the user set them now (Shortcuts.swift, through the "keys" handler); "" for keys
  // taken off, undefined for one it doesn't know (the default below is named then). Help → Tips and the dashboard's tip
  // both read them so.
  const DEFAULT_KEYS = { shortcutsWheel: '⌃ + middle click', copyReply: '⇧⌘C', undoClose: '⇧⌘T', keyboardShortcuts: '' };
  async function keys() {
    const h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.keys;
    const st = h ? await h.postMessage({ type: 'list' }).catch(() => null) : null;
    const all = st && Array.isArray(st.shortcuts) ? st.shortcuts : [];
    return (id) => all.find((k) => k.id === id)?.label;
  }
  // A tip as it reads with those keys; null when the keys it names were taken off.
  const tipText = (t, keyOf) => {
    const k = t.key ? (keyOf && keyOf(t.key) !== undefined ? keyOf(t.key) : DEFAULT_KEYS[t.key]) : '';
    return t.need && !k ? null : t.text(k);
  };
  const tips = (keyOf) => TIPS.map((t) => ({ id: t.id, title: t.title, text: tipText(t, keyOf) })).filter((t) => t.text !== null);

  // The dashboard's tip of the day. What it keeps, on this computer: the features used, the tips put away, and today's.
  const DASH = TIPS_ON && !!document.getElementById('app');
  const KEY = 'whatsnew.tips';
  let T = { used: [], gone: [], day: '', id: '' };
  try {
    T = Object.assign(T, JSON.parse(localStorage.getItem(KEY) || '{}'));
  } catch {}
  const keep = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(T));
    } catch {}
  };
  let tipEl = null;
  let tipFor = null;
  let follow = 0;
  const visible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  };
  const today = () => new Date().toLocaleDateString('en-CA');
  const open = (t) => !T.used.includes(t.id) && !T.gone.includes(t.id);

  // A feature was used: its tip never shows (and goes, if it's up).
  function used(id) {
    if (T.used.includes(id)) return;
    T.used.push(id);
    keep();
    if (tipFor && tipFor.id === id) hideTip();
  }

  function hideTip() {
    clearInterval(follow);
    if (tipEl) tipEl.remove();
    tipEl = tipFor = null;
  }

  // Beside its control: to the right of the activity bar's icons, under (or above) the others, inside the window.
  function place() {
    const at = tipFor && document.querySelector(tipFor.at);
    if (!tipEl || !visible(at)) return tipEl && (tipEl.hidden = true);
    tipEl.hidden = false;
    const r = at.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    let x, y;
    if (r.left < 60) {
      x = r.right + 10;
      y = r.top + r.height / 2 - h / 2;
    } else {
      x = r.left + r.width / 2 - w / 2;
      y = r.bottom + h + 18 > innerHeight ? r.top - h - 8 : r.bottom + 8;
    }
    tipEl.style.left = `${Math.round(Math.min(Math.max(8, x), innerWidth - w - 8))}px`;
    tipEl.style.top = `${Math.round(Math.min(Math.max(8, y), innerHeight - h - 8))}px`;
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function showTip(t, text) {
    hideTip();
    tipFor = t;
    tipEl = document.createElement('div');
    tipEl.className = 'wn-tip';
    tipEl.setAttribute('role', 'note');
    tipEl.innerHTML =
      `<div class="h">tip · ${esc(t.title.toLowerCase())}</div><div class="r">${esc(text)}</div>` +
      '<button type="button" class="mb-x" title="Got it · don\'t show this tip again" aria-label="Don\'t show this tip again">×</button>';
    tipEl.querySelector('.mb-x').onclick = () => {
      T.gone.push(t.id);
      keep();
      hideTip();
    };
    document.body.appendChild(tipEl);
    place();
    // The dashboard changes under it (a view of the activity bar, a panel folded): it follows, or hides with its control.
    follow = setInterval(place, 1000);
  }

  // Once the dashboard is up, in front and with nothing open over it: today's tip, or a new one if none showed today.
  // The next day the next one comes (one put away or used never does).
  let asking = false; // the keys are on their way
  function maybeTip() {
    if (!DASH || tipEl || asking) return;
    const boot = document.getElementById('boot'), ui = document.getElementById('cloudui');
    if (document.documentElement.classList.contains('paused') || visible(boot) || (ui && ui.classList.contains('on'))) return;
    if (typeof Streamer !== 'undefined' && Streamer.on) used('streamer');
    const can = TIPS.filter((t) => t.at && open(t) && visible(document.querySelector(t.at)));
    let t = null;
    if (T.day === today()) t = can.find((x) => x.id === T.id) || null;
    else if (can.length) {
      const from = TIPS.findIndex((x) => x.id === T.id);
      t = can.find((x) => TIPS.indexOf(x) > from) || can[0];
      T.day = today();
      T.id = t.id;
      keep();
    }
    if (!t) return;
    // With the keys as they're set now; a tip whose keys were taken off waits for the next day's.
    asking = true;
    keys().then((keyOf) => {
      asking = false;
      const text = tipText(t, keyOf);
      if (text !== null && !tipEl && open(t)) showTip(t, text);
    });
  }

  if (DASH) {
    // How each feature is found: the streamer switch, the themes, ⇧⌘J; the wheel the app reports (state below).
    document.addEventListener('click', (e) => {
      if (e.target.closest('#strm')) used('streamer');
      if (e.target.closest('#activity [data-view=themes]')) used('themes');
    }, true);
    addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyJ') used('notes');
    }, true);
    addEventListener('resize', place);
    // A minute after the page starts, then every half minute until today's has shown.
    setTimeout(() => {
      maybeTip();
      setInterval(maybeTip, 30_000);
    }, 60_000);
  }

  // From the app (MainWindowController): whether the shortcut wheel was ever opened.
  const state = (s) => {
    if (s && s.wheel) used('wheel');
  };

  return { on: ON, tipsOn: TIPS_ON, TOP, lines, short, arrange, releases, find, release, voted, keys, tips, state };
})();
