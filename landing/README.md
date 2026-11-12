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
| `NEXT_PUBLIC_CONTACT_EMAIL` | Optional. When empty, no email and no `mailto:` link is rendered anywhere.                                           |

## Where things live

- Copy: `messages/ru.json`, `messages/en.json` (keys must stay identical; `<accent>` marks the italic phrase).
- Product name, bot link, email: `src/lib/site.ts`. Rename the product per locale in `PRODUCT_NAMES` (Специалист in ru, Scheduler in en).
- Colors: `src/styles/theme.css` is copied from `mini-app/src/styles/theme.css`; a test fails on drift.
- FAQ items 7 to 18 are copied from the mini-app help page; a test fails if they drift.

## Screenshots

The phones render CSS mocks until real screenshots exist. To swap one in:

1. Put the PNG in `public/screens/` (for example `public/screens/booking.png`, about 9:19 portrait).
2. Set its path in `src/lib/screens.ts`:

```ts
export const SCREENS = {
  booking: { src: '/screens/booking.png', statusBg: '#ffffff' },
  bookings: null,
  calendar: null,
  slots: null,
};
```

Screenshots are taken without the iOS status bar. The phone draws its own status bar (time, signal, wifi, battery) above the image, and `statusBg` is the colour of the screenshot's top edge, painted behind that bar so the two blend.

The room screens use three more keys: `roomCalendar` (the room calendar of the work-days page), `room` (the room page with its members) and `roomAlternating` (the "alternating weeks" sheet). Their files are `public/screens/room-calendar.png`, `room.png` and `room-alternating.png`. The last one is taken with the sheet open over a dimmed page, so its `statusBg` is the dimmed overlay colour (`#78787a`), not the page colour. See "Capturing the shared room screens" below for how to take them.

The first four keys are `booking` (specialist page in the client's bot), `bookings` (specialist's booking list), `calendar` (schedule for the day) and `slots` (date and time picker). `null` keeps the mock for that phone.

### Capturing the shared room ("Кабинет") screens

The mini-app ships a mock scenario with a shared room, so the room screens can be captured without a backend. Build and start the mini-app in production mode (`bun run build && bun start` in `mini-app`, served on <http://localhost:3000>) so the Next.js dev indicator (the "N" bubble) is not in the shot; `bun dev` works too but shows it. Open the pages below in the browser at an iPhone 16 viewport (393×852) and take the screenshots. `?mock=room` works the same in both modes.

- `http://localhost:3000/test/admin/settings/work-days?mock=room` - the room calendar: days filled with each member's colour, legend, an incoming request from Анна and the quick actions.
- `http://localhost:3000/test/admin/settings/room` - members of the room (you, Анна Смирнова with her own bot, Ольга without a bot) and the schedule links.
- `http://localhost:3000/test/admin/settings` - the settings menu with the "Кабинет" item.
- `http://localhost:3000/test/admin` - the specialist's schedule and bookings in dates mode.
- `http://localhost:3000/test/client?mock=room` (then `/test/client/book`) - the client side: only the specialist's own open days are bookable.

`?mock=room` is remembered in `sessionStorage` (`mock-scenario`), so in-app navigation keeps the scenario and the parameter only has to be on the first URL you open. Reset with `?mock=default` (for example `http://localhost:3000/test/admin?mock=default`). All dates are relative to today, so the weeks always look current.

## Contact email

Set `NEXT_PUBLIC_CONTACT_EMAIL` in Vercel. It appears in the support block and footer.
