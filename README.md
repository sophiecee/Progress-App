# Observation Log

A private web app for recording a child's developmental skills and sharing them with his therapy team.

Built because the EHCP requires a diary of new achievements, and the therapy teams only see him at nursery — so they miss what happens at home. Two parents log observations; the professionals read them; the record is exported once a term.

Live at: `https://sophiecee.github.io/<repo-name>/`

---

## What it does

**The review sweep** is the core of it. Pick a date, work down the list of skills still in active review, tap one verdict per skill. Every verdict is appended to that skill's history with the date, the time it was logged, who logged it, and an optional note. History is only ever added to — never edited, never overwritten.

**Three consecutive "still there" verdicts retire a skill** from active review. It stops appearing in the sweep and shows as Achieved. A "lost" or "patchy" verdict resets the streak to zero and keeps the skill in review, so regressions can't be quietly buried. The threshold is three by default and can be changed in Settings.

**Each discipline judges a skill separately.** A skill can belong to several disciplines, and each one gets its own streak, status, retirement and history. So the OT can be satisfied with the grip on a piece of fruit while SLT still records the chewing as lost. In the sweep this shows as one card per discipline, marked "shared skill".

**Verdicts:**

| Verdict | Effect |
|---|---|
| Still there | +1 to the streak. At the threshold, the skill retires. |
| Patchy | Streak back to zero, stays in review. |
| Lost | Streak back to zero, stays in review. |
| Skip | Recorded in the history. Streak and status untouched. |

"Not yet reviewed" is not a verdict. It is the state a skill sits in before its first review. Use Skip to deliberately pass over something during a sweep.

---

## Who can do what

Two roles, set by the `role` column in the `profiles` table.

- **parent** — full read and write. You and your partner.
- **professional** — read only, across all disciplines, with filter and sort by discipline.

Read-only means read-only at the database level, not just hidden buttons. A professional account cannot log a verdict, add a skill, or archive anything even if it bypassed the app and called the API directly. Nobody can change their own role; that requires Supabase dashboard access.

Current team: SLT–dysphagia ×1, SLT–communication ×3, dietetics ×1, OT ×1, physio ×1, teacher of the deaf ×1. The teacher of the deaf has no discipline of their own — skills relevant to them sit under SLT–communication.

Settings shows each account's last sign-in. That records that someone signed in, not what they read; per-record audit logs are a paid Supabase feature.

---

## Nothing is unrecoverable

- **Typo in a skill name or description** — tap the skill, then Edit.
- **Skill created by mistake, or a duplicate** — tap the skill, then Archive. It leaves the sweep, the lists and the export. Find it again under the Archived filter in Skills and tap Restore. Nothing is deleted and the history comes back with it.
- **Wrong verdict logged** — log a corrected one on top. The original stays visible in the history, which is deliberate: an amended record is more trustworthy than a rewritten one.
- **Discipline removed from a skill** — the old entries are archived, not deleted, and reappear if you add the discipline back.
- **Retired skill needs looking at again** — open it and tap Reopen on that discipline. Retired skills never re-enter review on their own.

The only genuinely permanent action is deleting rows directly in the Supabase dashboard. Avoid that.

---

## Offline

Every write saves to the phone first and queues for the database. A banner shows how many changes are waiting; Settings has a Retry now button. Nothing is dropped silently — if a write is rejected, it stays in the queue and the error panel says why.

Two caveats:

- **Photos need a connection.** They are too large to hold in the device queue. Text entries always save offline.
- **A completely cold start needs a connection.** The app loads React and Tailwind from a CDN, so if the browser hasn't cached them and there's no signal, the page won't render. Once loaded, it works offline. Adding a service worker would fix this properly and is a sensible future change.

---

## Media

**Photos** upload to a private Supabase bucket and display via signed URLs that expire after an hour. There is no public address for them. They appear in the printed export.

**Videos are links, not uploads** — the free tier caps a single file at 50 MB, which a phone clip exceeds immediately. Put the clip in OneDrive, share it to each professional's work email address specifically (not "anyone with the link"), and paste the link into the app. OneDrive was chosen over Google Drive because the team all have Microsoft accounts through work, so nobody has to create a new account.

Keep photos and videos to clinical detail — grip, posture, position, a feeding session. Nothing showing him undressed, bathing or being changed, regardless of who has access.

Entries should be anonymised: Kid 1, Mum, Dad, nursery. Settings has a list of real names to watch for, held **on that device only and never uploaded**; the app warns you if one appears in an entry.

