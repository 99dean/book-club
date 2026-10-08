import { html, useState } from '../vendor/preact-htm.js';
import { Avatar, Cover, Icon, Links, Sheet, Stars, Toggle } from './ui.js';
import { clamp, getItLinks, toLocalInput } from './util.js';
import { KINDS, useBookSearch } from './screens.js';

export function SheetHost({ sheet, d, act }) {
  const { type, ...props } = sheet;
  const C = { actions: Actions, progress: Progress, post: Post, tear: Tear, meetup: MeetupSheet,
    book: BookSheet, addBook: AddBook, settings: Settings }[type];
  return html`<${C} d=${d} act=${act} ...${props} />`;
}

function Actions({ d, act }) {
  const go = (type, props) => () => act.open(type, props);
  if (!d.current) {
    return html`<${Sheet} title="Add something" onClose=${act.close}>
      <button class="action-row" onClick=${go('addBook')}><${Icon} name="plus" /><span>Suggest a book</span></button>
    <//>`;
  }
  return html`<${Sheet} title=${d.current.title} onClose=${act.close}>
    ${d.meReading && html`<button class="action-row" onClick=${go('progress')}><${Icon} name="book" /><span>Update my progress<small>You're at ${d.myPct}%</small></span></button>`}
    <button class="action-row" onClick=${go('post', { kind: 'question' })}><${Icon} name="question" /><span>Ask a question</span></button>
    <button class="action-row" onClick=${go('post', { kind: 'thought' })}><${Icon} name="thought" /><span>Share a thought</span></button>
    <button class="action-row" onClick=${go('post', { kind: 'quote' })}><${Icon} name="quote" /><span>Save a quote</span></button>
    <button class="action-row" onClick=${go('tear')}><${Icon} name="tear" /><span>Tear out a page<small>Send one person a passage</small></span></button>
  <//>`;
}

function Progress({ d, act }) {
  const pages = d.current.page_count;
  const [pct, setPct] = useState(d.myPct);
  const page = pages ? Math.round((pct / 100) * pages) : null;
  const save = async (sittingOut = false) => { await act.setProgress(pct, sittingOut); act.close(); };
  return html`<${Sheet} title="How far are you?" onClose=${act.close}>
    <div class="big-pct">${pct}%</div>
    <input type="range" min="0" max="100" step="1" value=${pct} aria-label="Percent read"
      onInput=${(e) => setPct(Number(e.currentTarget.value))} />
    ${pages && html`<label class="field inline">
      <span>Or enter your page</span>
      <span class="page-input"><input class="input" type="number" inputmode="numeric" min="0" max=${pages} value=${page}
        onInput=${(e) => setPct(clamp(Math.round((Number(e.currentTarget.value) / pages) * 100), 0, 100))} /> of ${pages}</span>
    </label>`}
    <p class="hint">Listening or on a Kindle? Use the percent from your app. Pages differ between editions, so the race runs on percent.</p>
    <button class="btn primary wide" onClick=${() => save(false)}>Save</button>
    <button class="link-btn center-block" onClick=${() => save(true)}>I'm sitting this one out</button>
  <//>`;
}

function Post({ d, act, kind: initial = 'question' }) {
  const [kind, setKind] = useState(initial);
  const [body, setBody] = useState('');
  const [chapter, setChapter] = useState('');
  const placeholder = { question: 'What do you want to ask everyone?', thought: 'What’s on your mind?', quote: 'Type the line you loved' }[kind];
  const submit = async (e) => {
    e.preventDefault();
    await act.post(kind, body, chapter);
    act.close();
    act.setTab('talk');
  };
  return html`<${Sheet} title=${`New ${KINDS[kind].label.toLowerCase()}`} onClose=${act.close}>
    <form onSubmit=${submit}>
      <div class="segmented glass" role="tablist">
        ${Object.entries(KINDS).map(([k, v]) => html`<button type="button" role="tab" aria-selected=${kind === k}
          class=${kind === k ? 'on' : ''} onClick=${() => setKind(k)}>${v.label}</button>`)}
      </div>
      <textarea class="input" rows="5" aria-label=${placeholder} placeholder=${placeholder} value=${body}
        onInput=${(e) => setBody(e.currentTarget.value)}></textarea>
      <input class="input" placeholder="Chapter or page (optional)" aria-label="Chapter or page" value=${chapter}
        onInput=${(e) => setChapter(e.currentTarget.value)} />
      <p class="hint">Tagged at ${d.myPct}%. Anyone behind you sees it hidden until they catch up.</p>
      <button class="btn primary wide" disabled=${!body.trim()}>Post</button>
    </form>
  <//>`;
}

