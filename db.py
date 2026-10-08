"""Tiny SQLite storage layer for the family book club."""

import sqlite3
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "bookclub.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    emoji TEXT DEFAULT '📚'
);
CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    cover_url TEXT,
    pitch TEXT,
    status TEXT NOT NULL DEFAULT 'queue',  -- queue | current | finished
    suggested_by INTEGER REFERENCES members(id),
    added_at TEXT,
    started_at TEXT,
    finished_at TEXT
);
CREATE TABLE IF NOT EXISTS votes (
    book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
    member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, member_id)
);
CREATE TABLE IF NOT EXISTS progress (
    book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
    member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
    percent INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT,
    PRIMARY KEY (book_id, member_id)
);
CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY,
    book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
    member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,  -- thought | question | quote
    chapter TEXT,
    body TEXT NOT NULL,
    spoiler INTEGER DEFAULT 0,
    created_at TEXT
);
CREATE TABLE IF NOT EXISTS replies (
    id INTEGER PRIMARY KEY,
    note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
    member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TEXT
);
CREATE TABLE IF NOT EXISTS ratings (
    book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
    member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
    stars INTEGER NOT NULL,
    review TEXT,
    PRIMARY KEY (book_id, member_id)
);
"""


def now():
    return datetime.now().isoformat(timespec="seconds")


def connect():
    DB_PATH.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
    return conn


def query(sql, params=()):
    with connect() as conn:
        return [dict(r) for r in conn.execute(sql, params).fetchall()]


def execute(sql, params=()):
    with connect() as conn:
        return conn.execute(sql, params).lastrowid


# --- members -----------------------------------------------------------------

def members():
    return query("SELECT * FROM members ORDER BY name")


def add_member(name, emoji):
    execute("INSERT OR IGNORE INTO members (name, emoji) VALUES (?, ?)", (name.strip(), emoji))


# --- books -------------------------------------------------------------------

def books(status):
    order = {"queue": "votes DESC, b.added_at", "current": "b.started_at",
             "finished": "b.finished_at DESC"}[status]
    return query(
        f"""SELECT b.*, m.name AS suggested_by_name, m.emoji AS suggested_by_emoji,
                   (SELECT COUNT(*) FROM votes v WHERE v.book_id = b.id) AS votes
            FROM books b LEFT JOIN members m ON m.id = b.suggested_by
            WHERE b.status = ? ORDER BY {order}""",
        (status,),
    )


def add_book(title, author, cover_url, pitch, member_id):
    return execute(
        "INSERT INTO books (title, author, cover_url, pitch, suggested_by, added_at) VALUES (?, ?, ?, ?, ?, ?)",
        (title.strip(), author.strip(), cover_url, pitch.strip(), member_id, now()),
    )


def set_status(book_id, status):
    col = {"current": "started_at", "finished": "finished_at"}.get(status)
    if col:
        execute(f"UPDATE books SET status = ?, {col} = ? WHERE id = ?", (status, now(), book_id))
    else:
        execute("UPDATE books SET status = ? WHERE id = ?", (status, book_id))


def delete_book(book_id):
    execute("DELETE FROM books WHERE id = ?", (book_id,))


def voters(book_id):
    return query(
        "SELECT m.* FROM votes v JOIN members m ON m.id = v.member_id WHERE v.book_id = ?",
        (book_id,),
    )


def toggle_vote(book_id, member_id):
    with connect() as conn:
        hit = conn.execute(
            "DELETE FROM votes WHERE book_id = ? AND member_id = ?", (book_id, member_id)
        ).rowcount
        if not hit:
            conn.execute("INSERT INTO votes VALUES (?, ?)", (book_id, member_id))


# --- progress ----------------------------------------------------------------

def progress(book_id):
    return query(
        """SELECT m.id AS member_id, m.name, m.emoji, COALESCE(p.percent, 0) AS percent
           FROM members m LEFT JOIN progress p ON p.member_id = m.id AND p.book_id = ?
           ORDER BY m.name""",
        (book_id,),
    )


def set_progress(book_id, member_id, percent):
    execute(
        """INSERT INTO progress VALUES (?, ?, ?, ?)
           ON CONFLICT(book_id, member_id) DO UPDATE SET percent = excluded.percent,
                                                         updated_at = excluded.updated_at""",
        (book_id, member_id, percent, now()),
    )


# --- notes & replies ---------------------------------------------------------

def notes(book_id, kind=None):
    sql = """SELECT n.*, m.name, m.emoji FROM notes n JOIN members m ON m.id = n.member_id
             WHERE n.book_id = ?"""
    params = [book_id]
    if kind:
        sql += " AND n.kind = ?"
        params.append(kind)
    return query(sql + " ORDER BY n.created_at DESC", params)


def add_note(book_id, member_id, kind, chapter, body, spoiler):
    execute(
        "INSERT INTO notes (book_id, member_id, kind, chapter, body, spoiler, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (book_id, member_id, kind, chapter.strip(), body.strip(), int(spoiler), now()),
    )


def delete_note(note_id):
    execute("DELETE FROM notes WHERE id = ?", (note_id,))


def replies(note_id):
    return query(
        """SELECT r.*, m.name, m.emoji FROM replies r JOIN members m ON m.id = r.member_id
           WHERE r.note_id = ? ORDER BY r.created_at""",
        (note_id,),
    )


def add_reply(note_id, member_id, body):
    execute(
        "INSERT INTO replies (note_id, member_id, body, created_at) VALUES (?, ?, ?, ?)",
        (note_id, member_id, body.strip(), now()),
    )


# --- ratings -----------------------------------------------------------------

def ratings(book_id):
    return query(
        """SELECT r.*, m.name, m.emoji FROM ratings r JOIN members m ON m.id = r.member_id
           WHERE r.book_id = ? ORDER BY m.name""",
        (book_id,),
    )


def rate(book_id, member_id, stars, review):
    execute(
        """INSERT INTO ratings VALUES (?, ?, ?, ?)
           ON CONFLICT(book_id, member_id) DO UPDATE SET stars = excluded.stars,
                                                         review = excluded.review""",
        (book_id, member_id, stars, review.strip()),
    )