---

## Export

Export tab. Pick a date range and either one discipline or all of them combined, then Build and print and choose "Save as PDF" in the phone's print dialogue. A single discipline gets only its own verdicts, so each therapist sees just their thread. Archived skills are excluded.

**This export is also the backup.** See below.

---

## Backups — read this

The free Supabase tier has **no automated backups**. There is no restore point if data is lost.

1. **Run the export at the end of every term and keep the PDF somewhere durable** — OneDrive, email to yourself, anywhere that isn't only this app. That is the archive that actually matters for the EHCP.
2. **Free projects pause after 7 days of no activity.** Paused is resumable from the Supabase dashboard, not lost, but don't leave it paused and unattended for months.
3. For a full data dump, Supabase dashboard → Table Editor → each table → Export as CSV.

---

## Secrets

- **No password is in this repo.** Supabase Auth stores them hashed on its own servers. The app never sees a password; it exchanges credentials for a short-lived token.
- The Supabase URL and key at the top of `index.html` are **meant** to be public. The key must be the publishable one, starting `sb_publishable_`. If a key starting `sb_secret_` or a `service_role` key ever ends up in this file it bypasses every access policy and must be rotated immediately in the Supabase dashboard.
- Everything that actually protects the data is in the Row Level Security policies, not in keeping the code secret.

---

## Adding an account

1. Supabase dashboard → Authentication → Users → Add user. Set an email and a temporary password; the person can reset it themselves from the sign-in screen.
2. Then run this, changing the email, name and role. `parent` for a parent, `professional` for everyone else.

```sql
insert into profiles (id, email, display_name, role)
select id, email, 'Their Name', 'professional'
from auth.users
where email = 'them@example.com';
select (1)
```

Until that row exists, the account can sign in but the app will say it can't tell whether they're a parent or a professional.

---

## Database

Five tables, all with Row Level Security on.

- **profiles** — one row per account: role, display name, last sign-in.
- **skills** — the skill itself: name, description, date first observed, `is_archived`.
- **skill_tracks** — one row per skill per discipline. Holds that discipline's status, streak and retirement. This is why disciplines are judged independently.
- **reviews** — the append-only history. One row per verdict, carrying the skill, the discipline, the date observed, the note, and who logged it. **There is deliberately no update or delete policy on this table**, so history cannot be rewritten by anyone, including you, including through the dashboard API.
- **media** — photos (bucket path) and video links, attached to a skill.
- **app_settings** — one row, holding the retirement threshold.

Plus a `storage` bucket called `observations`, private.

A helper function `is_parent()` reads the signed-in user's role. Write policies check it. It's `security definer` so that reading `profiles` from inside a policy doesn't recurse.

---

## Working on this from a phone

- The whole app is one file, `index.html`. There is no build step. To update it: delete the old file in GitHub and upload the new one. Don't try to edit lines in the GitHub mobile editor — deleting and pasting is unreliable there.
- The file must be named `index.html` before uploading. Renaming afterwards in the mobile interface is painful.
- **The Supabase SQL editor on mobile adds a stray closing bracket** to the end of pasted SQL, which produces `ERROR: 42601 syntax error at or near ")"`. The fix is to end every block with `select (1)` on its own line — the stray bracket then closes it harmlessly and the query returns `1`. Every SQL block in this file already has it.
- Run SQL one block at a time, in order.
- If the app breaks, a red panel appears at the bottom of the screen with the exact failure. Screenshot or copy that — it's the thing worth pasting to whoever is helping.

---

## Stack

Single-file HTML. React 18 and Tailwind via CDN, Babel standalone compiling in the browser, Supabase for database, auth and storage, GitHub Pages for hosting. Icons are drawn inline so they work with no network. No build step, no package manager, no dependencies to install.

The repo is public, which GitHub Pages requires on the free tier. That's fine: the repo contains code, not data, and no secrets. Keep it that way — no real names, no photos, no notes committed to the repo.

---

## Possible future changes

- **Service worker** so a cold start works with no signal. The biggest real improvement available.
- **Write access for the team.** Nothing in the design prevents it: add insert permission for the professional role on `reviews`, and the verdict buttons appear. The decision to make first is whether nursery gets one shared account or one per member of staff — a shared iPad login weakens the record of who wrote what.
- **A discipline of their own for the teacher of the deaf**, if they want one.