function Tear({ d, act }) {
  const others = d.active.filter((m) => m.id !== d.me.id);
  const [to, setTo] = useState(null);
  const [passage, setPassage] = useState('');
  const [note, setNote] = useState('');
  const [pageLabel, setPageLabel] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    await act.tear({ to, passage, note, page_label: pageLabel });
    act.close();
  };
  return html`<${Sheet} title="Tear out a page" onClose=${act.close}>
    <form onSubmit=${submit}>
      <p class="hint">Like Joe tearing out pages for Jen when they shared one book. Pick who it's for.</p>
      <div class="who-row">
        ${others.map((m) => html`<button type="button" class=${`who-chip ${to === m.id ? 'on' : ''}`} aria-pressed=${to === m.id}
          onClick=${() => setTo(m.id)}><${Avatar} member=${m} size=${26} decorative />${m.name}</button>`)}
      </div>
      <textarea class="input" rows="5" placeholder="The passage" aria-label="The passage" value=${passage}
        onInput=${(e) => setPassage(e.currentTarget.value)}></textarea>
      <input class="input" placeholder="A note (optional)" aria-label="Note" value=${note} onInput=${(e) => setNote(e.currentTarget.value)} />
      <input class="input" placeholder="Page (optional)" aria-label="Page" value=${pageLabel} onInput=${(e) => setPageLabel(e.currentTarget.value)} />
      <p class="hint">If they haven't reached ${d.myPct}% yet, it stays folded until they do.</p>
      <button class="btn primary wide" disabled=${!to || !passage.trim()}>Tear it out</button>
    </form>
  <//>`;
}

function MeetupSheet({ d, act, meetup }) {
  const [when, setWhen] = useState(toLocalInput(meetup?.starts_at));
  const [url, setUrl] = useState(meetup?.facetime_url || '');
  const [goal, setGoal] = useState(meetup?.goal_percent ?? 50);
  const submit = async (e) => {
    e.preventDefault();
    await act.saveMeetup({ id: meetup?.id, starts_at: new Date(when).toISOString(), facetime_url: url, goal_percent: goal });
    act.close();
  };
  return html`<${Sheet} title=${meetup ? 'Edit meetup' : 'Plan a FaceTime'} onClose=${act.close}>
    <form onSubmit=${submit}>
      <label class="field"><span>When (your time)</span>
        <input class="input" type="datetime-local" value=${when} onInput=${(e) => setWhen(e.currentTarget.value)} required /></label>
      <label class="field"><span>FaceTime link</span>
        <input class="input" type="url" placeholder="https://facetime.apple.com/join#…" value=${url} onInput=${(e) => setUrl(e.currentTarget.value)} />
        <span class="hint">In FaceTime, tap Create Link, then paste it here.</span></label>
      <label class="field"><span>Read up to ${goal}% by then</span>
        <input type="range" min="5" max="100" step="5" value=${goal} onInput=${(e) => setGoal(Number(e.currentTarget.value))} /></label>
      <button class="btn primary wide">Save</button>
      ${meetup && html`<button type="button" class="link-btn danger center-block" onClick=${async () => { await act.deleteMeetup(meetup); act.close(); }}>Cancel this meetup</button>`}
    </form>
  <//>`;
}

