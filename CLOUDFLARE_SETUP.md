# Cloudflare Setup

This project is set up for Cloudflare Pages, D1, and R2.

## Bindings

Use these binding names:

- D1 database binding: `DB`
- R2 bucket binding: `GALLERY_BUCKET`
- Environment variable: `ADMIN_SETUP_SECRET`

## Local Development

Install Wrangler when you are ready to test Cloudflare Functions locally:

```sh
npm install
npx wrangler pages dev .
```

Copy `.dev.vars.example` to `.dev.vars` and set a long random `ADMIN_SETUP_SECRET`.

## Create The First Admin

After deploying or running locally with Wrangler, call:

```sh
curl -X POST https://your-site.pages.dev/api/setup-admin \
  -H "Content-Type: application/json" \
  -d '{
    "setupSecret": "your-admin-setup-secret",
    "username": "admin",
    "password": "choose-a-strong-password"
  }'
```

The password is hashed before it is stored in D1.

## API Routes

- `POST /api/setup-admin` creates or updates the first admin.
- `POST /api/auth/login` creates an HttpOnly admin session cookie.
- `POST /api/auth/logout` clears the admin session.
- `GET /api/auth/me` checks whether the current browser is logged in.
- `GET /api/public/guest-info?code=...` fetches known guest info.
- `POST /api/public/guest-info` saves missing guest information.
- `GET /api/public/rsvp-search?q=...` searches for an invitation.
- `POST /api/public/rsvp` saves RSVP details.
- `GET /api/admin/guests` lists households and guests.
- `POST /api/admin/guests` creates or updates a household.
- `DELETE /api/admin/guests?id=...` deletes a household.
- `GET /api/admin/missing-info` lists households missing contact info.
- `GET /api/admin/rsvps` lists RSVP responses.
- `GET /api/gallery/assets` lists published gallery assets.

## Notes

The current frontend still has localStorage fallback behavior in several places. The backend routes are ready so the next step is wiring each page to call these API endpoints and use localStorage only as a local demo fallback.
