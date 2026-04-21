# Referral program: specialist-only surface + alpha activation messaging

## Context

The referral program is specialist-to-specialist: a specialist invites another specialist via a master-bot deep link (`t.me/<MasterBot>?start=ref_<code>`), and the inviter earns a bonus once the invitee pays their first subscription. The backend already tracks this correctly (`specialists.referred_via_code`, `first_payment_at`), and the API `GET /api/admin/referrals` returns the referred-specialist list, active/passive counts, and the invite link.

Two surfaces are out of sync with this intent:

1. **Mini-app `/admin/settings/referrals` page** still renders invited _clients_ and uses client-framed copy ("Приглашаю тебя записаться через бот").
2. **Bot `Referral.InviteMessage`** mentions first-payment activation but doesn't frame the current alpha period — specialists have no way to understand that bonuses are deferred until the paid version launches.

The app is free during alpha. Specialists should understand that invites count as _pending_ now and become _active_ (bonus-earning) once the invitee pays their first subscription after the paid release.

## Goals

- Mini-app referrals page reflects the real program (specialists, not clients).
- Both surfaces explain the alpha rule clearly: invites are tracked now, activation happens on the invitee's first paid subscription post-release.
- No backend changes — the API already returns everything needed.

## Non-goals

- Removing the client-referral backend (`clients.referred_via_code`, `CreateClientWithReferral`, `validateReferralForIncomingUser`). No UI will expose it after this change; a separate cleanup task can rip it out later.
- Redesigning the invite flow or the master-bot onboarding attribution logic.
- Payment/subscription implementation. `first_payment_at` is already wired; no change here.

## Design

### Mini-app `/admin/settings/referrals` page

Rewrite [mini-app/src/app/admin/settings/referrals/page.tsx](mini-app/src/app/admin/settings/referrals/page.tsx) to render the specialist-referral view returned by the API.

**Sections (top to bottom):**

1. **Hero card** — gift icon, heading, body copy explaining the alpha activation rule.
2. **Your link card** — unchanged (link display + Copy + Share in Telegram buttons). Share text updated.
3. **Stats row** — two stat tiles side-by-side: "Активные" (`activeCount`, paid) and "Ожидают" (`passiveCount`, signed up but not paid). No more single `count` tile.
4. **Sectioned list** — two subsections:
   - **Активные**: rows for each `specialists[i]` where `isActive === true`, sorted by `firstPaymentAt` desc.
   - **Ожидают**: rows for each `specialists[i]` where `isActive === false`, sorted by `createdAt` desc.
   - Each row shows: specialist name, `@botUsername`, and join date (active rows show "Оплатил {date}" instead of join date).
   - Each subsection renders only when it has entries; if both are empty, show a single empty-state card.

**Row component:** replace `ReferralRow` (client-shaped, with `ClientAvatar` and `isBlocked` badge) with a new `SpecialistReferralRow` that takes a `ReferredSpecialist` shape. No avatar (we don't have specialist photos in the API response); use a neutral icon placeholder consistent with other admin list rows.

**Types:** the existing `TReferralClient` import stops being used on this page. Add a `TReferredSpecialist` type in `mini-app/src/lib/types.ts` matching the API's `ReferredSpecialist`, and extend the `useAdminReferrals` return shape in `mini-app/src/hooks/queries.ts` to include `specialists`, `activeCount`, `passiveCount`, `specialistCount`.

### i18n

**`mini-app/messages/ru.json` `AdminReferrals.*`** — full rewrite of most keys:

| Key                                                     | New value (ru)                                                                                                                                                                                                                                     |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`                                                 | `Приглашения` (unchanged)                                                                                                                                                                                                                          |
| `heroHeading`                                           | `Пригласите коллег`                                                                                                                                                                                                                                |
| `heroBody`                                              | `Поделитесь ссылкой со специалистами, которые хотят вести запись через Telegram. Сейчас приложение бесплатно на альфа-этапе — приглашение становится активным, когда приглашённый специалист оплатит первую подписку после релиза платной версии.` |
| `yourLink`                                              | `Ваша ссылка` (unchanged)                                                                                                                                                                                                                          |
| `copyLink`, `linkCopied`, `copyFailed`, `shareTelegram` | unchanged                                                                                                                                                                                                                                          |
| `shareText`                                             | `Попробуй платформу для записи клиентов в Telegram — я уже пользуюсь 👉 {link}`                                                                                                                                                                    |
| `statsActive`                                           | `Активные` (new)                                                                                                                                                                                                                                   |
| `statsPending`                                          | `Ожидают` (new)                                                                                                                                                                                                                                    |
| `sectionActive`                                         | `Активные` (new)                                                                                                                                                                                                                                   |
| `sectionPending`                                        | `Ожидают` (new)                                                                                                                                                                                                                                    |
| `listEmpty`                                             | `Пока никого нет — поделитесь ссылкой с коллегами, чтобы начать`                                                                                                                                                                                   |
| `joinedOn`                                              | `Присоединился(ась) {date}` (renamed from `referralDate`)                                                                                                                                                                                          |
| `activatedOn`                                           | `Оплатил {date}` (new)                                                                                                                                                                                                                             |

Remove: `statsCount` (replaced by active/pending), `referralsTitle`, `referralsEmpty`, `referralDate`, `blocked`.

`mini-app/messages/en.json` mirrors the same keys with English copy.

### Bot `Referral.InviteMessage`

Update [bot/internal/i18n/locales/active.ru.json](bot/internal/i18n/locales/active.ru.json) and `active.en.json` to add an explicit alpha line. Current message already covers mechanics; the additive line clarifies timing:

Insert after the "Как это работает" bullets, before the link:

> 🧪 Сейчас платформа бесплатна на альфа-этапе. Бонусы начнут начисляться после релиза платной версии — приглашения, сделанные сейчас, сохранятся.

The "invite becomes active when invitee pays first subscription" bullet stays — it still describes the activation condition, which is what matters long-term.

### Data flow

```
specialist opens /admin/settings/referrals
  → useAdminReferrals() calls GET /api/admin/referrals
  → API returns { code, link, specialists, activeCount, passiveCount, specialistCount, referrals (ignored), count (ignored) }
  → page renders hero, link card, stats (active/pending), sectioned list
```

No backend changes. The page just stops consuming `referrals`/`count` and starts consuming `specialists`/`activeCount`/`passiveCount`.

### Error handling

Unchanged. `useAdminReferrals` SWR hook already surfaces loading + undefined-data states; the page renders `…` placeholders while loading and the empty-state card when both lists are empty.

### Testing

- Existing Go tests (`referral_handlers_test.go`) continue to pass — API contract unchanged.
- New vitest for the mini-app page: render with mocked `useAdminReferrals` returning (a) both lists populated, (b) only pending, (c) only active, (d) both empty. Assert correct sections appear and empty state shows only when both are empty.
- Manual check: invite message in the specialist bot renders the new alpha line without breaking formatting.

## Open questions

None. Copy is final; layout is final; scope is final.
