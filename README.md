# Skill Chronicle

A private web app for recording a child's developmental skills and sharing them with his therapy team.

Built because the EHCP requires a diary of new achievements, and the therapy teams only see him at nursery — so they miss what happens at home. Parents and nursery log what he does; the professionals read it; the record is exported once a term.

Live at: `https://sophiecee.github.io/<repo-name>/`

---

## What it does

**One entry per skill, when it was first seen.** Each skill records:

- what he did, in plain words
- the date it was first seen, who saw it, and where
- which therapy areas it matters to (tags — as many as apply)
- which group it sits in (Understanding, Makaton and gestures, Moving and walking…)
- photos and video links
- a running thread of dated comments underneath

**Comments** are how a skill's story continues: "seen again at nursery", "seems consolidated now", "not seen for a fortnight". Each one is stamped with who wrote it and when.

There are no verdicts, streaks or "achieved" states any more. Until November 2026 the app used a review sweep with "still there / patchy / lost" verdicts and retired a skill after several in a row. That proved confusing for nursery, so it was replaced by the simpler model above. Every old verdict was converted into a dated comment on its skill (for example *"Still there (OT, SLT communication): sounding more like moh"*), so no history was lost. The original `reviews` table is still in the database, untouched.

**Groups** are headings in the Skills list, each with a count, and fold away with a tap. A skill with no group sits under **Other**. Groups are shared by everyone and live in the database. Only parents can create, rename, reorder or delete them (Settings). Deleting a group moves its skills to Other.

**Therapy areas** are tags, separate from groups. Filter the Skills list by area, or export a single area, and only the skills tagged for it appear — still under their groups.

---

## Who can do what

Three roles, set by the `role` column in the `profiles` table.

| Role | Can |
|---|---|
| **parent** | Everything: add, edit, archive, merge, manage groups, edit any comment. |
| **contributor** (nursery) | Add skills, comments, photos and video links. Edit their **own** comments. Cannot edit skills, archive, merge, manage groups, or touch anyone else's comments. |
| **professional** | Read only, across all areas. |

These limits are enforced by the database, not just by hiding buttons. A contributor or professional account cannot get round them by calling the API directly. Nobody can change their own role.

Current team: SLT–dysphagia ×1, SLT–communication ×3, dietetics ×1, OT ×1, physio ×1, teacher of the deaf ×1. The teacher of the deaf has no area of their own — skills relevant to them are tagged SLT–communication.

Settings shows each account's last sign-in. That records that someone signed in, not what they read.

---

## Nothing is unrecoverable

- **Typo in a skill** — open it, Edit (parents).
- **Duplicate skill** — open it, Merge into…, pick the original. Its comments, photos, links and therapy areas move across and the duplicate is archived, not deleted.
- **Skill added by mistake** — Archive. It leaves the lists and the export; find it under the Archived filter and Restore.
- **Wrong comment** — Edit it. Comments cannot be deleted by anyone in the app. The edit shows "Edited [date]", and a tap reveals the earlier wording, when it was replaced and by whom.
- **Therapy area removed by mistake** — add it back in Edit; the skill comes straight back into that area.

The only permanent action is deleting rows in the Supabase dashboard. Avoid it except for the case at the end of this file.

---

## Offline

Every write saves to the phone first and queues for the database. A banner shows how many changes are waiting; Settings has Retry now. If a write is rejected it stays queued and the red error panel says why.

The app also **opens with no signal at all**, even from a cold start, thanks to `sw.js` (a "service worker") sitting next to `index.html`:

- The page itself is always fetched fresh from the internet first, so a new version arrives as soon as it's uploaded. Only if there's no answer within about four seconds does the phone use its saved copy.
- React, Tailwind, Babel and the Supabase library are pinned versions, so the phone's saved copy is used.
- Database traffic is never intercepted.

If `sw.js` is missing from the repo, the app still works; it just needs signal for a cold start.

Typing is protected too. The add-skill form and the comment box save a draft on the phone as you type. If Android kills the tab while you're in another app, you're offered the text back when you return. Photos can't be kept in a draft and need re-adding.

**Photos need a connection** to upload. Text always saves offline.

---

## Media

**Photos** upload to the private `observations` bucket, stored as `<skill id>/<file>`. They display through signed links that expire after an hour. The storage rules look up which family the skill belongs to, so a photo is visible only to people in that family. It can be uploaded only by a parent or contributor of that family, onto one of that family's skills. Nobody can change or delete photos through the app.

**Videos are links, not uploads** — the free tier caps files at 50 MB. Put the clip in OneDrive, share it to each professional's work email specifically (not "anyone with the link"), and paste the link in. OneDrive because the team all have Microsoft accounts through work.

