// Data layer. Two interchangeable backends with the same API:
//   DemoStore     – saves to this device's localStorage (no setup needed)
//   SupabaseStore – the real shared database, with live updates between phones
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { seedState } from './seed.js';

export const TABLES = ['members', 'books', 'votes', 'progress', 'posts', 'replies',
  'torn_pages', 'ratings', 'meetups', 'club_settings'];

// Composite primary keys; every other table uses `id`.
const KEYS = {
  votes: ['book_id', 'member_id'],
  progress: ['book_id', 'member_id'],
  ratings: ['book_id', 'member_id'],
  club_settings: ['key'],
};
const keysOf = (table) => KEYS[table] || ['id'];
const withId = (table, row) => (KEYS[table] ? row : { id: newId(), ...row });
const matches = (row, match) => Object.entries(match).every(([k, v]) => row[k] === v);

export const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

class DemoStore {
  mode = 'demo';
  #key = 'bookclub-demo-v1';
  #mem = null;
  #listeners = new Set();

  async init() {
    try {
      const raw = localStorage.getItem(this.#key);
      this.#mem = raw ? JSON.parse(raw) : seedState();
    } catch {
      this.#mem = seedState();
    }
    for (const t of TABLES) this.#mem[t] ??= [];
    addEventListener('storage', (e) => {
      if (e.key === this.#key && e.newValue) {
        this.#mem = JSON.parse(e.newValue);
        this.#emit();
      }
    });
    return { joined: true };
  }

  async load() {
    return structuredClone(this.#mem);
  }

  #save() {
    try { localStorage.setItem(this.#key, JSON.stringify(this.#mem)); } catch { /* private mode: memory only */ }
    this.#emit();
  }

  #emit() { this.#listeners.forEach((fn) => fn()); }

  subscribe(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  async insert(table, row) {
    const full = { created_at: new Date().toISOString(), ...withId(table, row) };
    this.#mem[table].push(full);
    this.#save();
    return full;
  }

  async update(table, match, patch) {
    this.#mem[table] = this.#mem[table].map((r) => (matches(r, match) ? { ...r, ...patch } : r));
    this.#save();
  }

  async upsert(table, row) {
    const key = Object.fromEntries(keysOf(table).map((k) => [k, row[k]]));
    const existing = this.#mem[table].find((r) => matches(r, key));
    if (existing) Object.assign(existing, row);
    else this.#mem[table].push({ created_at: new Date().toISOString(), ...row });
    this.#save();
  }

  async remove(table, match) {
    this.#mem[table] = this.#mem[table].filter((r) => !matches(r, match));
    this.#save();
  }

  async reset() {
    this.#mem = seedState();
    this.#save();
  }
}

class SupabaseStore {
  mode = 'live';
  #db;
  #listeners = new Set();
  #timer = null;

  async init() {
    this.#db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    const { data } = await this.#db.auth.getSession();
    if (!data.session) {
      const { error } = await this.#db.auth.signInAnonymously();
      if (error) throw error;
    }
    const { data: member, error } = await this.#db.rpc('is_club_device');
    if (error) throw error;
    if (member) this.#listen();
    return { joined: !!member };
  }

  async join(code) {
    const { data, error } = await this.#db.rpc('join_club', { code: code.trim() });
    if (error) throw error;
    if (data) this.#listen();
    return !!data;
  }

  #listen() {
    this.#db.channel('club')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        clearTimeout(this.#timer);
        this.#timer = setTimeout(() => this.#listeners.forEach((fn) => fn()), 250);
      })
      .subscribe();
  }

  subscribe(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  async load() {
    const results = await Promise.all(TABLES.map((t) => this.#db.from(t).select('*')));
    const state = {};
    results.forEach(({ data, error }, i) => {
      if (error) throw error;
      state[TABLES[i]] = data;
    });
    return state;
  }

  async #run(query) {
    const { data, error } = await query;
    if (error) throw error;
    this.#listeners.forEach((fn) => fn());
    return data;
  }

  async insert(table, row) {
    const rows = await this.#run(this.#db.from(table).insert(withId(table, row)).select());
    return rows[0];
  }

  update(table, match, patch) {
    return this.#run(this.#db.from(table).update(patch).match(match));
  }

  upsert(table, row) {
    return this.#run(this.#db.from(table).upsert(row, { onConflict: keysOf(table).join(',') }));
  }

  remove(table, match) {
    return this.#run(this.#db.from(table).delete().match(match));
  }
}

export function createStore() {
  return SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase ? new SupabaseStore() : new DemoStore();
}
