// Small helpers shared by the screens.

export const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));

export function relTime(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function daysUntil(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

const shortTime = (date, tz) =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz })
    .format(date)
    .replace(':00', '')
    .replace(' AM', 'am')
    .replace(' PM', 'pm');

// "2pm DC & Philly · 7pm London" — one entry per time zone the readers live in.
export function meetupTimes(iso, members) {
  const date = new Date(iso);
  const zones = new Map();
  for (const m of members) {
    if (!zones.has(m.tz)) zones.set(m.tz, new Set());
    zones.get(m.tz).add(m.city);
  }
  return [...zones.entries()]
    .map(([tz, cities]) => `${shortTime(date, tz)} ${[...cities].join(' & ')}`)
    .join(' · ');
}

export const meetupDay = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// Value for <input type="datetime-local"> in the viewer's own time zone.
export function toLocalInput(iso) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 14 * 86400000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Where to borrow / buy a book. Libby needs the reader's library (set in Settings).
export function getItLinks(book, me) {
  const q = encodeURIComponent(`${book.title} ${book.author || ''}`.trim());
  const uk = me?.tz === 'Europe/London';
  const lib = me?.prefs?.library?.trim();
  return [
    {
      label: 'Libby',
      href: lib ? `https://libbyapp.com/search/${encodeURIComponent(lib)}/search/query-${q}/page-1` : 'https://libbyapp.com/',
    },
    { label: 'Audible', href: `https://www.audible.${uk ? 'co.uk' : 'com'}/search?keywords=${q}` },
    { label: 'Libro.fm', href: `https://libro.fm/search?q=${q}` },
    { label: 'Bookshop', href: `https://${uk ? 'uk.' : ''}bookshop.org/search?keywords=${q}` },
  ];
}

// Open Library: free book search with covers and page counts.
export async function searchBooks(query, limit = 8) {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit}` +
    '&fields=key,title,author_name,cover_i,number_of_pages_median,first_publish_year';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Search failed');
  const { docs } = await res.json();
  return docs.map((d) => ({
    title: d.title,
    author: (d.author_name || []).slice(0, 2).join(' & '),
    year: d.first_publish_year,
    page_count: d.number_of_pages_median || null,
    cover_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
  }));
}

// Fill in a missing cover / page count by looking the book up once.
export async function lookupBook(book) {
  try {
    const [hit] = await searchBooks(`${book.title} ${book.author || ''}`, 1);
    if (!hit) return null;
    return { cover_url: book.cover_url || hit.cover_url, page_count: book.page_count || hit.page_count };
  } catch {
    return null;
  }
}

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