function BookSheet({ d, act, book: initial }) {
  const book = d.books.find((b) => b.id === initial.id) || initial;
  const mine = d.ratings.find((r) => r.book_id === book.id && r.member_id === d.me.id);
  const [stars, setStars] = useState(mine?.stars || 0);
  const [review, setReview] = useState(mine?.review || '');
  const ratings = d.ratings.filter((r) => r.book_id === book.id);
  const suggester = d.mById[book.suggested_by];
  return html`<${Sheet} title=${book.title} onClose=${act.close}>
    <div class="book-detail">
      <${Cover} book=${book} size="l" />
      <div>
        <div class="book-title">${book.title}</div>
        <div class="muted">${book.author}</div>
        ${book.page_count && html`<div class="small muted">${book.page_count} pages</div>`}
        ${suggester && html`<div class="small muted">Suggested by ${suggester.name}</div>`}
      </div>
    </div>
    ${book.pitch && html`<p class="pitch big">“${book.pitch}”</p>`}
    <h3 class="sheet-sub">Get a copy</h3>
    <${Links} links=${getItLinks(book, d.me)} />
    ${!d.me.prefs?.library && html`<p class="hint">Add your library in Settings so Libby opens straight to a search.</p>`}

    ${book.status === 'queue' && html`<div class="stack">
      <button class="btn primary wide" disabled=${!!d.current} onClick=${async () => { await act.startBook(book); act.close(); act.setTab('reading'); }}>
        Start reading this</button>
      ${d.current && html`<p class="hint center">Finish ${d.current.title} first.</p>`}
      ${book.suggested_by === d.me.id && html`<button class="link-btn danger center-block"
        onClick=${async () => { if (confirm('Remove this book?')) { await act.removeBook(book); act.close(); } }}>Remove from Up next</button>`}
    </div>`}

    ${book.status === 'current' && html`<button class="btn primary wide"
      onClick=${async () => { if (confirm(`Finished ${book.title}? It moves to the shelf.`)) { await act.finishBook(book); act.close(); act.setTab('shelf'); } }}>
      We finished it</button>`}

    ${book.status === 'finished' && html`<div class="stack">
      <h3 class="sheet-sub">Your rating</h3>
      <${Stars} value=${stars} onChange=${setStars} />
      <input class="input" placeholder="One-line review" aria-label="One-line review" value=${review} onInput=${(e) => setReview(e.currentTarget.value)} />
      <button class="btn primary wide" disabled=${!stars} onClick=${async () => { await act.rate(book, stars, review); act.flash('Rating saved'); }}>${mine ? 'Update rating' : 'Save rating'}</button>
      ${ratings.length > 0 && html`<h3 class="sheet-sub">Everyone</h3>`}
      ${ratings.map((r) => html`<div class="reply">
        <${Avatar} member=${d.mById[r.member_id]} size=${24} />
        <span><${Stars} value=${r.stars} size=${14} /> ${r.review}</span></div>`)}
    </div>`}
  <//>`;
}

function AddBook({ d, act }) {
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ title: '', author: '', pitch: '', cover_url: null, page_count: null });
  const { results, status } = useBookSearch(q);
  const set = (k) => (e) => setForm({ ...form, [k]: e.currentTarget.value });
  const submit = async (e) => {
    e.preventDefault();
    await act.addBook(form);
    act.close();
    act.setTab('upnext');
  };
  return html`<${Sheet} title="Suggest a book" onClose=${act.close}>
    <label class="search glass"><${Icon} name="search" size=${20} />
      <input type="search" placeholder="Search title or author" aria-label="Search books" value=${q} onInput=${(e) => setQ(e.currentTarget.value)} />
    </label>
    ${status === 'loading' && html`<p class="hint">Searching…</p>`}
    ${status === 'error' && html`<p class="hint">Search is offline. Type it in below instead.</p>`}
    <div class="results">
      ${results.map((r) => html`<button class=${`result ${form.title === r.title && form.author === r.author ? 'on' : ''}`}
        onClick=${() => setForm({ ...form, ...r })}>
        <${Cover} book=${r} size="xs" />
        <span><strong>${r.title}</strong><br /><span class="muted small">${r.author}${r.year ? ` · ${r.year}` : ''}</span></span>
      </button>`)}
    </div>
    <form onSubmit=${submit}>
      <input class="input" placeholder="Title" aria-label="Title" value=${form.title} onInput=${set('title')} required />
      <input class="input" placeholder="Author" aria-label="Author" value=${form.author} onInput=${set('author')} />
      <textarea class="input" rows="3" placeholder="Your pitch: why should we read it?" aria-label="Pitch" value=${form.pitch}
        onInput=${set('pitch')}></textarea>
      <button class="btn primary wide" disabled=${!form.title.trim()}>Add to Up next</button>
    </form>
  <//>`;
}

