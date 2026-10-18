# The Family Calendar

Shared family calendar with email signup, admin invites, timezone-aware schedules, free/busy planning, and event invitations that only appear after acceptance.

## Features

- Email signup + login
- Admin page to invite members and accept/reject pending signups
- Emails on signup, invite, and acceptance (Ethereal preview links by default)
- Plan activities with selected members; invite links emailed; events show after accept
- Day alignment across timezones

## Demo accounts

After seeding:

| Role   | Email            | Password   |
|--------|------------------|------------|
| Admin  | mia@fam.local    | family123  |
| Member | alex@fam.local   | family123  |
| Member | jordan@fam.local | family123  |

## Setup

1. Copy `.env.example` to `.env` and set:
   - `DATABASE_URL` — PostgreSQL connection string (Prisma Postgres, Neon, etc.)
   - `AUTH_SECRET` — long random string
   - `APP_BASE_URL` / `NEXT_PUBLIC_APP_URL` — your site URL
2. Install and initialize:

```bash
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Admin: [http://localhost:3000/admin](http://localhost:3000/admin)

## Deploy

Push to GitHub, then deploy on Vercel. Set the same env vars in the Vercel project. The build runs `prisma db push` so the schema is applied automatically.

### Custom domain: thefamilycalendar.com

The Vercel project expects this domain. At your DNS provider (currently IONOS / `ui-dns`), either:

**Option A — nameservers (recommended)**  
Set nameservers to:
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

**Option B — A / CNAME records**  
- `@` → A `216.198.79.1` and A `64.29.17.1`  
- `www` → CNAME `640d5edfc1f1ba6d.vercel-dns-017.com.`

Then run `vercel domains verify thefamilycalendar.com`.

Set `APP_BASE_URL` and `NEXT_PUBLIC_APP_URL` to `https://thefamilycalendar.com` so invite emails use the correct links. Configure SMTP env vars for real email delivery.

## Emails

Without SMTP env vars, outbound mail uses Ethereal. Open preview links from **Admin → Email outbox**.