Keep photos and videos to clinical detail — grip, posture, position, a feeding session. Nothing showing him undressed, bathing or being changed.

Entries should be anonymised: Kid 1, Mum, Dad, nursery. Settings has a list of real names to watch for, held **on that device only and never uploaded**. The app warns if one appears in a skill or comment.

---

## Export

Export tab. Pick a date range and either every therapy area or one. **Build and print**, then "Save as PDF" in the print dialogue.

A skill is included if it was first seen in the range, or has a comment dated in the range; comments outside the range are left out. Skills appear under their group headings with counts, and a summary line at the top lists every group. Archived skills are excluded.

**This export is also the backup.** See below.

---

## Backups — read this

The free Supabase tier has **no automated backups**.

1. **Export at the end of every term and keep the PDF somewhere durable** — OneDrive, email to yourself. That is the archive that matters for the EHCP.
2. **Free projects pause after 7 days of no activity.** Resumable from the dashboard, but don't leave it paused for months.
3. For a full data dump: Supabase dashboard → Table Editor → each table → Export as CSV.

---

## Secrets

- **No password is in this repo.** Supabase Auth stores them hashed; the app only ever holds a short-lived token.
- The Supabase URL and key at the top of `index.html` are **meant** to be public. The key must be the publishable one (`sb_publishable_…`). If an `sb_secret_` or `service_role` key ever ends up in this file, rotate it immediately in the dashboard — it bypasses every rule.
- What protects the data is the Row Level Security rules in the database, not keeping the code secret.

---

## Adding an account

1. Supabase dashboard → Authentication → Users → Add user, with a temporary password (they can reset it from the sign-in screen).
2. Then run this, changing email, name and role (`parent`, `contributor` or `professional`). The family is copied from an existing parent.

```sql
insert into profiles (id, email, display_name, role, family_id)
select u.id, u.email, 'Their Name', 'professional',
  (select family_id from profiles where role = 'parent' limit 1)
from auth.users u
where u.email = 'them@example.com';
select (1)
```

The display name is what appears on their comments. For nursery, something like "Nursery" or "Nursery – key worker" keeps the record anonymised.

Until that row exists, the account can sign in but the app can't tell what it's allowed to do.

---

## Database

All tables have Row Level Security on, and every row carries a `family_id`; reading is limited to your own family.

- **profiles** — one row per account: role, display name, family, last sign-in.
- **skills** — name, description ("what you saw"), date first seen (`date_first_observed`), `seen_by`, `seen_where`, `group_id`, `is_archived`.
- **skill_tracks** — one row per skill per therapy area: these are the tags. (They once held streaks too; those columns are no longer used. The contributor rules were built around this table, which is why the tags still live here.) Removing an area archives its row rather than deleting it, and adding it back switches the same row on again.
- **skill_comments** — the comment threads. `history` keeps every earlier wording of an edited comment, with when and by whom. Family members can read; parents and contributors can add, always as themselves; you can edit your own, parents can edit any; **there is no delete rule**. `from_review` marks the comments converted from old verdicts.
- **skill_groups** — the shared group list, with its order. Parents only can change it.
- **media** — photos (bucket path) and video links. Parents can re-point one to another skill, which is what Merge uses.
- **reviews** — the old verdict history, kept as it was. Not read by the app any more. Parents can edit or delete rows (from the earlier Fix feature); nobody else can.
- **app_settings** — held the old retirement threshold. No longer used.

Helper functions, all `security definer` so policies can read `profiles` without recursion: `is_parent()`, `my_family()`, `sc_can_add()` (parent or contributor).

What `skill-chronicle-contributor.sql` adds, for the record:

- a trigger that stops anyone changing their own role from the app (the SQL editor still can)
- `is_contributor()` — parent or contributor; does the same job as `sc_can_add()`
- insert rules letting contributors add skills, therapy-area rows and media in their own family
- insert rules on `reviews` for contributors, and update rules on `skill_tracks` streak fields — both now unused, since the app no longer records verdicts; harmless
- a trigger on `skill_tracks` so only a parent can archive or switch back on a therapy area, move a row to another skill, or un-retire one
- an upload rule for the `observations` bucket (`contrib_add_photos`), which `skill-chronicle-photos.sql` removes and replaces with family-scoped rules, so the photo file must be run after it

It does **not** add `contributor` to the allowed roles on `profiles` (`profiles_role_check`); that was done separately. If ever rebuilding from scratch, that check constraint must allow `parent`, `contributor` and `professional` before a nursery profile can be created.

SQL files, in the order they were run: the original setup, the contributor file `skill-chronicle-contributor.sql`, then `skill-chronicle-v4.sql` (first seen, comments, groups, converting the reviews), then `skill-chronicle-photos.sql` (family-scoped photos). The last two are safe to run more than once.

