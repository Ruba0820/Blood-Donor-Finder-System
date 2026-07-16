# LifeDrop — Blood Donor Finder

Full-stack version of the LifeDrop site: the original frontend, now backed by a
Node.js + Express API and a MySQL database.

## Folder structure

```
lifedrop/
├── server.js            # Express app entry point
├── package.json
├── .env.example         # copy to .env and fill in your MySQL credentials
├── config/
│   └── db.js            # MySQL connection pool
├── routes/
│   ├── donors.js        # GET/POST/PATCH/PUT/DELETE /api/donors (search, registration, status, admin edit/delete)
│   ├── auth.js          # POST /api/auth/register, /api/auth/login
│   ├── admin.js         # GET /api/admin/verify
│   └── requests.js      # POST/GET /api/request-blood (saves to DB, no email)
├── sql/
│   └── schema.sql       # creates the database, tables (donors, users, blood_requests), and sample donors
└── public/
    ├── login.html        # opens first — User Login / Admin Login / Create New Login
    ├── login.js          # logic for login.html
    ├── index.html        # the main app (Home, Eligibility, Search, Admin, etc.) — gated behind login
    ├── main.js            # logic for index.html
    └── style.css         # shared styles for both pages
```

## Test Credentials (ready to use right away)

`sql/schema.sql` seeds one working login for each tab, so you can try both
without registering first:

| Tab           | Login with                          |
|----------------|--------------------------------------|
| **User Login** | Email: `arun@example.com` <br> Password: `Test@1234` |
| **Admin Login**| Key: `admin123` (the default in `.env.example` — change it before deploying anywhere public) |

## Login-First Access

The site now opens on a dedicated **`login.html`** page by default, with two tabs
plus a link to a third form:

- **User Login** — the usual email/password login (account created via
  Create New Login, below). Successful login goes to **`index.html`** (Home)
  and unlocks the regular pages (Eligibility, Search, Request Blood, etc.).
- **Admin Login** — just the `ADMIN_KEY` from `.env`. Successful login goes
  straight to `index.html` and lands on the **Admin** dashboard.
- **Create New Login** (a link on the User Login tab) — Name, Email, Password
  only, no donor details. This is the **only** way to create a login account.

`index.html` is gated: if you open it directly without an active session
(checked via `localStorage`/`sessionStorage`), its script immediately redirects
you back to `login.html`. Once logged in (as either a user or an admin), a
**Logout** link appears in the nav — it clears the session and sends you back
to `login.html`.

## Request Blood (saved to the database, no email)

There's a **Request Blood** page. Whoever needs blood fills in their name,
mobile, the city, and the blood group required (plus optional hospital and
message) and submits. The server:

1. Saves the request to the `blood_requests` table — no email is sent to anyone.
2. Replies back with how many currently-**active** donors match that city and
   blood group, so the requester knows whether to expect a response.

Admins can see every submitted request on the **Admin** dashboard, under
"Recent Blood Requests" (read-only — no edit/delete for these, just a log).

## Donor Active/Inactive Status

Donors aren't required to be available forever, so every donor row has an
`is_active` flag:

- **Donor Registration** now asks "Currently Active as a Donor?" (defaults to Yes).
- **Search a Donor** (the public page) only shows donors marked **Active**.
- **My Status** (nav link) lets any donor update their own status later —
  they enter the **mobile and email they registered with** (used together as
  a lightweight identity check, since there's no per-donor login session) and
  pick Active or Inactive.
- The **Admin** dashboard shows a Status badge for every donor and can flip
  it via the Edit modal, regardless of what the donor set themselves.

## How Accounts and Donor Records Work

These are two separate things now, on purpose:

1. **Create New Login** (link on the Login page) — Name, Email, Password.
   This is the only way to get a login account. Do this first, whether you
   plan to donate or just want to search/request blood.
2. **Donor Registration** (nav link, inside the app) — the full donor form
   (blood group, weight, address, etc.), no password. You reach this only
   after logging in, and it just saves your donor details against the
   account you're already logged in with.

Log in on the **User Login** tab of the Login page, using the email and
password you created via Create New Login.

If login says "Invalid credentials," the most likely reasons are:
- You're using a different email than the one you signed up with (mobile
  number won't work as the login — only email does).
- You haven't created an account yet — use **Create New Login** first.

## Admin Link Visibility

The **Admin** nav link is hidden by default — it only appears once someone
has logged in through the **Admin Login** tab (not the User Login tab). This
keeps it out of the way for regular donors/visitors, while still being one
click away for whoever knows the admin key.

## 1. Install prerequisites

- Node.js 18+ (https://nodejs.org)
- MySQL 8+ running locally or reachable over the network

## 2. Set up the database

```bash
mysql -u root -p < sql/schema.sql
```

This creates a `lifedrop` database with `donors`, `users`, and `blood_requests`
tables, plus a handful of sample donors so the Search page has data right away.

## 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set `DB_USER`, `DB_PASSWORD`, and `JWT_SECRET` to match your setup.

## 4. Install dependencies and run

```bash
npm install
npm start
```

The server serves both the API and the static frontend from the same origin, so
open:

```
http://localhost:3000
```

For development with auto-restart on file changes:

```bash
npm run dev
```

## Admin Dashboard

The **Admin** tab in the nav bar has:

- 📋 **View all donor registrations** — full table, not just the masked search results
- ✏ **Edit donor details** — opens a modal pre-filled with the donor's data, including Active/Inactive status
- 🗑 **Delete donor** — with a confirmation prompt
- 🔍 **Search donors** — by name (live, as you type), city, and blood group
- 📊 **Total donors count** — shown as a stat pill at the top
- 🩸 **Recent Blood Requests** — a read-only log of everything submitted via Request Blood

**Access:** the Admin page is gated by a simple shared key, set in `.env` as
`ADMIN_KEY` (defaults to `admin123` if not set — **change this before deploying
anywhere public**). Enter that key on the Login page's Admin Login tab (or the
in-page gate on Admin itself) to unlock the dashboard. It's stored only in the
browser's `sessionStorage` for that tab and sent as an `x-admin-key` header on
edit/delete/list requests — this is a lightweight gate suitable for an
internal tool, not full user authentication. For real production use, wire it
up to the existing JWT login system instead.



