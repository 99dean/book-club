import { html, useState, useEffect } from '../vendor/preact-htm.js';
import { Avatar, Cover, Icon, Links, Stars } from './ui.js';
import { daysUntil, getItLinks, meetupDay, meetupTimes, relTime, searchBooks } from './util.js';

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

function Header({ d, act, title = 'The Book Club', sub }) {
  return html`<header class="header">
    <div>
      <div class="eyebrow-soft">${sub ?? `${greeting()}, ${d.me.name}`}</div>
      <h1>${title}</h1>
    </div>
    <button class="avatar-btn glass" aria-label="Settings and switch reader" onClick=${() => act.open('settings')}>
      ${d.me.name[0]}
    </button>
  </header>
  ${act.mode === 'demo' && html`<div class="demo-banner">Demo mode: everything is saved on this device only.</div>`}`;
}

/* ---------------------------------------------------------------- Reading */

export function Reading({ d, act }) {
  if (!d.current) {
    const waiting = d.birthday && !d.birthday.seen && d.birthday.member_id !== d.me.id;
    const picker = waiting && d.mById[d.birthday.member_id];
    return html`<${Header} d=${d} act=${act} />
      <section class="card glass empty">
        ${waiting
          ? html`<h2>Hang tight</h2><p>${picker.name} gets to pick the first book. It's a surprise, so don't spoil it.</p>`
          : html`<h2>Nothing on the nightstand</h2><p>Pick the next book from Up next to start the race.</p>
              <button class="btn primary" onClick=${() => act.setTab('upnext')}>Go to Up next</button>`}
      </section>
      <${TornPages} d=${d} act=${act} />`;
  }
  const b = d.current;
  return html`<${Header} d=${d} act=${act} />
    <section class="card glass now" onClick=${() => act.open('book', { book: b })} role="button" tabindex="0"
      aria-label=${`${b.title} details`}>
      <${Cover} book=${b} size="m" />
      <div class="now-text">
        <div class="eyebrow">Now reading</div>
        <h2 class="book-title">${b.title}</h2>
        <div class="muted">${b.author}</div>
        ${b.picked_by && html`<div class="small muted">Picked by ${d.mById[b.picked_by]?.name}</div>`}
      </div>
    </section>
    <${Meetup} d=${d} act=${act} />
    <${Standings} d=${d} act=${act} />
    <${TornPages} d=${d} act=${act} />
    <${LatestTalk} d=${d} act=${act} />`;
}

function Meetup({ d, act }) {
  const m = d.meetup;
  if (!m) {
    return html`<button class="card glass meetup-empty" onClick=${() => act.open('meetup')}>
      <${Icon} name="video" /> <span>Plan the next FaceTime</span>
    </button>`;
  }
  const days = daysUntil(m.starts_at);
  const when = days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
  const people = [...d.readers.map((r) => r.member), ...d.sittingOut];
  return html`<section class="card glass meetup">
    <div class="meetup-top">
      <div>
        <div class="eyebrow">${when} · FaceTime</div>
        <div class="meetup-day">${meetupDay(m.starts_at)}</div>
        <div class="small muted">${meetupTimes(m.starts_at, people)}</div>
      </div>
      <button class="btn ghost small-btn" onClick=${() => act.open('meetup', { meetup: m })}>Edit</button>
    </div>
    ${m.facetime_url && html`<a class="btn primary wide" href=${m.facetime_url} target="_blank" rel="noopener">
      <${Icon} name="video" /> Join FaceTime</a>`}
  </section>`;
}

function standingsLine(d) {
  const { readers, me, myPct, meReading, meetup } = d;
  if (!readers.length) return 'Nobody is reading this one yet.';
  const goal = meetup?.goal_percent;
  const goalBit = goal == null || !meReading ? '' : myPct >= goal ? ' You’ve hit the meetup goal.' : ` ${goal - myPct}% to the meetup goal.`;
  if (!meReading) return `${readers[0].member.name} leads at ${readers[0].pct}%.`;
  const rank = readers.findIndex((r) => r.member.id === me.id);
  if (rank === 0) {
    const next = readers[1];
    if (!next) return `You're the only one reading. Lead secured.${goalBit}`;
    if (next.pct === myPct) return `You're tied with ${next.member.name}.${goalBit}`;
    return `You're in the lead, ${myPct - next.pct}% ahead of ${next.member.name}.${goalBit}`;
  }
  const leader = readers[0];
  return `${leader.member.name} is ${leader.pct - myPct}% ahead of you.${goalBit}`;
}

