'use strict';

// The bell (the activity bar's notifications view; cloud.js mounts it and hands over what only it knows): an inbox in
// two panes, as Mail and Linear's Inbox, in the app's own warm look. Left, what came, newest first, under its day, a
// glass filter floating over it (All · News · Badges · Friends); right, the one picked, in full, each kind its own sheet:
// an update's version in molten numerals and its highlights as tiles (what you voted for lit in amber), a badge's art
// with the app's flame (fire.js) rising behind it the first time it's opened, a friend's moment with a way to message
// them. Several friends' moments of one kind on one day fold into a stack that opens on a click, as the Notification
// Center's. Opening the view reads everything (YouTube's bell): the dots stay while it's open. No sound, no dismiss, no
// "mark all read": news to read, not a to-do list. The design: ~/Desktop/orbiterm-zil-tasarim/spec.md. Its look:
// notifications.css.
// What has no history on the server is kept here, newest 20 each: your level-ups (nf.levels) and the friend requests
// accepted (nf.friends); and the friends' moments the feed told of (nf.feed), as the server keeps only today's flames
// and a week of badges.
window.Inbox = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // A badge's rarity, how many in a hundred have it, as a number whatever the API sent.
  const pct = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const read = (k, d) => {
    try {
      const v = JSON.parse(localStorage.getItem(k));
      return v ?? d;
    } catch {
      return d;
    }
  };
  const write = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  };
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DAY = 864e5;
  const BADGE_DAYS = 60; // your badges earned in the last 60 days are listed
  const KEEP = 14 * DAY; // friends' moments kept here
  const STAR = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 .8l1.55 3.4 3.7.4-2.77 2.5.78 3.65L6 8.9 2.74 10.75l.78-3.65L.75 4.6l3.7-.4z"/></svg>';
  const CHECK = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.3l2.3 2.2 4.7-5"/></svg>';
  const WARM = '255, 176, 87'; // a stack, the goal, someone whose level isn't known
  const FILTERS = [['all', 'All'], ['news', 'News'], ['badges', 'Badges'], ['friends', 'Friends']];
  const NONE = { news: 'No news yet', badges: 'No badges in the last 60 days', friends: 'Nothing from friends yet' };

  // ---------- what's kept here ----------
  const levels = () => read('nf.levels', []);
  const accepted = () => read('nf.friends', []);
  // Badges, levels and friends' moments are unread when newer than this (set when the view opens). The first time, now:
  // what you earned before this version doesn't light the bell.
  let seenAt = Number(read('nf.seenAt', 0)) || 0;
  if (!seenAt) write('nf.seenAt', (seenAt = Date.now()));
  const seen = (t) => write('nf.seenAt', (seenAt = Math.max(seenAt, t)));

  const feed = new Map((read('nf.feed', []) || []).filter((l) => l && l.id).map((l) => [l.id, l]));
  // The feed's lines worth keeping: friends' badges and flames, a new #1, the goal (the count of strangers' flames isn't).
  function keepLines(lines) {
    let changed = false;
    for (const l of lines || []) {
      if (!l || !l.id || !['badge', 'top', 'goal', 'fire'].includes(l.kind) || feed.has(l.id)) continue;
      feed.set(l.id, l);
      changed = true;
    }
    if (!changed) return false;
    const now = Date.now();
    const list = [...feed.values()].filter((l) => now - +new Date(l.at) < KEEP).sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 40);
    feed.clear();
    list.forEach((l) => feed.set(l.id, l));
    write('nf.feed', list);
    return true;
  }
  const feedOn = () => !!(window.Social && Social.prefs().feed);

  // ---------- time ----------
  const dayStart = (t) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const daysAgo = (t) => Math.round((dayStart(Date.now()) - dayStart(t)) / DAY);
  const section = (t) => {
    const n = daysAgo(t);
    return n <= 0 ? 'Today' : n === 1 ? 'Yesterday' : n < 7 ? 'This week' : 'Earlier';
  };
  const hm = (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  // A row's: 12m, 3h today; the clock yesterday; the weekday this week; the date before.
  function rowTime(t) {
    if (!t) return '';
    const n = daysAgo(t), s = Math.max(0, (Date.now() - t) / 1000);
    if (n <= 0) return s < 60 ? 'now' : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`;
    if (n === 1) return hm(t);
    if (n < 7) return new Date(t).toLocaleDateString('en-GB', { weekday: 'short' });
    return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  // A sheet's: Today, 12:08 · Wednesday 11 November, 14:02.
  const fullTime = (t) => {
    const n = daysAgo(t);
    return `${n <= 0 ? 'Today' : n === 1 ? 'Yesterday' : new Date(t).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}, ${hm(t)}`;
  };
  function ago(t) {
    const s = Math.max(0, (Date.now() - t) / 1000);
    const u = (n, w) => `${n} ${w}${n === 1 ? '' : 's'} ago`;
    return s < 60 ? 'just now' : s < 3600 ? u(Math.floor(s / 60), 'minute') : s < 86400 ? u(Math.floor(s / 3600), 'hour') : u(Math.max(1, daysAgo(t)), 'day');
  }
  const agoShort = (t) => {
    const s = Math.max(0, (Date.now() - t) / 1000);
    return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : fullTime(t);
  };

  // ---------- the pieces ----------
  const num = (n) => Number(n || 0).toLocaleString('en-US');
  const rankOf = (level) => (window.Xp ? Xp.rank(level || 1) : { name: '', color: WARM, from: 1 });
  const nextRank = (level) => (window.Xp ? Xp.RANKS.find((r) => r.from > level) : null);
  // Each rank's colour said in words (xp.js RANKS).
  const RANK_WORD = { 'Academy Student': 'sand', Genin: 'light orange', Chunin: 'orange', Jonin: 'amber', ANBU: 'red-orange', Sannin: 'red', Kage: 'white-gold' };
  const rankChanged = (l) => rankOf(l.level).name !== rankOf(l.from || l.level - 1).name;
  const Art = () => window.BadgeArt;
  // A badge's colour is its metal (bronze, silver, gold, diamond, legend), or a one-off's own: fixed, as the art is.
  const metal = (id, tier) => (Art() ? Art().glow(id, tier)[0] : WARM);
  const art = (id, tier, size) => (Art() ? Art().svg(id, tier, size) : '');
  const badgeName = (b) => (Art() ? Art().name(b.id) : '') || b.name || 'a badge';
  const tierName = (b) => (Art() ? Art().tierName(b.id, b.tier, b.tiers) : '');
  const rare = (r) => r != null && r <= 10; // Xbox's and Steam's cut-off
  // A release's line: its topic (before the ":") and the rest.
  function parts(text) {
    const m = /^([^:]{1,40}):\s+([\s\S]*)$/.exec(String(text || ''));
    return m ? { topic: m[1], rest: m[2] } : { topic: '', rest: String(text || '') };
  }
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const shortVer = (v) => String(v || '').replace(/^v/i, '').split('.').slice(0, 2).join('.');
  const names = (list) => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);

  // A badge's tiers and what each takes (badges.ts DEFS says the same; the app only gets the next one's).
  const H4 = [[1, 25, 250, 1000], 'h'];
  const STEPS = { week: [[10, 20, 30], 'h'], streak: [[4, 12, 26, 52], 'week'], fire: [[1, 5, 25, 100], 'day'], hours: [[10, 100, 500, 1000], 'h'],
    claude: H4, codex: H4, gemini: H4, antigravity: H4, squad: [[1, 5, 15], 'friend'], voice: [[1, 10, 30], 'vote'], season: [[50, 150, 300, 450], 'h'] };
  const TIERS = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Legend'];
  const amount = (n, unit) => (unit === 'h' ? `${num(n)}h` : `${num(n)} ${unit}${n === 1 ? '' : 's'}`);

  // Who a friend's moment is about: what's known of them (their picture, level, presence), else the line's name.
  function who(w) {
    const f = w && w.id && window.Social ? Social.friend(w.id) : null;
    const lvl = f && f.xp ? f.xp.level : null;
    const r = rankOf(lvl || 1);
    return {
      id: w && w.id, friend: !!f, name: (f && f.nick) || (f && f.name) || (w && w.name) || '?',
      tag: f ? f.tag : w && w.tag, avatar: f && f.avatar, presence: f && f.presence, xp: f && f.xp,
      level: lvl, rank: lvl ? r.name : '', rc: lvl ? r.color : WARM,
    };
  }
  const av = (p, sub) =>
    `<span class="nf-av" style="--rc:${p.rc}">${p.avatar ? `<img alt="" src="${esc(p.avatar)}">` : esc(p.name.trim().charAt(0).toUpperCase() || '?')}</span>` +
    (sub ? `<span class="nf-sub">${sub}</span>` : '');

  // ---------- the items ----------
  let C = null; // cloud.js's side: S, wnUnread, releases, richText, …
  let host = null, view = null, liveEl = null;
  const st = { filter: 'all', sel: null, open: new Set() };
  let isOpen = false, snap = 0, relFresh = false, entering = false;
  const live = new Set(); // ids that just came live (a note, a friend's moment, a level, an accepted request)
  let badgeLive = false; // a badge was just earned: the next inventory brings it
  let known = null; // the ids listed at the last render while open (a badge not among them is the one just earned)
  let waiting = 0; // arrivals while scrolled down (the "↑ 1 new" pill)
  let layout = '', segKey = '', listHTML = null, sheetId = null, sheetHTML = '', stopFire = null;
  const burned = new Set(); // badges and levels whose flame has burned
  const votes = new Map(); // version -> { at, items } (WhatsNew.voted)
  const since = () => (isOpen ? snap : seenAt);

  function friendItem(l, unreadSince) {
    const at = +new Date(l.at);
    return { id: `f:${l.id}`, kind: l.kind === 'goal' ? 'goal' : 'friend', f: 'friends', at, unread: at > unreadSince, line: l, what: l.kind };
  }

  function collect() {
    const S = (C && C.S()) || {};
    const out = [];
    const t = since();
    // News: the developer's notes, and every release you have.
    const N = window.Social ? Social.notes() : null;
    const fresh = C.fresh();
    if (N) for (const n of N.list) out.push({ id: `n:${n.id}`, kind: 'dev', f: 'news', at: +new Date(n.at), unread: fresh.has(n.id) || !n.read, note: n });
    const rels = (window.WhatsNew?.on && C.releases()) || [];
    const cur = rels.length ? C.current(rels) : null;
    for (const r of rels) {
      if (S.build && r.build > S.build) continue;
      // A release with no date (Windows: one that never ran on this PC, releasenotes.js) has no place among the news.
      if (!r.publishedAt) continue;
      const isCur = r === cur;
      out.push({ id: `r:${r.version}`, kind: 'release', f: 'news', at: +new Date(r.publishedAt), unread: isCur && (C.wnUnread() || relFresh), rel: r, current: isCur });
    }
    // Your badges of the last 60 days, each at its tier now.
    const B = window.Badges?.mine();
    if (B && B.badges) {
      for (const b of B.badges) {
        const at = b.earnedAt ? +new Date(b.earnedAt) : 0;
        if (!b.tier || !at || Date.now() - at > BADGE_DAYS * DAY) continue;
        out.push({ id: `b:${b.id}:${b.tier}`, kind: 'badge', f: 'badges', at, unread: at > t, b });
      }
    }
    for (const l of levels()) out.push({ id: `l:${l.level}:${l.at}`, kind: 'level', f: 'badges', at: l.at, unread: l.at > t, lv: l });
    // Friends' moments, while the community feed is on (Settings → Privacy). Two or more badges, or flames, on one day
    // fold into a stack.
    if (feedOn()) {
      const groups = new Map();
      for (const l of feed.values()) {
        const it = friendItem(l, t);
        if (Date.now() - it.at > KEEP) continue;
        if ((l.kind === 'badge' || l.kind === 'fire') && !l.mine) {
          const key = `s:${l.kind}:${dayStart(it.at)}`;
          if (!groups.has(key)) groups.set(key, []);
          const g = groups.get(key);
          // One flame line per person per day: a flame that went up a tier twice keeps only its highest line.
          const dup = l.kind === 'fire' ? g.findIndex((k) => k.line.who?.id === l.who?.id) : -1;
          if (dup < 0) g.push(it);
          else if ((l.tier || 0) > (g[dup].line.tier || 0)) g[dup] = it;
        } else out.push(it);
      }
      for (const [key, kids] of groups) {
        if (kids.length < 2) {
          out.push(kids[0]);
          continue;
        }
        kids.sort((a, b) => b.at - a.at);
        out.push({ id: key, kind: 'stack', f: 'friends', at: kids[0].at, unread: kids.some((k) => k.unread), kids, of: kids[0].what });
      }
      for (const a of accepted()) out.push({ id: `a:${a.id}:${a.at}`, kind: 'friend', f: 'friends', at: a.at, unread: a.at > t, line: { who: a }, what: 'accepted' });
    }
    out.sort((a, b) => b.at - a.at);
    // An update waiting to go in: pinned above them all, never filtered out.
    if (S.update && window.WhatsNew) out.unshift({ id: 'u', kind: 'update', f: 'news', at: 0, unread: false, rel: S.update, pinned: true });
    return out;
  }
  const flat = (list) => list.flatMap((it) => (it.kids ? it.kids : [it]));
  const find = (list, id) => {
    for (const it of list) {
      if (it.id === id) return it;
      for (const k of it.kids || []) if (k.id === id) return k;
    }
    return null;
  };

  // ---------- what each kind says ----------
  function arranged(r, update) {
    const v = !update && votes.get(r.version);
    return WhatsNew.arrange(r, v ? v.items : []);
  }
  function kOf(it) {
    switch (it.kind) {
      case 'release': case 'update': return 'var(--amber-rgb)';
      case 'badge': return metal(it.b.id, it.b.tier);
      case 'level': return rankOf(it.lv.level).color;
      case 'friend': return who(it.line.who).rc;
      case 'stack': case 'goal': return WARM;
    }
    return 'var(--accent-rgb)';
  }
  function friendTitle(it) {
    const l = it.line, n = who(l.who).name;
    switch (it.what) {
      case 'badge': {
        const b = l.badge || {};
        const tn = tierName(b);
        return `${n} earned ${badgeName(b)}${tn ? ` · ${tn}` : ''}`;
      }
      case 'fire': return l.tier === 2 ? `${n} has the hottest flame` : `${n} is on fire`;
      case 'top': return l.mine ? 'You took #1 this week' : `${n} took #1 this week`;
      case 'accepted': return `${n} accepted your friend request`;
    }
    return '';
  }
  function friendPrev(it) {
    const l = it.line;
    switch (it.what) {
      case 'badge': {
        const b = l.badge || {};
        const mine = window.Badges?.mine()?.badges?.find((x) => x.id === b.id);
        return (mine && mine.how) || (b.rare != null ? `${pct(b.rare)}% of players have it` : '');
      }
      case 'fire': {
        if (l.tier === 2) return '5 days on fire this week';
        const x = who(l.who).xp, s = x && (x.today || x.last24);
        return s && window.Xp ? `${Xp.dur(s)} at work ${x.today ? 'today' : 'in the last 24 hours'}` : 'Among the day\'s hottest';
      }
      case 'top': return "First on this week's leaderboard";
      case 'accepted': return 'You can message each other now';
    }
    return '';
  }
  // One entry per person in a stack; names that collide show with their tag.
  function stackPeople(it) {
    const seen = new Set(), ppl = [];
    for (const k of it.kids) {
      const w = who(k.line.who), key = k.line.who?.id ?? w.name;
      if (!seen.has(key)) { seen.add(key); ppl.push(w); }
    }
    return ppl;
  }
  function stackNames(it) {
    const ppl = stackPeople(it);
    return names(ppl.map((p) => (ppl.filter((q) => q.name === p.name).length > 1 && p.tag ? `${p.name}#${p.tag}` : p.name)));
  }
  function stackTitle(it) {
    // People are counted by id: two friends can share a name (only name + tag is unique).
    const ppl = stackPeople(it);
    if (it.of === 'badge') return ppl.length > 1 ? `${ppl.length} friends earned badges` : `${ppl[0].name} earned ${it.kids.length} badges`;
    return daysAgo(it.at) <= 0 ? `${ppl.length} people are on fire today` : `${ppl.length} people were on fire`;
  }
  function titleOf(it) {
    switch (it.kind) {
      case 'release': return `Orbiterm ${it.rel.version} is here`;
      case 'update': return `Orbiterm ${it.rel.version} is ready`;
      case 'dev': return it.note.title || 'From the developer';
      case 'badge': {
        const tn = tierName(it.b);
        return `You earned ${badgeName(it.b)}${tn ? ` · ${tn}` : ''}`;
      }
      case 'level': return rankChanged(it.lv) ? `Level ${it.lv.level} · you're ${rankOf(it.lv.level).name} now` : `Level ${it.lv.level}`;
      case 'friend': return friendTitle(it);
      case 'stack': return stackTitle(it);
      case 'goal': return 'Weekly goal reached together';
    }
    return '';
  }
  function prevOf(it) {
    switch (it.kind) {
      case 'release': {
        const { top } = arranged(it.rel);
        return top.map((l) => parts(l.text).topic || (window.WhatsNew ? WhatsNew.short(l.text) : l.text)).slice(0, 3).join(' · ');
      }
      case 'update': return 'Restart to update · your chats keep running';
      case 'dev': return String(it.note.body || '').split(/\n\s*\n/)[0];
      case 'badge': return it.b.rare != null ? `${rare(it.b.rare) ? 'Rare · ' : ''}${pct(it.b.rare)}% of players have it` : it.b.how || '';
      case 'level': {
        const nx = nextRank(it.lv.level);
        return nx ? `Next rank: ${nx.name} at level ${nx.from}` : `${rankOf(it.lv.level).name}, the top rank`;
      }
      case 'friend': return friendPrev(it);
      case 'stack': return stackNames(it);
      case 'goal': return `Everyone together did ${num(it.line.hours)}h this week`;
    }
    return '';
  }

  // ---------- the list ----------
  function icon(it, small) {
    switch (it.kind) {
      case 'release': case 'update': return `<span class="nf-ic nf-ic-ver" aria-hidden="true">${esc(shortVer(it.rel.version))}</span>`;
      case 'dev': return '<span class="nf-ic nf-ic-dev" aria-hidden="true"><img src="logo.png" alt=""></span>';
      case 'badge': return `<span class="nf-ic nf-ic-badge" aria-hidden="true">${art(it.b.id, it.b.tier, 46)}</span>`;
      case 'level': return `<span class="nf-ic nf-ic-lvl" aria-hidden="true">${it.lv.level}</span>`;
      case 'goal': return '<span class="nf-ic nf-ic-goal" aria-hidden="true">🏆</span>';
      case 'stack': {
        const ppl = [];
        for (const k of it.kids) if (!ppl.some((p) => p.id === k.line.who?.id)) ppl.push(who(k.line.who));
        return `<span class="nf-ic nf-ic-stack" aria-hidden="true">${ppl.slice(0, 2).map((p) => av(p)).join('')}</span>`;
      }
      case 'friend': {
        const l = it.line, b = l.badge;
        const sub = it.what === 'badge' && b ? art(b.id, b.tier, small ? 20 : 22) : it.what === 'fire' ? '🔥' : it.what === 'top' ? '🏆' : it.what === 'accepted' ? '<b class="nf-ok">✓</b>' : '';
        return `<span class="nf-ic" aria-hidden="true">${av(who(l.who), sub)}</span>`;
      }
    }
    return '';
  }
  // `enter`: the view just opened (rows rise in, staggered by `d`); `kid`: a row of an open stack.
  function rowHTML(it, { d = 0, enter = false, kid = false, extra = '' } = {}) {
    const title = titleOf(it), prev = prevOf(it);
    const voted = it.kind === 'release' && arranged(it.rel).top.some((l) => l.voted);
    const label = `${it.unread ? 'Unread. ' : ''}${title}. ${prev}${it.at ? `. ${fullTime(it.at)}` : ''}`;
    return `<button type="button" class="nf-row${it.unread ? ' unread' : ''}${enter ? ' enter' : ''}" data-id="${esc(it.id)}" style="--nf-k:${kOf(it)};--d:${d}" aria-current="false"${extra} aria-label="${esc(label)}">` +
      `<span class="nf-dot" aria-hidden="true"></span>${icon(it, kid)}<span class="nf-main"><span class="nf-head"><span class="nf-title">${esc(title)}</span>` +
      `<time class="nf-time">${rowTime(it.at)}</time></span><span class="nf-prev">${esc(prev)}</span>` +
      `${voted ? `<span class="nf-chip">${STAR}You voted for this</span>` : ''}</span></button>`;
  }
  // A stack: closed, one card with two plates peeking under it; open, a header line and its rows (inert while closed).
  const stackHead = (it) =>
    `<div class="nf-gh"><button type="button" class="nf-gh-t" data-id="${esc(it.id)}" aria-current="false">${esc(titleOf(it))}</button><button type="button" class="nf-less" data-less aria-expanded="true">Show less</button></div>`;
  const stackRow = (it, d = 0, enter = false) => rowHTML(it, { d, enter, extra: ' aria-expanded="false"' });
  function stackHTML(it, d, enter) {
    const open = st.open.has(it.id);
    return `<div class="nf-group${open ? ' open' : ''}" data-group="${esc(it.id)}">` +
      (open ? stackHead(it) : stackRow(it, d, enter)) +
      '<i class="nf-plate p1" aria-hidden="true"></i><i class="nf-plate p2" aria-hidden="true"></i>' +
      `<div class="nf-kids"${open ? '' : ' inert'}><div>${it.kids.map((k, i) => rowHTML(k, { d: i, kid: true })).join('')}</div></div></div>`;
  }

  // ---------- the sheets ----------
  const eyebrow = (it, label) =>
    `<div class="nf-eyebrow">${esc(label)}${it.at ? `<time datetime="${new Date(it.at).toISOString()}">${fullTime(it.at)}</time>` : ''}</div>`;
  const button = (cls, act, text, data = '') => `<button class="nf-btn ${cls}" type="button" data-act="${act}"${data}>${esc(text)}</button>`;

  function releaseSheet(it) {
    const r = it.rel, upd = it.kind === 'update';
    const { top, more } = arranged(r, upd);
    const n = top.length + more.length;
    const tiles = top.length ? top : [{ text: 'fixes and improvements' }];
    const tile = (l, i) => {
      const p = parts(l.text);
      return `<div class="nf-tile${l.voted ? ' voted' : ''}" style="--d:${i}">${l.voted ? `<span class="nf-voted">${STAR}YOU VOTED FOR THIS</span>` : ''}` +
        `${p.topic ? `<b>${esc(p.topic)}</b>` : ''}<p>${C.richText(cap(p.rest))}</p></div>`;
    };
    const li = (l) => {
      const p = parts(l.text);
      return `<li>${p.topic ? `<b>${esc(p.topic)}:</b> ` : ''}${C.richText(p.rest)}</li>`;
    };
    const S = C.S() || {};
    const busy = upd && !!S.updating;
    return eyebrow(it, upd ? 'App update · ready to install' : `App update${r.build ? ` · build ${r.build}` : ''}`) +
      `<div class="nf-ver-of">Orbiterm</div><h2 class="nf-ver">${esc(r.version)}</h2>` +
      `<div class="nf-ver-sub">${upd ? '<span class="nf-pill">Not installed yet</span><span>Restart to update · your chats keep running</span>'
        : `<span class="nf-pill">${CHECK}Installed</span><span>Came out ${ago(it.at)} · ${n} change${n === 1 ? '' : 's'}</span>`}</div>` +
      `<div class="nf-h">Highlights</div><div class="nf-tiles">${tiles.map(tile).join('')}</div>` +
      (more.length ? `<div class="nf-h">Also in ${esc(r.version)}</div><ul class="nf-rest">${more.map(li).join('')}</ul>` : '') +
      `<div class="nf-actions">${upd ? `<button class="nf-btn primary" type="button" data-act="update"${busy ? ' disabled' : ''}>${busy ? 'Updating…' : 'Update now'}</button>` : ''}` +
      `${window.Roadmap ? button('glass', 'roadmap', 'Vote for what comes next ›') : ''}</div>`;
  }

  function devSheet(it) {
    const n = it.note;
    return eyebrow(it, 'From the developer') +
      '<div class="nf-from"><span class="nf-ic nf-ic-dev"><img src="logo.png" alt=""></span><span><b>Atalay</b><small>Makes Orbiterm</small></span></div>' +
      `<h2 class="nf-note-title">${C.richText(n.title || '')}</h2>${n.body ? `<div class="nf-note-text">${C.richText(n.body)}</div>` : ''}` +
      `<div class="nf-actions">${button('glass', 'feedback', 'Reply with feedback')}</div>`;
  }

  function badgeSheet(it) {
    const b = it.b, tn = tierName(b), key = b.id.startsWith('season-') ? 'season' : b.id;
    const steps = STEPS[key];
    const track = b.tiers > 1 && !b.id.startsWith('service-')
      ? `<div class="nf-h">Tiers</div><div class="nf-track" style="--n:${b.tiers}">` +
        Array.from({ length: b.tiers }, (_, i) => {
          const name = key === 'season' ? TIERS[i] : Art() ? Art().tierName(b.id, i + 1, b.tiers) : '';
          const need = steps && steps[0][i] != null ? amount(steps[0][i], steps[1]) : '';
          return `<div class="nf-step${i < b.tier ? ' got' : ''}${i === b.tier - 1 ? ' now' : ''}" style="--m:${metal(b.id, i + 1)}"><span class="nf-coin"></span>${esc(name)}${need ? `<small>${need}</small>` : ''}</div>`;
        }).join('') + '</div>'
      : '';
    // How far the next tier is (badges.js amount: hours come in seconds, Veteran's days too).
    let next = '';
    const p = b.progress;
    if (p && p.unit && b.tier < b.tiers) {
      const hours = p.unit === 'h', days = p.unit === 'days' && p.next >= 86400;
      const have = hours ? Math.floor(p.value / 3600) : days ? Math.floor(p.value / 86400) : p.value;
      const need = hours ? Math.round(p.next / 3600) : days ? Math.round(p.next / 86400) : p.next;
      const unit = hours ? 'h' : p.unit.replace(/s$/, '');
      const nextName = key === 'season' ? TIERS[b.tier] : Art() ? Art().tierName(b.id, b.tier + 1, b.tiers) : '';
      next = `<div class="nf-next">Next: <b>${esc(nextName || 'the next tier')}</b> at ${amount(need, unit)}. You have ${hours ? `${num(have)}h` : num(have)}.` +
        `<div class="nf-bar-xp" style="--m:${metal(b.id, b.tier + 1)}"><i style="width:${Math.max(0, Math.min(100, (100 * p.value) / p.next)).toFixed(0)}%"></i></div></div>`;
    }
    const shown = window.Badges?.mine()?.featured === b.id;
    return eyebrow(it, 'Badge earned') +
      `<div class="nf-hero"><canvas aria-hidden="true"></canvas>${art(b.id, b.tier, 160).replace('alt=""', `alt="${esc(badgeName(b))}${tn ? `, ${esc(tn)}` : ''}"`)}</div>` +
      `<h2 class="nf-big">${esc(badgeName(b))}${tn ? ` · <span>${esc(tn)}</span>` : ''}</h2>` +
      `<div class="nf-line">${rare(b.rare) ? `<span class="nf-pill">${STAR}Rare</span>` : ''}<span>${b.rare != null ? `${pct(b.rare)}% of players have it · ` : ''}${esc(b.how || '')}</span></div>` +
      track + next +
      `<div class="nf-actions"><button class="nf-btn primary" type="button" data-act="feature" data-badge="${esc(b.id)}"${shown ? ' disabled' : ''}>${shown ? 'Shown beside your name' : 'Show beside my name'}</button>` +
      `${button('glass', 'inventory', 'All my badges')}` +
      `${button('glass', 'replay', '↻ Replay animation', ` data-badge="${esc(b.id)}" data-tier="${esc(b.tier)}" aria-label="Replay animation"`)}</div>`;
  }

  function levelSheet(it) {
    const l = it.lv, r = rankOf(l.level), nx = nextRank(l.level);
    const x = (C.S() || {}).xp;
    const left = nx ? nx.from - l.level : 0;
    const line = rankChanged(l)
      ? `A new rank: your name shows in ${esc(r.name)} ${RANK_WORD[r.name] || ''} to your friends and on the leaderboard.`
      : nx ? `${left} more level${left === 1 ? '' : 's'} to ${esc(nx.name)}.` : `${esc(r.name)} is the top rank.`;
    const box = x
      ? x.to
        ? `<div class="nf-next">Level ${x.level + 1} at <b>${num(x.to)} XP</b>. You have ${num(x.xp)}.<div class="nf-bar-xp" style="--m:${rankOf(x.level).color}"><i style="width:${(window.Xp ? Xp.pct(x) : 0).toFixed(0)}%"></i></div></div>`
        : `<div class="nf-next">Level ${x.level}, the top level. <b>${num(x.xp)} XP</b> in all.</div>`
      : '';
    return eyebrow(it, 'Level up') +
      `<div class="nf-hero"><canvas aria-hidden="true"></canvas><div class="nf-emblem" role="img" aria-label="Level ${l.level}">${l.level}</div></div>` +
      `<h2 class="nf-big">Level ${l.level} · <span>${esc(r.name)}</span></h2><div class="nf-line"><span>${line}</span></div>` + box +
      `<div class="nf-actions">${button('glass', 'board', 'See the leaderboard')}</div>`;
  }

  // A friend's card: their picture, name#tag, and how they are now in their rank's colour.
  function personCard(p) {
    const on = p.presence && p.presence !== 'offline' && p.presence !== 'invisible';
    const word = on && window.Social ? cap(Social.PRESENCE[p.presence]?.label || '') : '';
    const lvl = p.level ? `Level ${p.level} · ${p.rank}` : '';
    return `<div class="nf-person"><span class="nf-av" style="--rc:${p.rc}">${p.avatar ? `<img alt="" src="${esc(p.avatar)}">` : esc(p.name.charAt(0).toUpperCase())}${p.presence === 'online' ? '<i class="nf-pres"></i>' : ''}</span>` +
      `<div><b>${esc(p.name)}${p.tag != null ? `<i>#${String(p.tag).padStart(4, '0')}</i>` : ''}</b>${word || lvl ? `<small style="--rc:${p.rc}">${esc([word, lvl].filter(Boolean).join(' · '))}</small>` : ''}</div></div>`;
  }
  // One moment as a card (with a Message button in a stack).
  function moment(it, i, say) {
    const l = it.line, p = who(l.who);
    let pic, text, small, m = p.rc;
    if (it.what === 'badge' && l.badge) {
      const b = l.badge, tn = tierName(b);
      m = metal(b.id, b.tier);
      pic = art(b.id, b.tier, 56);
      text = `<b>${esc(p.name)}</b> earned <span>${esc(badgeName(b))}${tn ? ` · ${esc(tn)}` : ''}</span>`;
      const how = friendPrev(it);
      small = [how && !/% of players/.test(how) ? how : '', b.rare != null ? `${rare(b.rare) ? 'rare, ' : ''}${pct(b.rare)}% have it` : ''].filter(Boolean).join(' · ');
    } else {
      pic = `<span class="nf-glyph" aria-hidden="true">${it.what === 'fire' ? '🔥' : it.what === 'top' ? '🏆' : '🤝'}</span>`;
      text = `<b>${esc(titleOf(it))}</b>`;
      small = friendPrev(it);
    }
    const when = `<span class="nf-when">${esc(agoShort(it.at))}</span>`;
    return `<div class="nf-moment" style="--d:${i};--m:${m}">${pic}<div><p>${text}</p><small>${small ? `${esc(small)} · ` : ''}${when}</small></div>` +
      (say && p.friend ? `<button class="nf-btn nf-say" type="button" data-act="chat" data-who="${esc(p.id)}" aria-label="Message ${esc(p.name)}">Message</button>` : '') + '</div>';
  }
  function friendSheet(it) {
    const p = who(it.line.who);
    return eyebrow(it, 'Friends') + personCard(p) + `<div class="nf-moments">${moment(it, 0, false)}</div>` +
      (p.friend ? `<div class="nf-actions">${button('glass', 'chat', `Message ${p.name}`, ` data-who="${esc(p.id)}"`)}</div>` : '');
  }
  function stackSheet(it) {
    return eyebrow(it, 'Friends') + `<h2 class="nf-note-title nf-top">${esc(titleOf(it))}</h2>` +
      `<div class="nf-moments">${it.kids.map((k, i) => moment(k, i, true)).join('')}</div>`;
  }
  function goalSheet(it) {
    const h = num(it.line.hours);
    return eyebrow(it, 'Friends') + `<h2 class="nf-note-title nf-top">${esc(titleOf(it))}</h2>` +
      `<div class="nf-next" style="margin-top:1.25rem"><b>${h}h</b> of the ${h}h goal, Monday to Sunday.<div class="nf-bar-xp" style="--m:var(--accent-rgb)"><i style="width:100%"></i></div></div>` +
      `<div class="nf-actions">${button('glass', 'board', 'See the leaderboard')}</div>`;
  }
  function sheet(it) {
    switch (it.kind) {
      case 'release': case 'update': return releaseSheet(it);
      case 'dev': return devSheet(it);
      case 'badge': return badgeSheet(it);
      case 'level': return levelSheet(it);
      case 'friend': return friendSheet(it);
      case 'stack': return stackSheet(it);
      case 'goal': return goalSheet(it);
    }
    return '';
  }

  // ---------- empty, loading, offline ----------
  const BELL = '<path class="bell" d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path class="bell" d="M10 20.5a2 2 0 0 0 4 0"/>';
  const OFF = '<path class="bell" d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.1 4.75 4.75 0 0 0 7 18.5z"/><path class="bell" d="M4 4l16 16"/>';
  function emptyHTML(offline) {
    const S = C.S() || {};
    const btn = !offline && window.WhatsNew?.on && S.version ? button('glass', 'whatsnew', `See what's new in ${S.version}`) : '';
    return `<div class="nf-empty"><div class="nf-orbit" aria-hidden="true"><svg viewBox="0 0 160 112"><defs><radialGradient id="nf-planet" cx="40%" cy="32%" r="70%"><stop offset="0" stop-color="#ffe2b0"/><stop offset=".45" stop-color="#ffa53a"/><stop offset="1" stop-color="#b8420a"/></radialGradient></defs>` +
      '<ellipse class="ring2" cx="80" cy="56" rx="78" ry="30"/><ellipse class="ring" cx="80" cy="56" rx="72" ry="24"/><circle class="planet" cx="80" cy="56" r="22"/><path class="ring front" d="M 8 56 a 72 24 0 0 0 144 0"/>' +
      `<g transform="translate(68 44)">${offline ? OFF : BELL}</g><circle class="nf-ember" r="3.2"/></svg></div>` +
      (offline
        ? "<h3>Can't reach the server</h3><p>Notifications come back with the connection.</p>"
        : "<h3>All caught up</h3><p>News from Atalay, app updates, your new badges and your friends' big moments land here.</p>") +
      `${btn}</div>`;
  }
  const SKEL = '<div class="nf-skel" aria-busy="true" aria-label="Loading notifications">' +
    '<div class="nf-row" aria-hidden="true"><span class="nf-dot"></span><span class="nf-ic"></span><span class="nf-main"><i></i><i></i></span></div>'.repeat(3) + '</div>';

  // ---------- render ----------
  const narrow = () => {
    const body = host && host.parentElement;
    return !!body && body.clientWidth <= 52 * parseFloat(getComputedStyle(document.documentElement).fontSize);
  };
  const $ = (sel) => host.querySelector(sel);
  function panes() {
    if (layout === 'panes') return;
    layout = 'panes';
    segKey = '';
    listHTML = null;
    sheetId = null;
    host.__h = null;
    host.innerHTML = '<div class="nf-list"><div class="nf-bar"><div class="nf-seg" role="radiogroup" aria-label="Show"></div></div>' +
      '<button class="nf-fresh" type="button" hidden></button><div class="nf-scroll" role="list" aria-label="Notifications"></div></div>' +
      '<div class="nf-detail" role="region" aria-label="Notification"></div>';
    $('.nf-scroll').addEventListener('scroll', (e) => {
      if (waiting && e.target.scrollTop < 8) {
        waiting = 0;
        $('.nf-fresh').hidden = true;
      }
    }, { passive: true });
  }
  function only(html) {
    layout = 'empty';
    if (stopFire) stopFire(), (stopFire = null);
    host.classList.remove('nf-reading');
    if (host.__h !== html) host.innerHTML = html;
    host.__h = html;
  }

  function filters(all) {
    const segs = feedOn() ? FILTERS : FILTERS.slice(0, 3);
    if (!segs.some((s) => s[0] === st.filter)) st.filter = 'all';
    const seg = $('.nf-seg');
    const key = segs.map((s) => s[0]).join();
    if (segKey !== key) {
      segKey = key;
      seg.innerHTML = '<span class="nf-seg-thumb" aria-hidden="true"></span>' +
        segs.map(([k, label]) => `<button type="button" role="radio" data-f="${k}" aria-checked="false" tabindex="-1">${label}<i hidden aria-hidden="true"></i><span class="nf-sr" hidden>, new</span></button>`).join('');
      seg.style.setProperty('--n', segs.length);
    }
    seg.style.setProperty('--i', Math.max(0, segs.findIndex((s) => s[0] === st.filter)));
    for (const b of seg.querySelectorAll('[data-f]')) {
      const on = b.dataset.f === st.filter;
      const lit = b.dataset.f !== 'all' && all.some((it) => it.unread && it.f === b.dataset.f);
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
      b.querySelector('i').hidden = b.querySelector('.nf-sr').hidden = !lit;
    }
  }

  function render() {
    if (!host || !C) return;
    const S = C.S() || {};
    const N = window.Social ? Social.notes() : null;
    const all = collect();
    const items = flat(all.filter((it) => !it.pinned));
    const k = items.filter((it) => it.unread).length;
    const meta = view.querySelector('.meta'), mt = items.length ? `${k ? `${k} new` : 'all read'} · ${items.length} in all` : N ? 'all read' : '';
    if (meta && meta.textContent !== mt) meta.textContent = mt;
    if (isOpen) {
      seen(Date.now());
      loadVotes();
    }
    // Arrivals while it's open (live events only, not what loads late): new at the top, springing in, or a pill when
    // scrolled down; said aloud.
    const arrived = isOpen ? items.filter((it) => live.has(it.id) || (badgeLive && known && it.kind === 'badge' && !known.has(it.id))) : [];
    live.clear();
    if (isOpen) known = new Set(items.map((it) => it.id));
    // Not loaded yet: the rows' shapes, the reading pane its glow alone; nothing anywhere, said so.
    if (!N && S.reachable !== false && !all.length) {
      panes();
      filters([]);
      listHTML = null;
      $('.nf-scroll').innerHTML = SKEL;
      return clearSheet();
    }
    if (!all.length) return only(emptyHTML(!N && S.reachable === false));
    panes();
    filters(all);
    const L = all.filter((it) => st.filter === 'all' || it.f === st.filter || it.pinned);
    const scroll = $('.nf-scroll');
    if (!L.length) {
      const none = `<p class="nf-none">${NONE[st.filter] || ''}</p>`;
      if (listHTML !== none) scroll.innerHTML = listHTML = none;
      return clearSheet();
    }
    if (!st.sel || !find(L, st.sel)) {
      const pick = L.find((it) => it.unread && !it.pinned) || L.find((it) => !it.pinned) || L[0];
      st.sel = pick.id;
    }
    let html = '', sec = '', d = 0;
    for (const it of L) {
      const s = it.pinned ? '' : section(it.at);
      if (s && s !== sec) {
        const n = s === 'Today' ? flat(L.filter((x) => !x.pinned && section(x.at) === 'Today')).filter((x) => x.unread).length : 0;
        html += `<h3 class="nf-sec">${s}${n ? `<small>${n} new</small>` : ''}</h3>`;
        sec = s;
      }
      const enter = entering && d < 10;
      html += it.kind === 'stack' ? stackHTML(it, d, enter) : rowHTML(it, { d, enter });
      d++;
    }
    if (html !== listHTML) {
      const top = scroll.scrollTop;
      const focused = host.contains(document.activeElement) && scroll.contains(document.activeElement) ? document.activeElement.dataset.id : null;
      scroll.innerHTML = listHTML = html;
      scroll.scrollTop = top;
      if (focused) scroll.querySelector(`[data-id="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
    }
    if (arrived.length) {
      // A friend's moment folded into a closed stack: the stack's card is what arrives.
      const rows = arrived.map((a) => {
        const r = scroll.querySelector(`.nf-row[data-id="${CSS.escape(a.id)}"]`);
        return r && (r.closest('.nf-group:not(.open)')?.querySelector(':scope > .nf-row') || r);
      }).filter(Boolean);
      if (rows.length && scroll.scrollTop < 8) rows.forEach((r) => r.classList.add('arrive'));
      else if (rows.length) {
        waiting += rows.length;
        const pill = $('.nf-fresh');
        pill.textContent = `↑ ${waiting} new`;
        pill.hidden = false;
      }
      if (liveEl) liveEl.textContent = `New notification: ${titleOf(arrived[0])}`;
    }
    select(st.sel, false);
  }

  function clearSheet() {
    const pane = $('.nf-detail');
    if (stopFire) stopFire(), (stopFire = null);
    sheetId = null;
    sheetHTML = '';
    if (pane) {
      pane.style.removeProperty('--nf-k');
      pane.innerHTML = '';
    }
    host.classList.remove('nf-reading');
  }

  // Picks one: the list marks it, the reading pane shows it (the same one drawn again only when it changed), the flame
  // burns behind a badge or a level the first time it's opened unread.
  function select(id, focus) {
    const all = collect();
    const it = find(all, id);
    const pane = $('.nf-detail');
    if (!it || !pane) return;
    st.sel = id;
    host.querySelectorAll('.nf-row, .nf-gh-t').forEach((r) => r.setAttribute('aria-current', String(r.dataset.id === id)));
    // The update you have now, opened: it stops counting, as Help → What's New does.
    if (it.kind === 'release' && it.current && C.wnUnread()) C.readRelease();
    const html = `<button class="nf-btn glass nf-back" type="button" data-act="back">‹ Notifications</button><article class="nf-sheet" tabindex="-1">${sheet(it)}</article>`;
    if (sheetId === id && sheetHTML === html) return;
    const same = sheetId === id;
    const top = pane.scrollTop;
    if (stopFire) stopFire(), (stopFire = null);
    sheetId = id;
    sheetHTML = html;
    pane.style.setProperty('--nf-k', kOf(it));
    // Redrawn in place (new data): no entrance again.
    pane.classList.toggle('nf-still', same);
    pane.innerHTML = html;
    pane.scrollTop = same ? top : 0;
    const c = pane.querySelector('.nf-hero canvas');
    if (c && it.unread && !burned.has(id) && window.Fire && !reduced()) {
      burned.add(id);
      const look = it.kind === 'badge' && !(Art() && ['mac', 'windows', 'both', 'polyglot', 'founder', 'night', 'comeback'].includes(it.b.id)) && it.b.tier >= 4 ? 'blue' : 'orange';
      stopFire = Fire.burn(c, { reach: [60, 0, 0], scale: 9, life: 2600, look });
    } else if (c && !same) burned.add(id);
    if (focus) pane.querySelector('.nf-sheet')?.focus({ preventScroll: true });
  }

  function reading(on) {
    host.classList.toggle('nf-reading', on);
    if (on) $('.nf-detail .nf-back')?.focus({ preventScroll: true });
    else host.querySelector(`.nf-scroll [data-id="${CSS.escape(st.sel || '')}"]`)?.focus({ preventScroll: true });
  }

  // ---------- doing ----------
  function act(b) {
    switch (b.dataset.act) {
      case 'back': return reading(false);
      case 'roadmap': return window.GitView?.view('roadmap');
      case 'board': return window.GitView?.view('board');
      case 'inventory': return window.GitView?.view('profile');
      // The badge's full-screen reveal again (messages.js, the notices panel, through Swift): only the show.
      case 'replay': return window.webkit?.messageHandlers?.radar?.postMessage({ type: 'badgeReveal', id: b.dataset.badge, tier: Number(b.dataset.tier) || 1 });
      case 'feedback': return C.openFeedback();
      case 'chat': return b.dataset.who && Social.openChat(b.dataset.who);
      case 'update':
        b.disabled = true;
        b.textContent = 'Updating…';
        return C.update();
      case 'feature':
        b.disabled = true;
        return window.Badges?.feature(b.dataset.badge).then(() => render());
      case 'whatsnew': {
        const cur = collect().find((it) => it.kind === 'release' && it.current);
        if (!cur) return C.openWhatsNew();
        st.filter = 'all';
        st.sel = cur.id;
        return render();
      }
    }
  }
  function setFilter(f, focus) {
    if (f === st.filter) return;
    st.filter = f;
    st.sel = null;
    listHTML = null;
    render();
    $('.nf-scroll').scrollTop = 0;
    if (focus) host.querySelector(`.nf-seg [data-f="${f}"]`)?.focus();
  }
  function onClick(e) {
    const f = e.target.closest('.nf-seg [data-f]');
    if (f) return setFilter(f.dataset.f);
    if (e.target.closest('.nf-fresh')) {
      waiting = 0;
      $('.nf-fresh').hidden = true;
      return $('.nf-scroll').scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
    }
    const a = e.target.closest('[data-act]');
    if (a) return act(a);
    const less = e.target.closest('[data-less]');
    if (less) {
      const g = less.closest('[data-group]');
      fold(g, false);
      if (st.sel === g.dataset.group || g.querySelector(`[data-id="${CSS.escape(st.sel || '')}"]`)) select(g.dataset.group, false);
      return g.querySelector(':scope > .nf-row')?.focus({ preventScroll: true });
    }
    const r = e.target.closest('.nf-row[data-id], .nf-gh-t');
    if (!r) return;
    const g = r.parentElement.closest('[data-group]');
    // A closed stack opens where it is (its plates go, its rows slide out); in a narrow window that's all a click does.
    if (g && r.parentElement === g && !st.open.has(g.dataset.group)) {
      fold(g, true);
      select(g.dataset.group, false);
      return g.querySelector('.nf-gh-t')?.focus({ preventScroll: true });
    }
    select(r.dataset.id, false);
    if (narrow()) reading(true);
  }
  // A stack opened or closed in place, so it moves (a redraw would show it already there).
  function fold(g, open) {
    const id = g.dataset.group;
    const it = find(collect(), id);
    if (!it) return;
    if (open) st.open.add(id);
    else st.open.delete(id);
    g.querySelector(':scope > .nf-row, :scope > .nf-gh')?.insertAdjacentHTML('afterend', open ? stackHead(it) : stackRow(it));
    g.querySelector(open ? ':scope > .nf-row' : ':scope > .nf-gh')?.remove();
    g.classList.toggle('open', open);
    g.querySelector('.nf-kids').inert = !open;
    // The next redraw writes the list again as it is now.
    listHTML = null;
  }
  function onKey(e) {
    const seg = e.target.closest?.('.nf-seg');
    if (seg && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const bs = [...seg.querySelectorAll('[data-f]')];
      const i = bs.findIndex((b) => b.dataset.f === st.filter);
      const n = bs[Math.max(0, Math.min(bs.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))];
      e.preventDefault();
      if (n) setFilter(n.dataset.f, true);
      return;
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target.closest?.('.nf-scroll')) {
      // Instantly, with no motion (a frequent action).
      const visible = [...host.querySelectorAll('.nf-scroll .nf-row[data-id], .nf-scroll .nf-gh-t')].filter((r) => !r.closest('[inert]'));
      const i = visible.findIndex((r) => r.dataset.id === st.sel);
      const n = visible[Math.max(0, Math.min(visible.length - 1, i < 0 ? 0 : i + (e.key === 'ArrowDown' ? 1 : -1)))];
      if (!n) return;
      e.preventDefault();
      select(n.dataset.id, false);
      n.focus();
    }
  }

  // ---------- data that comes later ----------
  let feedAsk = null;
  function loadFeed() {
    if (!feedOn() || feedAsk || !window.Social) return;
    feedAsk = Social.feed().then((r) => {
      feedAsk = null;
      if (r && !r.error && keepLines(r.lines) && isOpen) render();
    });
  }
  // What you voted for in the three newest releases you have (the Roadmap), asked once in five minutes.
  function loadVotes() {
    if (!window.WhatsNew?.on) return;
    const S = C.S() || {};
    const mine = (C.releases() || []).filter((r) => !S.build || r.build <= S.build).slice(0, 3);
    for (const r of mine) {
      const v = votes.get(r.version);
      if (v && (v.busy || Date.now() - v.at < 5 * 60e3)) continue;
      votes.set(r.version, { at: Date.now(), items: v ? v.items : [], busy: true });
      WhatsNew.voted(r.version).then((items) => {
        votes.set(r.version, { at: Date.now(), items: items || [] });
        if (isOpen && (items || []).length) render();
      }).catch(() => votes.set(r.version, { at: Date.now(), items: [] }));
    }
  }

  // ---------- open, close ----------
  function open() {
    if (isOpen) return render();
    isOpen = true;
    snap = seenAt;
    relFresh = C.wnUnread();
    seen(Date.now());
    st.filter = 'all';
    st.sel = null;
    st.open.clear();
    known = null;
    waiting = 0;
    host.classList.remove('nf-reading');
    C.count();
    entering = !reduced();
    listHTML = null;
    sheetId = null;
    live.clear();
    render();
    entering = false;
    loadFeed();
  }
  function close() {
    isOpen = false;
    known = null;
    if (stopFire) stopFire(), (stopFire = null);
    host.classList.remove('nf-reading');
    if (layout === 'panes') $('.nf-fresh').hidden = true;
  }

  // ---------- the bell's count ----------
  // Your badges and levels not seen yet (the developer's notes and the update count in cloud.js). Friends' moments
  // don't: they light the Friends filter only.
  function unseen() {
    if (isOpen) return 0;
    let n = levels().filter((l) => l.at > seenAt).length;
    const B = window.Badges?.mine();
    if (B && B.badges) {
      n += B.badges.filter((b) => b.tier && b.earnedAt && +new Date(b.earnedAt) > seenAt && Date.now() - +new Date(b.earnedAt) < BADGE_DAYS * DAY).length;
    }
    return n;
  }

  // A new level (cloud.js, the "xp" event): kept, with the level before it, so a new rank shows.
  function leveled(from, level) {
    if (!from || !level || level <= from) return;
    const log = levels();
    if (log[0] && log[0].level === level && Date.now() - log[0].at < 10 * 60e3) return;
    const at = Date.now();
    log.unshift({ level, at, from });
    write('nf.levels', log.slice(0, 20));
    live.add(`l:${level}:${at}`);
    C?.count();
    if (isOpen) render();
  }

  function mount(el, ctx) {
    host = el;
    C = ctx;
    view = el.closest('.cv');
    liveEl = document.createElement('div');
    liveEl.className = 'nf-live';
    liveEl.setAttribute('aria-live', 'polite');
    view.appendChild(liveEl);
    host.addEventListener('click', onClick);
    host.addEventListener('keydown', onKey);
    // Esc in a narrow window goes back to the list first (cloud.js takes it to the dashboard otherwise).
    addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !isOpen || !host.classList.contains('nf-reading') || document.getElementById('cloudui')?.classList.contains('on')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      reading(false);
    }, true);
    // Closed (another view, the dashboard): the next opening reads everything again.
    new MutationObserver(() => {
      if (isOpen && !view.classList.contains('on')) close();
    }).observe(view, { attributes: true, attributeFilter: ['class'] });
    window.Badges?.on(() => {
      C.count();
      if (isOpen) render();
      badgeLive = false;
    });
    window.Social?.on((ev) => {
      // cloud.js renders on a note itself, after this.
      if (ev.type === 'notification' && ev.notification) live.add(`n:${ev.notification.id}`);
      if (ev.type === 'badge') badgeLive = true;
      if (ev.type === 'feed' && ev.line && keepLines([ev.line])) {
        live.add(`f:${ev.line.id}`);
        if (isOpen) render();
      }
      if (ev.type === 'friend' && ev.accepted && ev.friend) {
        const f = ev.friend, at = Date.now();
        write('nf.friends', [{ id: f.id, name: f.name, tag: f.tag, at }, ...accepted()].slice(0, 20));
        live.add(`a:${f.id}:${at}`);
        if (isOpen) render();
      }
      if (isOpen && ['prefs', 'settings', 'snapshot'].includes(ev.type)) render();
    });
    return { open, render };
  }

  return { mount, unseen, leveled };
})();
