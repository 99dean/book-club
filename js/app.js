import { html, render, useState, useEffect, useMemo, useCallback } from '../vendor/preact-htm.js';
import { createStore } from './store.js';
import { byId, lookupBook } from './util.js';
import { Icon } from './ui.js';
import { Reading, Talk, UpNext, Shelf, WhoAreYou, Gate, Birthday, FirstPick } from './screens.js';
import { SheetHost } from './sheets.js';

const store = createStore();
const ME_KEY = 'bookclub-me';
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => {
  try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ }
};
const now = () => new Date().toISOString();

function derive(s, meId) {
  const mById = byId(s.members);
  const active = s.members.filter((m) => m.active);
  const me = mById[meId]?.active ? mById[meId] : null;
  const votesFor = (id) => s.votes.filter((v) => v.book_id === id);
  const current = s.books
    .filter((b) => b.status === 'current')
    .sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''))[0] || null;
  const queue = s.books
    .filter((b) => b.status === 'queue')
    .sort((a, b) => votesFor(b.id).length - votesFor(a.id).length || (a.added_at || '').localeCompare(b.added_at || ''));
  const finished = s.books
    .filter((b) => b.status === 'finished')
    .sort((a, b) => (b.finished_at || '').localeCompare(a.finished_at || ''));

  let readers = [];
  let sittingOut = [];
  let myPct = 0;
  let meReading = false;
  if (current) {
    const p = Object.fromEntries(s.progress.filter((r) => r.book_id === current.id).map((r) => [r.member_id, r]));
    readers = active
      .filter((m) => !p[m.id]?.sitting_out)
      .map((m) => ({ member: m, pct: p[m.id]?.percent || 0 }))
      .sort((a, b) => b.pct - a.pct);
    sittingOut = active.filter((m) => p[m.id]?.sitting_out);
    myPct = p[meId]?.percent || 0;
    meReading = !!me && !p[meId]?.sitting_out;
  }
  const meetup = current
    ? s.meetups
      .filter((x) => x.book_id === current.id && new Date(x.starts_at).getTime() > Date.now() - 3 * 3600e3)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] || null
    : null;
  const birthday = s.club_settings.find((c) => c.key === 'birthday')?.value || null;
  return { ...s, mById, active, me, votesFor, current, queue, finished, readers, sittingOut, myPct, meReading, meetup, birthday };
}

