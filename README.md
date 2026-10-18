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

```bash
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Admin: [http://localhost:3000/admin](http://localhost:3000/admin)

## Emails

Without SMTP env vars, outbound mail uses Ethereal. Open preview links from **Admin → Email outbox**.
