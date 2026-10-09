// Starting data for the club. Demo mode uses it directly; supabase/schema.sql inserts the same rows.

const notify = { questions: true, replies: true, new_book: true, meetup: true, passed: true };

export const MEMBERS = [
  { id: 'm-joe', name: 'Joe', color: '#D08A3C', city: 'Philly', tz: 'America/New_York', is_guest: false, active: true },
  { id: 'm-jen', name: 'Jen', color: '#C2577A', city: 'Philly', tz: 'America/New_York', is_guest: false, active: true },
  { id: 'm-dean', name: 'Dean', color: '#3B6FB6', city: 'DC', tz: 'America/New_York', is_guest: false, active: true },
  { id: 'm-alec', name: 'Alec', color: '#7A5BB0', city: 'London', tz: 'Europe/London', is_guest: false, active: true },
  { id: 'm-alexa', name: 'Alexa', color: '#2F8F6B', city: 'DC', tz: 'America/New_York', is_guest: false, active: true },
  { id: 'm-kyleigh', name: 'Kyleigh', color: '#B0563A', city: 'London', tz: 'Europe/London', is_guest: true, active: false },
].map((m) => ({ ...m, prefs: { notify: { ...notify }, library: '' } }));

const BOOKS = [
  ['b-agi', 'The AGI Chronicles', 'Kevin Roose', 'Brand new. The inside story of the race to build AI.'],
  ['b-abundance', 'Abundance', 'Ezra Klein & Derek Thompson', 'Why America stopped building, and how it could start again.'],
  ['b-evil', 'Evil Geniuses', 'Kurt Andersen', 'Liked The Breakup? This is his nonfiction take.'],
  ['b-dunces', 'A Confederacy of Dunces', 'John Kennedy Toole', 'The wildcard: a cult-classic comic novel I’ve wanted to read.'],
];

export function seedState() {
  const now = new Date().toISOString();
  return {
    members: MEMBERS,
    books: BOOKS.map(([id, title, author, pitch]) => ({
      id, title, author, pitch, cover_url: null, page_count: null, status: 'queue',
      suggested_by: 'm-dean', picked_by: null, added_at: now, started_at: null, finished_at: null,
    })),
    votes: [], progress: [], posts: [], replies: [], torn_pages: [], ratings: [], meetups: [],
    club_settings: [{ key: 'birthday', value: { member_id: 'm-joe', seen: false } }],
  };
}
