# 📚 Family Book Club

A cozy little Streamlit app for our family book club.

## What it does
- **Who's reading?** Pick yourself from the sidebar, or join with a name and a reading-buddy emoji. There are no passwords; it's just family.
- **📖 Now Reading:** each person's progress slider, plus thoughts, discussion questions and favorite quotes. You can tag a chapter, hide spoilers behind a tap, and reply to each other.
- **📚 Up Next:** search Open Library to suggest a book (the cover is pulled in automatically), add a pitch, and vote. The book with the most votes rises to the top.
- **🏆 Bookshelf:** finished books with everyone's star ratings and one-line reviews.

## Deploy from an iPad (Streamlit Community Cloud, free)
1. Go to https://share.streamlit.io and sign in with GitHub (99dean).
2. Tap **Create app**, then **Deploy a public app from GitHub**.
3. Repo: `99dean/book-club`, branch: whichever one you want, main file: `app.py`.
4. Deploy, then share the URL with the family.

> ⚠️ **Prototype storage:** data lives in a local SQLite file (`data/bookclub.db`).
> Streamlit Cloud wipes it whenever the app restarts or goes to sleep, so before
> real use we'll swap in a persistent backend (Google Sheets, Supabase, etc.).

## Run locally
```bash
pip install -r requirements.txt
streamlit run app.py
```
