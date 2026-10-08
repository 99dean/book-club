# The Book Club

A private book club app for Joe, Jen, Dean and Alec (with Alexa and Kyleigh as optional guests).
It installs on any phone from the browser (Share → Add to Home Screen) and opens full screen like an app.

## What's in it

- **Birthday surprise:** the first time Joe opens it, he gets a note from Dean and picks book #1.
- **Reading:** the current book, the next FaceTime (shown in DC/Philly *and* London time), and **Standings**,
  a race where everyone reading has a lane, with a dashed line marking the meetup goal. Anyone can sit a book out.
- **Torn out for you:** send one person a passage with a note, a nod to Joe tearing pages out for Jen.
  If they're not that far yet, it stays folded until they catch up.
- **Talk:** questions, thoughts and quotes, with replies. Posts written further into the book than you are stay
  hidden until you tap.
- **Up next:** suggest books (covers via Open Library), pitch them, and vote.
- **Shelf:** finished books with everyone's stars and one-line reviews.
- **Get a copy** links on every book: Libby (set your library in Settings), Audible (UK store for London), Libro.fm and Bookshop.
- Light/dark follows the phone. Notification preferences are saved; push notifications come in the next update.

## How it's built

Plain HTML/CSS/JavaScript with no build step, so it can be edited and deployed from an iPad.

| Path | What it is |
| --- | --- |
| `index.html`, `app.css` | Page shell and the glass look |
| `js/app.js` | App state and actions |
| `js/screens.js`, `js/sheets.js`, `js/ui.js` | Screens, pop-up sheets, small components |
| `js/store.js` | Data layer: demo mode (this device only) or Supabase (shared, live) |
| `js/config.js` | Supabase URL + public key; leave empty for demo mode |
| `supabase/schema.sql` | Database tables, privacy rules and starting data |
| `vendor/` | Preact + htm and supabase-js, bundled so nothing depends on a CDN |
| `sw.js`, `manifest.webmanifest`, `icons/` | Makes it installable and work offline |

## Setup

### 1. Database (Supabase, free)

1. Go to [supabase.com](https://supabase.com), sign in with GitHub, and create a new project.
2. **SQL Editor → New query**: paste all of `supabase/schema.sql`, change the family code on the
   line marked `FAMILY CODE`, then **Run**.
3. **Authentication → Sign In / Providers**: turn on **Allow anonymous sign-ins**.
4. **Project Settings → API**: copy the **Project URL** and the **anon public** key into `js/config.js`.
   The anon key is meant to be public; the family code is what keeps everyone else out.

### 2. Hosting

Any static host works. Because the repo is private, the free options are:

- **Netlify or Cloudflare Pages:** connect the GitHub repo and deploy the branch. No build command, publish directory `/`.
- **GitHub Pages:** free if the repo is public (or on GitHub Pro). Settings → Pages → deploy from branch, folder `/`.

### 3. Invite the family

Send each person the link with the code attached, e.g. `https://your-site/?code=your-family-code`.
They open it in Safari, tap Share → **Add to Home Screen**, then tap their name.
Send Joe's link last, so the surprise is waiting for him.

## Demo mode

With `js/config.js` left empty, the app runs entirely on one device with the starting data, which is good for trying it out.
Settings → **Reset demo data** starts over. Settings → **Preview the birthday surprise** shows Joe's screen without using it up.

To run locally: `python3 -m http.server` in this folder, then open http://localhost:8000.
