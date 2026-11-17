'use strict';

// What's new on Windows: the releases' notes from the CHANGELOG.md that ships inside the app (package.json's
// extraResources), so the window after an update needs no network and always matches the version installed. The Mac
// reads the same notes from the API by build number; Windows has no build numbers, so it reads them here.
//
// Each "## <version>" is a release, its "- " lines the notes, one per change, as release.sh / release.js write them.
// A "Windows:" or "Mac:" line on its own starts that platform's lines: each one below it is given the platform as a
// prefix ("Windows: …"), the form whatsnew.js reads to keep only this platform's. A release marked "(Mac only)" is left
// out; "### …" (the developer's own notes under a release) ends its notes.
//
// The CHANGELOG has no dates, so a release's `publishedAt` is when it first ran on this PC (`seen`, main.js), and a
// release that never ran here has none.

const fs = require('node:fs');
const path = require('node:path');

const VERSION = /^##\s+v?(\d+\.\d+(?:\.\d+)?)\b(.*)$/;
const SECTION = /^(windows|mac|macos)\s*:\s*$/i;

function parse(text) {
  const out = [];
  let cur = null, section = '', inNotes = false;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trimEnd();
    const v = VERSION.exec(line);
    if (v) {
      cur = /\(\s*mac(os)?\s+only\s*\)/i.test(v[2]) ? null : { version: v[1], notes: [] };
      if (cur) out.push(cur);
      section = '';
      inNotes = true;
      continue;
    }
    if (/^#{1,3}\s/.test(line)) {
      inNotes = false;
      continue;
    }
    if (!cur || !inNotes) continue;
    const s = SECTION.exec(line.trim());
    if (s) {
      section = /^win/i.test(s[1]) ? 'Windows' : 'Mac';
      continue;
    }
    const item = /^\s*[-*•]\s+(.+)$/.exec(line);
    if (!item) continue;
    const note = item[1].trim();
    // A line already naming its platform keeps its own name.
    cur.notes.push(section && !/^\s*(windows|mac(os)?)\s*:/i.test(note) ? `${section}: ${note}` : note);
  }
  return out.filter((r) => r.notes.length);
}

function createReleaseNotes({ app, seen }) {
  const file = app.isPackaged
    ? path.join(process.resourcesPath, 'CHANGELOG.md')
    : path.join(__dirname, '..', '..', 'CHANGELOG.md');
  let cache = null;
  function all() {
    if (!cache) {
      try {
        cache = parse(fs.readFileSync(file, 'utf8'));
      } catch (e) {
        console.error('release notes:', e.message);
        cache = [];
      }
    }
    return cache;
  }
  // The releases this PC has, newest first, in the API's shape (whatsnew.js): none newer than the one running.
  function list(newerVersion) {
    const mine = app.getVersion();
    const when = seen() || {};
    return all()
      .filter((r) => !newerVersion(r.version, mine))
      .slice(0, 8)
      .map((r) => ({
        version: r.version,
        build: 0,
        notes: r.notes.join('\n'),
        publishedAt: typeof when[r.version] === 'number' ? new Date(when[r.version]).toISOString() : null,
      }));
  }
  return { list };
}

module.exports = { createReleaseNotes, parse };