function App() {
  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState('');
  const [state, setState] = useState(null);
  const [meId, setMeId] = useState(lsGet(ME_KEY));
  const [tab, setTab] = useState('reading');
  const [sheet, setSheet] = useState(null);
  const [view, setView] = useState(null);
  const [toast, setToast] = useState(null);

  const reload = useCallback(async () => {
    try { setState(await store.load()); } catch (e) { console.error(e); }
  }, []);

  const boot = useCallback(async () => {
    setPhase('loading');
    try {
      const { joined } = await store.init();
      if (!joined) return setPhase('gate');
      await reload();
      setPhase('ready');
    } catch (e) {
      console.error(e);
      setError(e.message || String(e));
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    const off = store.subscribe(reload);
    boot();
    return off;
  }, []);

  const d = useMemo(() => (state ? derive(state, meId) : null), [state, meId]);

  // Fill in covers and page counts for books added without them (once per session).
  useEffect(() => {
    if (!d) return;
    const missing = d.books.filter((b) => !b.cover_url && !lookedUp.has(b.id));
    (async () => {
      for (const b of missing) {
        lookedUp.add(b.id);
        const found = await lookupBook(b);
        if (found && (found.cover_url || found.page_count)) await store.update('books', { id: b.id }, found);
      }
    })();
  }, [d?.books.length]);

  const flash = (msg) => {
    setToast(msg);
    clearTimeout(flash.t);
    flash.t = setTimeout(() => setToast(null), 2600);
  };

  const guard = (fn) => async (...args) => {
    try { return await fn(...args); } catch (e) { console.error(e); flash(`Couldn't save: ${e.message || e}`); }
  };

  const act = d && {
    mode: store.mode,
    flash,
    open: (type, props = {}) => setSheet({ type, ...props }),
    close: () => setSheet(null),
    setTab,
    setView,
    pickMe: (id) => { lsSet(ME_KEY, id); setMeId(id); setTab('reading'); },
    signOut: () => { lsSet(ME_KEY, null); setMeId(null); setSheet(null); setToast(null); },
    join: async (code) => {
      const ok = await store.join(code);
      if (ok) { await reload(); setPhase('ready'); }
      return ok;
    },
    resetDemo: guard(async () => { await store.reset(); lsSet(ME_KEY, null); setMeId(null); setSheet(null); }),

    startBook: guard(async (book) => {
      if (d.current && d.current.id !== book.id) throw new Error(`finish ${d.current.title} first`);
      await store.update('books', { id: book.id }, { status: 'current', started_at: now(), picked_by: d.me.id });
    }),
    finishBook: guard(async (book) => {
      await store.update('books', { id: book.id }, { status: 'finished', finished_at: now() });
      flash(`${book.title} is on the shelf`);
    }),
    addBook: guard((fields) => store.insert('books', {
      title: fields.title.trim(), author: fields.author.trim(), pitch: fields.pitch.trim(),
      cover_url: fields.cover_url || null, page_count: fields.page_count || null,
      status: 'queue', suggested_by: d.me.id, picked_by: null, added_at: now(), started_at: null, finished_at: null,
    })),
    removeBook: guard((book) => store.remove('books', { id: book.id })),
    toggleVote: guard(async (book) => {
      const mine = d.votes.some((v) => v.book_id === book.id && v.member_id === d.me.id);
      if (mine) await store.remove('votes', { book_id: book.id, member_id: d.me.id });
      else await store.upsert('votes', { book_id: book.id, member_id: d.me.id });
    }),

    setProgress: guard(async (pct, sittingOut = false) => {
      const before = d.myPct;
      await store.upsert('progress', {
        book_id: d.current.id, member_id: d.me.id, percent: pct, sitting_out: sittingOut, updated_at: now(),
      });
      const passed = d.readers.filter((r) => r.member.id !== d.me.id && r.pct > before && r.pct < pct);
      if (!sittingOut && passed.length) flash(`You passed ${passed.map((r) => r.member.name).join(' & ')}!`);
    }),

    post: guard((kind, body, chapter) => store.insert('posts', {
      book_id: d.current.id, member_id: d.me.id, kind, body: body.trim(), chapter: chapter.trim(), at_percent: d.myPct,
    })),
    deletePost: guard(async (post) => {
      await store.remove('replies', { post_id: post.id });
      await store.remove('posts', { id: post.id });
    }),
    reply: guard((post, body) => store.insert('replies', { post_id: post.id, member_id: d.me.id, body: body.trim() })),

    tear: guard(async ({ to, passage, note, page_label }) => {
      await store.insert('torn_pages', {
        book_id: d.current.id, from_member: d.me.id, to_member: to, passage: passage.trim(),
        note: note.trim(), page_label: page_label.trim(), at_percent: d.myPct,
      });
      flash(`Torn out for ${d.mById[to].name}`);
    }),

    saveMeetup: guard(async ({ id, starts_at, facetime_url, goal_percent }) => {
      const row = { book_id: d.current.id, starts_at, facetime_url: facetime_url.trim(), goal_percent };
      if (id) await store.update('meetups', { id }, row);
      else await store.insert('meetups', row);
    }),
    deleteMeetup: guard((m) => store.remove('meetups', { id: m.id })),

    rate: guard((book, stars, review) => store.upsert('ratings', {
      book_id: book.id, member_id: d.me.id, stars, review: review.trim(),
    })),
    updateMember: guard((member, patch) => store.update('members', { id: member.id }, patch)),
    markBirthdaySeen: guard(() => store.upsert('club_settings', { key: 'birthday', value: { ...d.birthday, seen: true } })),
  };

  if (phase === 'loading') return html`<div class="splash"><div class="splash-mark">∞</div></div>`;
  if (phase === 'error') {
    return html`<div class="center-screen">
      <h1>Something went wrong</h1><p class="muted">${error}</p>
      <button class="btn primary" onClick=${boot}>Try again</button>
    </div>`;
  }
  if (phase === 'gate') return html`<${Gate} join=${(c) => act.join(c)} />`;
  if (!d) return null;
  if (!d.me) return html`<${WhoAreYou} d=${d} act=${act} />`;

  const bday = d.birthday;
  if (view === 'birthday-preview') return html`<${Birthday} d=${d} act=${act} preview />`;
  if (bday && bday.member_id === d.me.id && !bday.seen) {
    if (view === 'firstpick' && !d.current) return html`<${FirstPick} d=${d} act=${act} />`;
    return html`<${Birthday} d=${d} act=${act} />`;
  }

  const Screen = { reading: Reading, talk: Talk, upnext: UpNext, shelf: Shelf }[tab];
  const tabs = [['reading', 'Reading', 'book'], ['talk', 'Talk', 'talk'], ['upnext', 'Up next', 'list'], ['shelf', 'Shelf', 'shelf']];
  return html`
    <main class="screen"><${Screen} d=${d} act=${act} /></main>
    <div class="dock">
      <nav class="tabbar glass" aria-label="Sections">
        ${tabs.map(([key, label, icon]) => html`
          <button class=${`tab ${tab === key ? 'active' : ''}`} aria-current=${tab === key ? 'page' : undefined}
            onClick=${() => { setTab(key); scrollTo(0, 0); }}>
            <${Icon} name=${icon} /><span>${label}</span>
          </button>`)}
      </nav>
      <button class="fab" aria-label="Add something" onClick=${() => act.open('actions')}><${Icon} name="plus" size=${26} /></button>
    </div>
    ${sheet && html`<${SheetHost} sheet=${sheet} d=${d} act=${act} />`}
    ${toast && html`<div class="toast glass" role="status">${toast}</div>`}
  `;
}

const lookedUp = new Set();

render(html`<${App} />`, document.getElementById('app'));

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