function Standings({ d, act }) {
  const goal = d.meetup?.goal_percent;
  return html`<section class="card glass">
    <div class="card-head">
      <h2>Standings</h2>
      ${goal != null && html`<span class="small muted">Goal: ${goal}% by ${meetupDay(d.meetup.starts_at).replace(/^\w+, /, '')}</span>`}
    </div>
    <div class="lanes">
      ${goal != null && html`<div class="goal-line" aria-hidden="true" style=${{ left: `calc(54px + (100% - 102px) * ${goal / 100})` }}></div>`}
      ${d.readers.map(({ member, pct }) => {
        const isMe = member.id === d.me.id;
        return html`<div class=${`lane ${isMe ? 'me' : ''}`}>
          <span class="lane-name">${isMe ? 'You' : member.name}</span>
          <div class="track" role="progressbar" aria-label=${`${member.name} ${pct}%`} aria-valuenow=${pct} aria-valuemin="0" aria-valuemax="100">
            <div class="track-fill" style=${{ width: `${pct}%` }}></div>
            <div class="runner" style=${{ left: `calc(${pct}% - ${pct * 0.24}px)`, background: member.color }}>${member.name[0]}</div>
          </div>
          <span class="lane-pct">${pct}%</span>
        </div>`;
      })}
    </div>
    ${d.sittingOut.length > 0 && html`<p class="small muted">
      ${d.sittingOut.map((m) => (m.id === d.me.id ? 'You' : m.name)).join(' & ')} ${d.sittingOut.length > 1 || d.sittingOut[0].id === d.me.id ? 'are' : 'is'} sitting this one out.</p>`}
    <div class="standings-foot">
      <p>${standingsLine(d)}</p>
      ${d.meReading
        ? html`<button class="btn dark small-btn" onClick=${() => act.open('progress')}>Update</button>`
        : html`<button class="btn dark small-btn" onClick=${() => act.setProgress(d.myPct, false)}>Join in</button>`}
    </div>
  </section>`;
}

function TornPages({ d, act }) {
  const mine = d.torn_pages
    .filter((t) => t.to_member === d.me.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 3);
  if (!mine.length) return null;
  return html`<section>
    <h2 class="section-title">Torn out for you</h2>
    ${mine.map((t, i) => {
      const from = d.mById[t.from_member];
      const sameBook = d.current && t.book_id === d.current.id;
      const folded = sameBook && t.at_percent > d.myPct;
      return html`<article class=${`torn ${folded ? 'folded' : ''}`} style=${{ '--tilt': `${i % 2 ? 1 : -1.2}deg` }}>
        <div class="torn-meta"><span>From ${from?.name}</span><span>${t.page_label || `${t.at_percent}%`}</span></div>
        ${folded
          ? html`<p class="torn-folded">${from?.name} tore this out at ${t.at_percent}%. Keep reading to unfold it.</p>`
          : html`<p class="torn-passage">${t.passage}</p>${t.note && html`<p class="torn-note">“${t.note}”</p>`}`}
      </article>`;
    })}
  </section>`;
}

function LatestTalk({ d, act }) {
  const posts = d.posts
    .filter((p) => p.book_id === d.current.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 2);
  return html`<section>
    <div class="card-head">
      <h2 class="section-title">Latest talk</h2>
      <button class="link-btn" onClick=${() => act.setTab('talk')}>See all</button>
    </div>
    ${posts.length
      ? posts.map((p) => html`<${PostCard} d=${d} act=${act} post=${p} compact />`)
      : html`<button class="card glass meetup-empty" onClick=${() => act.open('post', { kind: 'question' })}>
          <${Icon} name="question" /> <span>Ask the first question</span></button>`}
  </section>`;
}

