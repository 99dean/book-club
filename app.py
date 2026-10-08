"""The family book club 📚 — a cozy little Streamlit app."""

import requests
import streamlit as st

import db

st.set_page_config(page_title="Family Book Club", page_icon="📚", layout="centered")

EMOJIS = ["📚", "🦉", "🐻", "🦊", "🐢", "🌻", "☕", "🎣", "🍷", "🧙", "🚀", "🐶", "🐱", "🎂"]
KINDS = {"thought": "💭 Thought", "question": "❓ Question", "quote": "✍️ Favorite quote"}


# --- helpers -----------------------------------------------------------------

@st.cache_data(ttl=3600, show_spinner=False)
def search_open_library(q):
    """Look up books on Open Library so we get covers + authors for free."""
    try:
        r = requests.get(
            "https://openlibrary.org/search.json",
            params={"q": q, "limit": 6, "fields": "title,author_name,cover_i,first_publish_year"},
            timeout=8,
        )
        r.raise_for_status()
    except requests.RequestException:
        return []
    return [
        {
            "title": d.get("title", ""),
            "author": ", ".join(d.get("author_name", [])[:2]),
            "year": d.get("first_publish_year"),
            "cover_url": f"https://covers.openlibrary.org/b/id/{d['cover_i']}-M.jpg" if d.get("cover_i") else None,
        }
        for d in r.json().get("docs", [])
    ]


def cover(book, width=110):
    if book.get("cover_url"):
        st.image(book["cover_url"], width=width)
    else:
        st.markdown(f"<div style='font-size:{width // 2}px'>📕</div>", unsafe_allow_html=True)


def who(row):
    return f"{row['emoji']} **{row['name']}**"


def when(ts):
    return ts[:10] if ts else ""


# --- sidebar: who's reading? -------------------------------------------------

members = db.members()

with st.sidebar:
    st.title("📚 Book Club")
    if members:
        names = [m["name"] for m in members]
        default = names.index(st.session_state["me"]) if st.session_state.get("me") in names else 0
        me_name = st.selectbox("Who's reading?", names, index=default,
                               format_func=lambda n: f"{next(m['emoji'] for m in members if m['name'] == n)} {n}")
        st.session_state["me"] = me_name
        me = next(m for m in members if m["name"] == me_name)
    else:
        me = None
    with st.expander("➕ Join the club"):
        with st.form("join", clear_on_submit=True):
            name = st.text_input("Your name")
            emoji = st.selectbox("Pick a reading buddy", EMOJIS)
            if st.form_submit_button("Join") and name.strip():
                db.add_member(name, emoji)
                st.session_state["me"] = name.strip()
                st.rerun()

if not me:
    st.title("Welcome to the Family Book Club 🎉")
    st.write("Add yourself in the sidebar (tap **›** at the top-left on a phone/iPad) to get started.")
    st.stop()


tab_now, tab_queue, tab_shelf = st.tabs(["📖 Now Reading", "📚 Up Next", "🏆 Bookshelf"])


# --- now reading -------------------------------------------------------------

with tab_now:
    current = db.books("current")
    if not current:
        st.info("Nothing on the nightstand yet! Pick a winner from **Up Next** to start reading.")
    for book in current:
        left, right = st.columns([1, 3])
        with left:
            cover(book)
        with right:
            st.subheader(book["title"])
            st.caption(f"by {book['author'] or 'unknown'} · started {when(book['started_at'])}")

        st.markdown("##### How far along is everyone?")
        for p in db.progress(book["id"]):
            if p["member_id"] == me["id"]:
                new = st.slider(f"{me['emoji']} You", 0, 100, p["percent"], step=5,
                                format="%d%%", key=f"prog-{book['id']}")
                if new != p["percent"]:
                    db.set_progress(book["id"], me["id"], new)
            else:
                st.progress(p["percent"] / 100, text=f"{p['emoji']} {p['name']} — {p['percent']}%")

        st.markdown("##### Thoughts, questions & quotes")
        with st.expander("✏️ Add something", expanded=False):
            with st.form(f"note-{book['id']}", clear_on_submit=True):
                kind = st.radio("What is it?", list(KINDS), format_func=KINDS.get, horizontal=True)
                chapter = st.text_input("Chapter / page (optional)", placeholder="e.g. Ch. 4 or p. 112")
                body = st.text_area("Your note")
                spoiler = st.checkbox("🙈 Spoiler — hide it until people tap to reveal")
                if st.form_submit_button("Post") and body.strip():
                    db.add_note(book["id"], me["id"], kind, chapter, body, spoiler)
                    st.rerun()

        filt = st.segmented_control("Show", ["all"] + list(KINDS), default="all",
                                    format_func=lambda k: "All" if k == "all" else KINDS[k],
                                    key=f"filter-{book['id']}")
        notes = db.notes(book["id"], None if filt in (None, "all") else filt)
        if not notes:
            st.caption("No notes yet — be the first!")
        for n in notes:
            with st.container(border=True):
                where = f" · {n['chapter']}" if n["chapter"] else ""
                st.markdown(f"{KINDS[n['kind']]} from {who(n)}  \n"
                            f"<small>{when(n['created_at'])}{where}</small>", unsafe_allow_html=True)
                if n["spoiler"]:
                    with st.expander("🙈 Spoiler — tap to reveal"):
                        st.write(n["body"])
                elif n["kind"] == "quote":
                    st.markdown(f"> *{n['body']}*")
                else:
                    st.write(n["body"])

                for r in db.replies(n["id"]):
                    st.markdown(f"&nbsp;&nbsp;↳ {who(r)}: {r['body']}")
                c1, c2 = st.columns([5, 1])
                with c1:
                    with st.form(f"reply-{n['id']}", clear_on_submit=True, border=False):
                        reply = st.text_input("Reply", label_visibility="collapsed", placeholder="Reply…")
                        if st.form_submit_button("Reply") and reply.strip():
                            db.add_reply(n["id"], me["id"], reply)
                            st.rerun()
                with c2:
                    if n["member_id"] == me["id"] and st.button("🗑️", key=f"del-{n['id']}", help="Delete"):
                        db.delete_note(n["id"])
                        st.rerun()

        st.divider()
        if st.button("🎉 We finished it!", key=f"finish-{book['id']}", type="primary"):
            db.set_status(book["id"], "finished")
            st.balloons()
            st.rerun()