---

## Working on this from a phone

- The app is `index.html` plus `sw.js`, side by side in the repo. No build step. To update: delete the old file in GitHub and upload the new one. Don't edit lines in the GitHub mobile editor.
- Name files correctly **before** uploading. Android may silently save a second download as `index(1).html`; check the name.
- After uploading, open the app with a new `?v=` number on **every** phone, so nobody keeps using an old copy.
- **Run any SQL before uploading the `index.html` that needs it.**
- **The Supabase SQL editor on mobile adds a stray closing bracket** to pasted SQL (`ERROR: 42601 syntax error at or near ")"`). Every SQL block ends with `select (1)` on its own line to absorb it.
- If the app breaks, a red panel at the bottom shows the exact failure. Screenshot it — that's what's worth pasting to whoever is helping.

---

## Stack

Single-file HTML. React 18 and Tailwind via CDN, Babel standalone compiling in the browser, Supabase for database, auth and storage, GitHub Pages for hosting, a small service worker for offline cold starts. Icons are drawn inline. No build step, no package manager.

The repo is public, which GitHub Pages requires on the free tier. Fine: it contains code, not data, and no secrets. Keep it that way — no real names, photos or notes in the repo.

---

## Possible future changes

- **Group suggestions from a small model on the Raspberry Pi.** An embedding model (around 100 MB, fits a 2 GB Pi alongside Home Assistant) compares new skills to examples in each group and writes suggestions to a table; a parent accepts or rejects each one in the app. The Pi only reaches out to Supabase, so it isn't exposed to the internet, and it would sign in as its own limited account — never the secret key.
- **A therapy area of their own for the teacher of the deaf**, if wanted.
- **Dropping the old `reviews` and `app_settings` tables** once everyone is happy the converted comments are right. Export a CSV of `reviews` first.

---

## Multi-device checklist (applied here)

The app is used by several people on separate phones against one backend, so the key question is: *what happens the first time two independent, already-diverged local states both try to become the source of truth?*

| State | Home | Why |
|---|---|---|
| Skills, tags, comments, media | Database | Per-record data, synced. |
| Groups and their order | Database (`skill_groups`) | Everyone must see the same list. Never stored as a device's own truth; the starting set was created by SQL, not by whichever phone opened first. |
| Old reviews → comments conversion | Database, once, by SQL | Done server-side so no phone's copy could decide the result. Safe to re-run; it won't duplicate. |
| Which group headings are folded | This device | A personal view preference, not shared data. |
| Names to watch for | **This device only, deliberately** | Real names must never be uploaded. |
| Drafts (skill form, comment box) | This device | Unsent typing, belongs to that phone until saved. |
| Supabase URL and key, write queue | This device | Per-device. |
| Demo sample data | This device (`obslog.demo.v2`) | Never touches the database. |

The local cache is a **mirror, never a source**. On every successful load it is replaced wholesale by the database copy, so a stale phone can't promote its old copy to truth. This was tested: a phone holding an out-of-date group list shows the database's list after loading.

Two people commenting on the same skill at once is not a conflict: both comments land. Two people *editing the same comment* at the same moment is the one case where the later save wins. The earlier wording still appears in that comment's history.

**When changing sync logic, test with both phones**, and ask what was actually tested for the two-device case.

---

## Sharing it with someone (demo mode)

The sign-in screen has **Try it with sample data**: a made-up child with groups, comments and a handful of skills, held only in that person's browser. No account, no database, photos off. A Reset button puts the sample back.

---

## If other families ever used this

Groundwork exists: every table has `family_id`, reads are scoped to your family, and photos are scoped by the family of the skill they belong to. New families get their own starting set of groups if `skill-chronicle-v4.sql` is re-run after their first parent profile exists.

The real question isn't technical. Holding another family's child's health data means being responsible for it: backups, access, and what happens if the project is lost or the free tier changes. Storage is a limit too (1 GB free), so photos might need to be off for other families. Worth a proper conversation first.

---

## Removing something that should not be there

If a real name ends up in a **comment**, edit it in the app — but the earlier wording stays in that comment's history. To remove it from the history too, a parent has to use SQL. Find it:

```sql
select id, created_at, author_name, body, history
from skill_comments
where body ilike '%the name%' or history::text ilike '%the name%';
select (1)
```

Then clear that comment's history (the current wording stays):

```sql
update skill_comments set history = '[]'::jsonb where id = 'the-id-here';
select (1)
```

The same applies to the old `reviews` table: `delete from reviews where id = '…';`.

If it's in a skill's name or description, just use Edit in the app. If it's in a photo caption, edit the `caption` in the `media` table in the dashboard.

That this needs dashboard access is deliberate: it should be hard, deliberate and rare.