/* ---------------------------------------------------------------- Talk */

export const KINDS = {
  question: { label: 'Question', verb: 'asked', icon: 'question' },
  thought: { label: 'Thought', verb: 'shared a thought', icon: 'thought' },
  quote: { label: 'Quote', verb: 'saved a quote', icon: 'quote' },
};

function PostCard({ d, act, post, compact }) {
  const [revealed, setRevealed] = useState(false);
  const [reply, setReply] = useState('');
  const author = d.mById[post.member_id];
  const replies = d.replies.filter((r) => r.post_id === post.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const spoiler = post.member_id !== d.me.id && post.book_id === d.current?.id && post.at_percent > d.myPct && !revealed;
  const kind = KINDS[post.kind];
  return html`<article class="card glass post" onClick=${compact ? () => act.setTab('talk') : undefined}>
    <div class="post-meta">
      <${Avatar} member=${author} size=${28} decorative />
      <span><strong>${author?.name}</strong> ${kind.verb}${post.chapter ? ` · ${post.chapter}` : ''}</span>
      <span class="muted small push">${relTime(post.created_at)}</span>
    </div>
    ${spoiler
      ? html`<button class="spoiler" onClick=${(e) => { e.stopPropagation(); setRevealed(true); }}>
          Written at ${post.at_percent}%, you're at ${d.myPct}%. Tap to read anyway.</button>`
      : html`<p class=${`post-body ${post.kind === 'quote' ? 'quote' : ''}`}>${post.body}</p>`}
    ${compact
      ? replies.length > 0 && html`<div class="small accent">${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}</div>`
      : html`
        ${replies.map((r) => html`<div class="reply">
          <${Avatar} member=${d.mById[r.member_id]} size=${22} decorative />
          <span><strong>${d.mById[r.member_id]?.name}</strong> ${r.body}</span>
        </div>`)}
        <form class="reply-form" onSubmit=${async (e) => { e.preventDefault(); if (reply.trim()) { await act.reply(post, reply); setReply(''); } }}>
          <input class="input" placeholder="Reply…" aria-label="Reply" value=${reply} onInput=${(e) => setReply(e.currentTarget.value)} />
          <button class="btn dark small-btn" disabled=${!reply.trim()}>Send</button>
        </form>
        ${post.member_id === d.me.id && html`<button class="link-btn danger" onClick=${() => confirm('Delete this post?') && act.deletePost(post)}>Delete</button>`}`}
  </article>`;
}

export function Talk({ d, act }) {
  const [filter, setFilter] = useState('all');
  if (!d.current) {
    return html`<${Header} d=${d} act=${act} title="Talk" />
      <section class="card glass empty"><h2>No book yet</h2><p>Once a book is picked, questions and thoughts land here.</p></section>`;
  }
  const posts = d.posts
    .filter((p) => p.book_id === d.current.id && (filter === 'all' || p.kind === filter))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return html`<${Header} d=${d} act=${act} title="Talk" sub=${d.current.title} />
    <div class="segmented glass" role="tablist">
      ${[['all', 'All'], ['question', 'Questions'], ['thought', 'Thoughts'], ['quote', 'Quotes']].map(([k, label]) => html`
        <button role="tab" aria-selected=${filter === k} class=${filter === k ? 'on' : ''} onClick=${() => setFilter(k)}>${label}</button>`)}
    </div>
    <div class="row-btns">
      <button class="btn primary" onClick=${() => act.open('post', { kind: 'question' })}><${Icon} name="question" /> Ask</button>
      <button class="btn ghost" onClick=${() => act.open('post', { kind: 'thought' })}><${Icon} name="thought" /> Thought</button>
      <button class="btn ghost" onClick=${() => act.open('post', { kind: 'quote' })}><${Icon} name="quote" /> Quote</button>
    </div>
    ${posts.length ? posts.map((p) => html`<${PostCard} key=${p.id} d=${d} act=${act} post=${p} />`)
      : html`<p class="muted center">Nothing here yet. Start the conversation.</p>`}`;
}

/* ---------------------------------------------------------------- Up next */

export function UpNext({ d, act }) {
  return html`<${Header} d=${d} act=${act} title="Up next" sub="Suggest, pitch, vote" />
    <button class="btn primary wide" onClick=${() => act.open('addBook')}><${Icon} name="plus" /> Suggest a book</button>
    ${d.queue.length === 0 && html`<p class="muted center">The queue is empty. Suggest something!</p>`}
    ${d.queue.map((b) => {
      const votes = d.votesFor(b.id);
      const mine = votes.some((v) => v.member_id === d.me.id);
      return html`<article class="card glass queue-item" key=${b.id}>
        <button class="queue-main" onClick=${() => act.open('book', { book: b })} aria-label=${`${b.title} details`}>
          <${Cover} book=${b} size="s" />
          <span class="queue-text">
            <span class="book-title-s">${b.title}</span>
            <span class="muted small">${b.author}</span>
            ${b.pitch && html`<span class="pitch">${d.mById[b.suggested_by]?.name}: “${b.pitch}”</span>`}
          </span>
        </button>
        <div class="queue-foot">
          <span class="voters">${votes.map((v) => html`<${Avatar} member=${d.mById[v.member_id]} size=${22} />`)}</span>
          <button class=${`btn small-btn ${mine ? 'dark' : 'ghost'}`} aria-pressed=${mine} onClick=${() => act.toggleVote(b)}>
            <${Icon} name="up" size=${16} /> ${mine ? 'Voted' : 'Vote'}${votes.length ? ` · ${votes.length}` : ''}
          </button>
        </div>
      </article>`;
    })}`;
}

/* ---------------------------------------------------------------- Shelf */

export function Shelf({ d, act }) {
  return html`<${Header} d=${d} act=${act} title="Shelf"
      sub=${d.finished.length ? `${d.finished.length} ${d.finished.length === 1 ? 'book' : 'books'} read together` : 'Finished books live here'} />
    ${d.finished.length === 0 && html`<section class="card glass empty"><h2>Empty shelf, for now</h2>
      <p>When you finish a book together it lands here with everyone's ratings.</p></section>`}
    ${d.finished.map((b) => {
      const rs = d.ratings.filter((r) => r.book_id === b.id);
      const avg = rs.length ? rs.reduce((a, r) => a + r.stars, 0) / rs.length : 0;
      const mine = rs.find((r) => r.member_id === d.me.id);
      return html`<button class="card glass shelf-item" key=${b.id} onClick=${() => act.open('book', { book: b })}>
        <${Cover} book=${b} size="s" />
        <span class="queue-text">
          <span class="book-title-s">${b.title}</span>
          <span class="muted small">${b.author}</span>
          <span class="shelf-stars"><${Stars} value=${Math.round(avg)} size=${16} />
            <span class="small muted">${rs.length ? `${avg.toFixed(1)} from ${rs.length}` : 'No ratings yet'}</span></span>
          ${!mine && html`<span class="small accent">Add your rating</span>`}
        </span>
      </button>`;
    })}`;
}

/* ---------------------------------------------------------------- Entry screens */

export function WhoAreYou({ d, act }) {
  return html`<div class="center-screen">
    <div class="eyebrow">The Book Club</div>
    <h1>Who's reading?</h1>
    <div class="who-grid">
      ${d.active.map((m) => html`<button class="who glass" onClick=${() => act.pickMe(m.id)}>
        <${Avatar} member=${m} size=${56} decorative /><span>${m.name}</span></button>`)}
    </div>
    <p class="muted small">You only pick once on each device.</p>
  </div>`;
}

export function Gate({ join }) {
  const [code, setCode] = useState(new URLSearchParams(location.search).get('code') || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e?.preventDefault();
    setBusy(true); setErr('');
    try {
      if (!(await join(code))) setErr("That code didn't work. Check with Dean.");
    } catch (ex) { setErr(ex.message); }
    setBusy(false);
  };
  useEffect(() => { if (code) submit(); }, []);
  return html`<form class="center-screen" onSubmit=${submit}>
    <div class="eyebrow">The Book Club</div>
    <h1>Family only</h1>
    <p class="muted">Enter the family code to join.</p>
    <input class="input big" aria-label="Family code" autocomplete="off" value=${code} onInput=${(e) => setCode(e.currentTarget.value)} />
    ${err && html`<p class="error">${err}</p>`}
    <button class="btn primary wide" disabled=${busy || !code.trim()}>${busy ? 'Checking…' : 'Join'}</button>
  </form>`;
}

export function Birthday({ d, act, preview }) {
  const go = () => {
    if (preview) return act.setView(null);
    if (!d.current) return act.setView('firstpick');
    act.markBirthdaySeen();
  };
  return html`<div class="birthday">
    <div class="spines" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <div class="bday-top">
      <div class="eyebrow">A surprise for you</div>
      <h1 class="bday-title">Happy birthday, Dad</h1>
    </div>
    <div class="card glass bday-card">
      <p>Dad, I always want to be on the same page as you. This is my attempt to do that literally (or literarily).</p>
      <p>It's your birthday, so <strong class="accent">you pick the first book.</strong></p>
      <div class="bday-sign"><span class="infinity" aria-hidden="true">∞</span><span>Love you infinity,<br /><strong>Dean</strong></span></div>
    </div>
    <button class="btn primary wide big-btn" onClick=${go}>
      ${preview ? 'Close preview' : d.current ? "Let's go" : 'Choose our first book'} <${Icon} name="arrow" />
    </button>
  </div>`;
}

function useBookSearch(query) {
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle');
  useEffect(() => {
    if (query.trim().length < 3) { setResults([]); setStatus('idle'); return; }
    setStatus('loading');
    const t = setTimeout(async () => {
      try { setResults(await searchBooks(query)); setStatus('done'); } catch { setStatus('error'); }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);
  return { results, status };
}
export { useBookSearch };

export function FirstPick({ d, act }) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const { results, status } = useBookSearch(q);
  const options = q.trim().length >= 3 ? results : d.queue;
  const isPicked = (b) => picked && picked.title === b.title && picked.author === b.author;
  const confirmPick = async () => {
    setBusy(true);
    let book = picked;
    if (!book.id) book = await act.addBook({ ...book, pitch: '' });
    if (book) {
      await act.startBook(book);
      await act.markBirthdaySeen();
      act.setView(null);
      act.flash(`${book.title} it is!`);
    }
    setBusy(false);
  };
  return html`<div class="screen firstpick">
    <button class="icon-btn glass" aria-label="Back" onClick=${() => act.setView(null)}><${Icon} name="back" /></button>
    <h1>Pick book #1</h1>
    <p class="muted">Search for anything, or start with one of these.</p>
    <label class="search glass"><${Icon} name="search" size=${20} />
      <input type="search" placeholder="Title or author" aria-label="Search books" value=${q} onInput=${(e) => setQ(e.currentTarget.value)} />
    </label>
    <h2 class="section-title">${q.trim().length >= 3 ? (status === 'loading' ? 'Searching…' : status === 'error' ? 'Search is offline right now' : 'Results') : 'A few ideas from Dean'}</h2>
    ${options.map((b) => html`<div class=${`card glass pick ${isPicked(b) ? 'picked' : ''}`}>
      <button class="queue-main" onClick=${() => setPicked(b)} aria-pressed=${isPicked(b)}>
        <${Cover} book=${b} size="s" />
        <span class="queue-text">
          <span class="book-title-s">${b.title}</span>
          <span class="muted small">${b.author}${b.year ? ` · ${b.year}` : ''}</span>
          ${b.pitch && html`<span class="pitch">${b.pitch}</span>`}
        </span>
      </button>
      ${isPicked(b) && html`<${Links} links=${getItLinks(b, d.me)} />`}
    </div>`)}
    <div class="dock-cta">
      <button class="btn primary wide big-btn" disabled=${!picked || busy} onClick=${confirmPick}>
        ${picked ? 'Make it official' : 'Pick a book'}</button>
    </div>
  </div>`;
}
