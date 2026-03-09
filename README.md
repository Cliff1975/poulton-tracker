# Poulton Consultancy – Payment Tracker

A self-hosted payment tracking app for school trips, built for Render.

## Deploy to Render (step by step)

### 1. Create a GitHub repository
1. Go to github.com → New repository → name it `poulton-tracker`
2. Upload all files keeping the same folder structure:
   ```
   poulton-tracker/
   ├── server.js
   ├── package.json
   ├── public/
   │   └── index.html
   └── data/           ← created automatically if missing
   ```

### 2. Create the Web Service on Render
1. Log in to render.com
2. New → Web Service
3. Connect your GitHub repo
4. Settings:
   - **Name:** poulton-tracker (or anything you like)
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** your existing paid plan

### 3. Add Environment Variables (Render → Service → Environment)
| Key | Value | Notes |
|-----|-------|-------|
| `ADMIN_PIN` | `your-secret-pin` | Your PIN – keep private |
| `TEACHER_PIN` | `teacher-pin` | Share this with the school |
| `DATA_DIR` | `/var/data` | Only if you add a persistent disk (see below) |

### 4. Add a Persistent Disk (IMPORTANT – prevents data loss on redeploy)
1. Render Dashboard → your service → Disks → Add Disk
2. Mount path: `/var/data`
3. Size: 1 GB (minimum, costs ~$0.25/month)
4. Add environment variable: `DATA_DIR=/var/data`

Without the disk, data resets every time you redeploy. With the disk, data is permanent.

### 5. Deploy
Click "Manual Deploy" or push to GitHub. Render builds and starts automatically.

Your URL will be: `https://poulton-tracker.onrender.com` (or your custom domain)

---

## Sharing with the school

- **Your admin URL:** `https://your-app.onrender.com` → enter your ADMIN_PIN
- **Teacher URL:** same URL → enter the TEACHER_PIN
  - Teacher view shows only "Match Students" – they fill in student names only
  - Teachers cannot edit amounts, statuses, or settings

---

## Updating data

Everything updates live via the server. Any device that opens the URL sees the same data instantly – no manual uploads needed.

---

## Stripe CSV Import

1. Stripe Dashboard → Payments → select date range → Export → CSV
2. Open the tracker → Payments tab → Import CSV
3. Paste CSV content → Preview → Import
4. Duplicate Stripe IDs are automatically skipped

---

## Local development

```bash
npm install
ADMIN_PIN=1234 TEACHER_PIN=5678 node server.js
# Open http://localhost:3000
```