const ZONES = [
  ['America/New_York', 'US Eastern'], ['America/Chicago', 'US Central'], ['America/Denver', 'US Mountain'],
  ['America/Los_Angeles', 'US Pacific'], ['Europe/London', 'UK'], ['Europe/Paris', 'Central Europe'],
];

const NOTIFY = [
  ['questions', 'Someone asks a question'],
  ['replies', 'Someone replies to you'],
  ['new_book', 'A new book is picked'],
  ['meetup', 'The day before a meetup'],
  ['passed', 'Someone passes you in the race'],
];

function Settings({ d, act }) {
  const me = d.me;
  const prefs = me.prefs || {};
  const savePrefs = (patch) => act.updateMember(me, { prefs: { ...prefs, ...patch } });
  const guests = d.members.filter((m) => m.is_guest);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return html`<${Sheet} title="Settings" onClose=${act.close}>
    <div class="me-row">
      <${Avatar} member=${me} size=${44} decorative />
      <div><strong>${me.name}</strong><div class="small muted">${me.city}</div></div>
      <button class="btn ghost small-btn push" onClick=${act.signOut}>Switch reader</button>
    </div>

    ${!standalone && html`<div class="tip">
      <strong>Put it on your home screen</strong>
      <span>In Safari tap Share, then Add to Home Screen. It opens like an app, and that's also what turns on notifications on iPhone.</span>
    </div>`}

    <h3 class="sheet-sub">Where you are</h3>
    <label class="field"><span>City</span>
      <input class="input" value=${me.city} onChange=${(e) => act.updateMember(me, { city: e.currentTarget.value.trim() })} /></label>
    <label class="field"><span>Time zone</span>
      <select class="input" value=${me.tz} onChange=${(e) => act.updateMember(me, { tz: e.currentTarget.value })}>
        ${ZONES.map(([v, l]) => html`<option value=${v}>${l}</option>`)}
      </select></label>
    <label class="field"><span>Your library in Libby</span>
      <input class="input" placeholder="e.g. dcpl" value=${prefs.library || ''} onChange=${(e) => savePrefs({ library: e.currentTarget.value.trim() })} />
      <span class="hint">Open Libby in a browser, pick your library, and copy the short name after libbyapp.com/library/.</span></label>

    <h3 class="sheet-sub">Notifications</h3>
    <p class="hint">Push notifications are switched on in the next update. Your choices here are saved now.</p>
    ${NOTIFY.map(([k, label]) => html`<${Toggle} label=${label} checked=${prefs.notify?.[k] ?? true}
      onChange=${(v) => savePrefs({ notify: { ...prefs.notify, [k]: v } })} />`)}

    <h3 class="sheet-sub">Guests</h3>
    ${guests.map((g) => html`<${Toggle} label=${g.name} hint=${g.active ? 'In the club' : 'Not added yet'} checked=${g.active}
      onChange=${(v) => act.updateMember(g, { active: v })} />`)}

    <h3 class="sheet-sub">Extras</h3>
    <button class="btn ghost wide" onClick=${() => { act.close(); act.setView('birthday-preview'); }}>Preview the birthday surprise</button>
    ${act.mode === 'demo' && html`<button class="btn ghost wide danger" onClick=${() => confirm('Erase demo data and start over?') && act.resetDemo()}>Reset demo data</button>`}
  <//>`;
}
