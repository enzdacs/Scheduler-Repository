# Aurora — Calendar + Notes + AI Assistant

Glass/iOS-styled calendar app. Vanilla HTML/CSS/JS (no build step) + FullCalendar +
Firebase (Auth + Firestore) + Gemini AI (via a Netlify Function so the API key
stays server-side) + Netlify Functions + Netlify hosting.

```
calendar-ai-app/
├── index.html
├── css/styles.css
├── js/
│   ├── firebase-config.js   ← put your Firebase config here
│   ├── auth.js               (email/password + Google sign-in)
│   ├── calendar.js           (FullCalendar + Firestore CRUD for events)
│   ├── notes.js               (Firestore CRUD for notes)
│   ├── chatbot.js             (calls the Gemini proxy function)
│   └── app.js                 (wires everything together)
├── netlify/functions/chat.js  ← Gemini proxy (server-side API key)
├── netlify.toml
├── package.json
├── firestore.rules
└── .gitignore
```

## 1. Firebase setup (Auth + Database)

1. Go to https://console.firebase.google.com → **Add project**.
2. **Build → Authentication → Get started**. Enable:
   - **Email/Password**
   - **Google** (set a support email)
3. **Build → Firestore Database → Create database** → start in **production mode**
   (rules are provided below), pick a region.
4. **Project settings (gear icon) → General → Your apps → Web (</>)**. Register
   an app (no hosting needed) and copy the `firebaseConfig` object.
5. Paste those values into `js/firebase-config.js`:
   ```js
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
6. Deploy the security rules in `firestore.rules` (Firestore → Rules tab → paste
   the file's contents → Publish). They restrict every document to
   `users/{yourUid}/...` so each user only ever sees their own events/notes.
7. **Authentication → Settings → Authorized domains**: add your Netlify domain
   once you have it (e.g. `your-site.netlify.app`) — required for Google sign-in.

Data model (auto-created on first write, nothing to do manually):
```
users/{uid}/events/{eventId}  → title, start, end, allDay, category, description, timestamps
users/{uid}/notes/{noteId}    → title, content, timestamps
```

## 2. Gemini API key

1. Get a key at https://aistudio.google.com/app/apikey.
2. **Do not** put it in the frontend. It's read server-side only, inside
   `netlify/functions/chat.js`, from the `GEMINI_API_KEY` environment variable
   (set in Netlify — step 4 below).

## 3. Run locally (optional but recommended)

```bash
npm install -g netlify-cli
cd calendar-ai-app
netlify dev
```
`netlify dev` serves the static site **and** runs the Netlify Function locally
(so `/.netlify/functions/chat` works). Create a `.env` file for local testing:
```
GEMINI_API_KEY=your_key_here
```

## 4. Deploy to Netlify

**Option A — Git-based (recommended, auto-deploys on push):**
1. Push this folder to a new GitHub repo.
2. Netlify → **Add new site → Import an existing project** → pick the repo.
3. Build settings: build command empty/`echo`, publish directory `.` (already
   set in `netlify.toml`, so you can accept the defaults).
4. **Site configuration → Environment variables** → add
   `GEMINI_API_KEY = <your key>`.
5. Deploy. Copy the resulting URL (e.g. `https://aurora-calendar.netlify.app`).
6. Add that domain to Firebase **Authentication → Settings → Authorized domains**.

**Option B — Drag & drop (quick, manual redeploys):**
1. Netlify → **Add new site → Deploy manually** → drag the whole
   `calendar-ai-app` folder in.
2. Still add `GEMINI_API_KEY` under Site configuration → Environment variables,
   then trigger a redeploy (Netlify Functions need the env var present at
   deploy time).
3. Add the Netlify domain to Firebase's authorized domains as in step 6 above.

That's it — no bundler, no npm build, Functions deploy automatically from
`netlify/functions/`.

## Features

- **Calendar**: month/week/day/agenda views, drag-to-move, resize, click-to-create,
  category color coding, live search, category filters, mini month picker.
- **Notes**: realtime, searchable notepad synced to Firestore.
- **AI Assistant**: chat panel backed by Gemini. It can read your upcoming events
  and reply with a structured action (create/update/delete event) that the app
  executes automatically, e.g. *"Move my dentist appointment to Friday 4pm."*
- **Auth**: email/password + Google sign-in, per-user data isolation via
  Firestore rules.
- **Design**: iOS-style frosted glass panels, animated sheets/modals, responsive
  down to mobile with a floating glass dock nav.

## Notes on the AI action protocol

`netlify/functions/chat.js` instructs Gemini to always return JSON:
```json
{ "reply": "...", "actions": [ { "type": "create_event", "title": "...", "start": "...", "end": "...", "category": "..." } ] }
```
`js/chatbot.js` parses this and calls the matching Firestore CRUD helper in
`js/calendar.js` (`aiCreateEvent` / `aiUpdateEvent` / `aiDeleteEvent`), so the
calendar UI updates instantly via the existing realtime listener — no page
reload, no separate sync logic.