# --- queue -------------------------------------------------------------------

with tab_queue:
    st.subheader("Suggest a book")
    q = st.text_input("Search for a title or author", placeholder="e.g. Lonesome Dove")
    picked = None
    if q:
        results = search_open_library(q)
        if not results:
            st.caption("Couldn't find it online — you can still add it by hand below.")
        for i, r in enumerate(results):
            c1, c2, c3 = st.columns([1, 4, 2])
            with c1:
                cover(r, width=50)
            with c2:
                year = f"({r['year']})" if r["year"] else ""
                st.markdown(f"**{r['title']}**  \n{r['author']} {year}")
            with c3:
                if st.button("Pick this", key=f"pick-{i}"):
                    st.session_state["picked"] = r
        picked = st.session_state.get("picked")

    with st.form("suggest", clear_on_submit=True):
        title = st.text_input("Title", value=picked["title"] if picked else "")
        author = st.text_input("Author", value=picked["author"] if picked else "")
        pitch = st.text_area("Your pitch — why should we read it?", placeholder="Optional")
        if st.form_submit_button("Add to the queue") and title.strip():
            db.add_book(title, author, picked["cover_url"] if picked else None, pitch, me["id"])
            st.session_state.pop("picked", None)
            st.rerun()

    st.divider()
    st.subheader("Up next (most votes first)")
    queue = db.books("queue")
    if not queue:
        st.caption("The queue is empty. Suggest something above!")
    for book in queue:
        with st.container(border=True):
            c1, c2 = st.columns([1, 4])
            with c1:
                cover(book, width=70)
            with c2:
                st.markdown(f"**{book['title']}**  \n{book['author'] or ''}")
                st.caption(f"suggested by {book['suggested_by_emoji']} {book['suggested_by_name']}")
                if book["pitch"]:
                    st.write(f"“{book['pitch']}”")
                vs = db.voters(book["id"])
                voted = any(v["id"] == me["id"] for v in vs)
                st.caption("👍 " + (" ".join(v["emoji"] for v in vs) if vs else "no votes yet"))
                b1, b2, b3 = st.columns(3)
                if b1.button("Unvote" if voted else "👍 Vote", key=f"vote-{book['id']}"):
                    db.toggle_vote(book["id"], me["id"])
                    st.rerun()
                if b2.button("📖 Start it", key=f"start-{book['id']}"):
                    db.set_status(book["id"], "current")
                    st.rerun()
                if b3.button("🗑️ Remove", key=f"rm-{book['id']}"):
                    db.delete_book(book["id"])
                    st.rerun()


# --- bookshelf ---------------------------------------------------------------

with tab_shelf:
    finished = db.books("finished")
    if not finished:
        st.info("Books you finish together will live here, with everyone's ratings. 🏆")
    for book in finished:
        rs = db.ratings(book["id"])
        avg = sum(r["stars"] for r in rs) / len(rs) if rs else None
        with st.container(border=True):
            c1, c2 = st.columns([1, 4])
            with c1:
                cover(book, width=70)
            with c2:
                st.markdown(f"**{book['title']}**  \n{book['author'] or ''}")
                st.caption(f"finished {when(book['finished_at'])}"
                           + (f" · {'⭐' * round(avg)} ({avg:.1f})" if avg else ""))
                for r in rs:
                    st.markdown(f"{who(r)} {'⭐' * r['stars']}" + (f" — {r['review']}" if r["review"] else ""))
                mine = next((r for r in rs if r["member_id"] == me["id"]), None)
                with st.expander("Edit my rating" if mine else "⭐ Rate it"):
                    with st.form(f"rate-{book['id']}"):
                        stars = st.feedback("stars", key=f"stars-{book['id']}")
                        review = st.text_input("One-line review", value=mine["review"] if mine else "")
                        if st.form_submit_button("Save") and stars is not None:
                            db.rate(book["id"], me["id"], stars + 1, review)
                            st.rerun()
