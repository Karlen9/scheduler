# Scheduler landing

Marketing landing page for the Scheduler Telegram bot. Russian at `/`, English at `/en`.
Same stack as `mini-app` (Next.js 16, React 19, Tailwind 4, next-intl 4, Vitest), plus
`gsap` (scroll motion) and `qrcode.react`.

## Run

```bash
cd landing
bun install
bun dev              # http://localhost:3000
bun run build && bun run start
bunx tsc --noEmit && bun run lint && bunx vitest run
```

The page is fully static. The locale is never detected from the browser: `/` is always Russian.

## Deploy on Vercel

Import the repository and set **Root Directory** to `landing`. Framework preset: Next.js.
Install command: `bun install`. No other settings are required.

Environment variables (see `.env.example`):

| Variable                    | Purpose                                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`      | Canonical origin for metadata, sitemap, robots. Falls back to Vercel's production URL, then `http://localhost:3000`. |
| `NEXT_PUBLIC_APP_URL`       | Mini-app origin that serves `/privacy` and `/terms`.                                                                 |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Optional. When empty, no email and no `mailto:` link is rendered anywhere.                                           |

## Where things live

- Copy: `messages/ru.json`, `messages/en.json` (keys must stay identical; `<accent>` marks the italic phrase).
- Product name, bot link, legal entity, email: `src/lib/site.ts`. Rename the product per locale in `PRODUCT_NAMES` (Специалист in ru, Scheduler in en).
- Colors: `src/styles/theme.css` is copied from `mini-app/src/styles/theme.css`; a test fails on drift.
- FAQ items 7 to 18 are copied from the mini-app help page; a test fails if they drift.

## Screenshots

The phones render CSS mocks until real screenshots exist. To swap one in:

1. Put the PNG in `public/screens/` (for example `public/screens/booking.png`, about 9:19 portrait).
2. Set its path in `src/lib/screens.ts`:

```ts
export const SCREENS = { booking: '/screens/booking.png', calendar: null, request: null };
```

`null` keeps the mock for that phone.

## Contact email

Set `NEXT_PUBLIC_CONTACT_EMAIL` in Vercel. It appears in the support block and footer.
