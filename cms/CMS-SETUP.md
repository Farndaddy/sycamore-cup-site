# Sycamore Cup Classic — Sheet CMS Setup

One-time setup, about 10 minutes. After this, updating the site is just: edit cells → click **Sycamore Cup Site ▸ Publish to Site**.

## What you're setting up

```
Google Sheet (you edit)  →  Apps Script (bound to the sheet)  →  GitHub repo  →  live site rebuilds
```

Nothing runs automatically in the background — per your call, it only publishes when you click the button. That also means half-finished edits never accidentally go live.

---

## Step 1 — Get the workbook into Google Sheets

1. Upload **`SycamoreCup-CMS.xlsx`** to your Google Drive.
2. Right-click it in Drive → **Open with ▸ Google Sheets**. Google will open it directly as a Sheet (or use File ▸ Save as Google Sheets once it's open) — either way you end up with a native Google Sheet with all six tabs intact.
3. Rename the file to whatever you like (e.g. "Sycamore Cup CMS").

## Step 2 — Add the publish script

1. In that Sheet: **Extensions ▸ Apps Script**. A new tab opens with a code editor.
2. Delete whatever's in the default `Code.gs` file, and paste in the entire contents of **`Code.gs`** (included alongside this guide).
3. Click the disk/save icon, name the project something like "Sycamore Cup Publisher."

## Step 3 — Create a GitHub token (the one manual security step)

This lets the script commit to your repo on your behalf. It only takes a minute, and you only do it once.

1. Go to **github.com ▸ Settings ▸ Developer settings ▸ Personal access tokens ▸ Fine-grained tokens ▸ Generate new token**.
2. Give it a name like "Sycamore Cup Sheet CMS."
3. **Repository access:** choose "Only select repositories" and pick your Sycamore Cup repo. Don't grant it access to anything else.
4. **Permissions:** under "Repository permissions," set **Contents: Read and write**. Leave everything else as "No access."
5. Generate the token and **copy it immediately** — GitHub only shows it once.

## Step 4 — Store the token in the script (not in the Sheet)

Keeping it out of the spreadsheet means it's never visible to anyone you share the Sheet with.

1. Back in the Apps Script editor: click the gear icon (**Project Settings**) in the left sidebar.
2. Scroll to **Script Properties ▸ Add script property**.
3. Property: `GITHUB_TOKEN` — Value: paste the token from Step 3. Save.

## Step 5 — Fill in the Config tab

Back in the Sheet, open the **Config** tab and fill in:
- GitHub repo owner (your GitHub username or org)
- GitHub repo name
- Branch (`main`, unless you use something else)
- Data file path (`data/sycamore-data.json` — leave as-is unless you've restructured the repo)

## Step 6 — First run (Google will ask permission)

1. Refresh the Google Sheet tab (reload the page) so the new custom menu appears.
2. You'll see a new menu: **Sycamore Cup Site**. Click it ▸ **Publish to Site**.
3. Google will show an authorization prompt — this is normal for any personal script. Click through: **Continue ▸ pick your account ▸ Advanced ▸ Go to [project name] (unsafe)** ▸ **Allow**. ("Unsafe" here just means Google hasn't manually reviewed this personal script — it's only calling GitHub's API with your own token, nothing else.)
4. It should now run for real and show **"Published! ✅"** with a link to the commit.

Check your GitHub repo — you should see a new commit updating `data/sycamore-data.json`, and the live site will reflect it within a minute or two (GitHub Pages rebuild time).

---

## Using it day to day

- Edit any yellow cell in **Rosters**, **FunFacts**, **Schedule**, or **Years**.
- When you're happy with your changes: **Sycamore Cup Site ▸ Publish to Site**.
- Want to sanity-check first? **Sycamore Cup Site ▸ Preview JSON (no publish)** shows you what would be sent, without committing anything.

## Adding new rows

- **New player on a roster:** add a row to **Rosters** with their info. Add matching rows to **FunFacts** if they have bio facts for that year.
- **New year:** add a row to **Years**, then rows to **Rosters** for that year's teams/players. Note: the actual mini-site page (`years/2026.html`) still needs to be created/adjusted separately — the Sheet only manages the *data*, not new page templates. Ask Claude when you're ready to spin up a new year's page.

## If something goes wrong

- **"No GitHub token found"** → redo Step 4; the property name must be exactly `GITHUB_TOKEN`.
- **"GitHub commit failed (401)"** → token is invalid/expired or doesn't have Contents: Read/write — regenerate it (Step 3).
- **"GitHub commit failed (404)"** → check the Config tab: repo owner/name/branch/path need to exactly match your GitHub repo.
- **Data looks wrong on the site after publishing** → use "Preview JSON" first next time; it's the fastest way to catch a typo'd column before it goes live.
