# Referral Alpha Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the admin referrals page to show invited _specialists_ (active/pending) with alpha-activation messaging, and add an alpha note to the bot invite message.

**Architecture:** UI + i18n only. The Go API `GET /api/admin/referrals` already returns `specialists`, `activeCount`, `passiveCount`, and `specialistCount`. Work is: extend the TS type, rewrite the Next.js page, update `AdminReferrals.*` i18n, and add one line to the bot `Referral.InviteMessage`.

**Tech Stack:** Next.js 15 + next-intl + SWR + Tailwind (mini-app), go-i18n (bot).

Spec: [docs/superpowers/specs/2026-04-21-referral-alpha-messaging-design.md](../specs/2026-04-21-referral-alpha-messaging-design.md)

---

## Task 1: Extend TS types for specialist referrals

**Files:**

- Modify: `mini-app/src/lib/types.ts:50-68`

- [ ] **Step 1: Add `TReferredSpecialist` type and extend `TReferralsResponse`**

Replace the block at [mini-app/src/lib/types.ts:50-68](mini-app/src/lib/types.ts:50) with:

```ts
/***************************************************************************************************
 * Referral system types.
 ***************************************************************************************************/
export type TReferralClient = {
  id: string;
  name: string;
  displayName?: string;
  photoUrl?: string;
  createdAt: string;
  telegramUserId?: number;
  isBlocked?: boolean;
};

export type TReferredSpecialist = {
  id: string;
  name: string;
  botUsername: string;
  createdAt: string;
  firstPaymentAt?: string;
  isActive: boolean;
};

export type TReferralsResponse = {
  code: string;
  link: string;
  count: number;
  referrals: TReferralClient[];
  specialistCount: number;
  activeCount: number;
  passiveCount: number;
  specialists: TReferredSpecialist[];
};
```

(`TReferralClient` / `count` / `referrals` stay — backend still returns them; the page just stops rendering them.)

- [ ] **Step 2: Verify typecheck passes**

Run: `cd mini-app && bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mini-app/src/lib/types.ts
git commit -m "feat(mini-app): add TReferredSpecialist type for referral response"
```

---

## Task 2: Update i18n — Russian

**Files:**

- Modify: `mini-app/messages/ru.json:362-378`

- [ ] **Step 1: Replace the `AdminReferrals` block**

Replace the object at [mini-app/messages/ru.json:362-378](mini-app/messages/ru.json:362) with:

```json
  "AdminReferrals": {
    "title": "Приглашения",
    "heroHeading": "Пригласите коллег",
    "heroBody": "Поделитесь ссылкой со специалистами, которые хотят вести запись через Telegram. Сейчас приложение бесплатно на альфа-этапе — приглашение становится активным, когда приглашённый специалист оплатит первую подписку после релиза платной версии.",
    "yourLink": "Ваша ссылка",
    "copyLink": "Скопировать",
    "linkCopied": "Ссылка скопирована",
    "copyFailed": "Не удалось скопировать",
    "shareTelegram": "Поделиться в Telegram",
    "shareText": "Попробуй платформу для записи клиентов в Telegram — я уже пользуюсь 👉 {link}",
    "statsActive": "Активные",
    "statsPending": "Ожидают",
    "sectionActive": "Активные",
    "sectionPending": "Ожидают",
    "listEmpty": "Пока никого нет — поделитесь ссылкой с коллегами, чтобы начать",
    "joinedOn": "Присоединился(ась) {date}",
    "activatedOn": "Оплатил {date}"
  },
```

- [ ] **Step 2: Verify JSON is valid**

Run: `cd mini-app && bunx tsc --noEmit && bun run lint --quiet || true; jq . messages/ru.json > /dev/null`
Expected: no errors from `jq`.

- [ ] **Step 3: Commit**

```bash
git add mini-app/messages/ru.json
git commit -m "feat(mini-app): rewrite AdminReferrals ru copy for specialist referrals"
```

---

## Task 3: Update i18n — English

**Files:**

- Modify: `mini-app/messages/en.json:362-378`

- [ ] **Step 1: Replace the `AdminReferrals` block**

Replace the object at [mini-app/messages/en.json:362-378](mini-app/messages/en.json:362) with:

```json
  "AdminReferrals": {
    "title": "Referrals",
    "heroHeading": "Invite your fellow specialists",
    "heroBody": "Share the link with specialists who want to run bookings via Telegram. The app is free during alpha — an invite becomes active when the invited specialist pays their first subscription after the paid version launches.",
    "yourLink": "Your link",
    "copyLink": "Copy",
    "linkCopied": "Link copied",
    "copyFailed": "Couldn't copy link",
    "shareTelegram": "Share on Telegram",
    "shareText": "Try this Telegram booking platform — I'm already using it 👉 {link}",
    "statsActive": "Active",
    "statsPending": "Pending",
    "sectionActive": "Active",
    "sectionPending": "Pending",
    "listEmpty": "No one yet — share the link with fellow specialists to get started",
    "joinedOn": "Joined {date}",
    "activatedOn": "Paid {date}"
  },
```

- [ ] **Step 2: Verify JSON is valid**

Run: `jq . mini-app/messages/en.json > /dev/null`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mini-app/messages/en.json
git commit -m "feat(mini-app): rewrite AdminReferrals en copy for specialist referrals"
```

---

## Task 4: Write failing test for the referrals page

**Files:**

- Create: `mini-app/src/app/admin/settings/referrals/__tests__/referrals-page.test.tsx`

- [ ] **Step 1: Write the test file**

```tsx
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import ReferralsPage from "../page";

import type { TReferralsResponse } from "@/lib/types";

const useAdminReferralsMock = vi.fn();

vi.mock("@/hooks/queries", () => ({
  useAdminReferrals: () => useAdminReferralsMock(),
}));

vi.mock("@/components/TopBar", () => ({
  TopBar: ({ title }: { title: string }): React.ReactNode => <div>{title}</div>,
}));

vi.mock("@/lib/telegram", () => ({
  getTelegramWebApp: () => null,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const messages = {
  AdminReferrals: {
    title: "Приглашения",
    heroHeading: "Пригласите коллег",
    heroBody: "Альфа-этап — активируется после первой оплаты.",
    yourLink: "Ваша ссылка",
    copyLink: "Скопировать",
    linkCopied: "Ок",
    copyFailed: "Ошибка",
    shareTelegram: "Поделиться",
    shareText: "Попробуй 👉 {link}",
    statsActive: "Активные",
    statsPending: "Ожидают",
    sectionActive: "Активные",
    sectionPending: "Ожидают",
    listEmpty: "Никого нет",
    joinedOn: "Присоединился {date}",
    activatedOn: "Оплатил {date}",
  },
};

function renderWith(data: TReferralsResponse | null, isLoading = false): void {
  useAdminReferralsMock.mockReturnValue({
    data,
    isLoading,
    error: undefined,
    mutate: vi.fn(),
  });
  render(
    <NextIntlClientProvider locale="ru" messages={messages}>
      <ReferralsPage />
    </NextIntlClientProvider>,
  );
}

function makeResponse(
  overrides: Partial<TReferralsResponse> = {},
): TReferralsResponse {
  return {
    code: "abc",
    link: "https://t.me/masterbot?start=ref_abc",
    count: 0,
    referrals: [],
    specialistCount: 0,
    activeCount: 0,
    passiveCount: 0,
    specialists: [],
    ...overrides,
  };
}

describe("ReferralsPage", () => {
  it("renders both sections when active and pending specialists exist", () => {
    renderWith(
      makeResponse({
        activeCount: 1,
        passiveCount: 1,
        specialistCount: 2,
        specialists: [
          {
            id: "a",
            name: "Paid Anna",
            botUsername: "anna_bot",
            createdAt: "2026-03-01T00:00:00Z",
            firstPaymentAt: "2026-04-10T00:00:00Z",
            isActive: true,
          },
          {
            id: "b",
            name: "Pending Boris",
            botUsername: "boris_bot",
            createdAt: "2026-04-15T00:00:00Z",
            isActive: false,
          },
        ],
      }),
    );

    expect(screen.getByText("Paid Anna")).toBeTruthy();
    expect(screen.getByText("Pending Boris")).toBeTruthy();
    expect(screen.getAllByText("Активные").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ожидают").length).toBeGreaterThan(0);
    expect(screen.queryByText("Никого нет")).toBeNull();
  });

  it("renders only pending section when no active referrals", () => {
    renderWith(
      makeResponse({
        passiveCount: 1,
        specialistCount: 1,
        specialists: [
          {
            id: "b",
            name: "Pending Boris",
            botUsername: "boris_bot",
            createdAt: "2026-04-15T00:00:00Z",
            isActive: false,
          },
        ],
      }),
    );

    expect(screen.getByText("Pending Boris")).toBeTruthy();
    expect(screen.queryByText("Никого нет")).toBeNull();
  });

  it("shows empty state when no specialists at all", () => {
    renderWith(makeResponse());
    expect(screen.getByText("Никого нет")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mini-app && bunx vitest run src/app/admin/settings/referrals/__tests__/referrals-page.test.tsx`
Expected: FAIL — the page still renders `data.referrals` (clients), not specialists. Test names like "Paid Anna" won't be found.

---

## Task 5: Rewrite the referrals page

**Files:**

- Modify: `mini-app/src/app/admin/settings/referrals/page.tsx` (full rewrite)

- [ ] **Step 1: Replace the file contents**

```tsx
"use client";

import { Clock, Copy, Gift, Send, UserCircle2, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";
import { toast } from "sonner";

import { TopBar } from "@/components/TopBar";
import { useAdminReferrals } from "@/hooks/queries";
import { getTelegramWebApp } from "@/lib/telegram";

import type { TReferredSpecialist } from "@/lib/types";
import type { ReactNode } from "react";

export default function ReferralsPage(): ReactNode {
  const t = useTranslations("AdminReferrals");
  const locale = useLocale();
  const { data, isLoading } = useAdminReferrals();

  const link = data?.link ?? "";
  const specialists = data?.specialists ?? [];
  const activeCount = data?.activeCount ?? 0;
  const pendingCount = data?.passiveCount ?? 0;

  const active = specialists
    .filter((s) => s.isActive)
    .sort((a, b) =>
      (b.firstPaymentAt ?? "").localeCompare(a.firstPaymentAt ?? ""),
    );
  const pending = specialists
    .filter((s) => !s.isActive)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const handleCopy = useCallback(async (): Promise<void> => {
    if (!link) {
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const el = document.createElement("textarea");
        el.value = link;
        el.setAttribute("readonly", "");
        el.style.position = "absolute";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      toast.success(t("linkCopied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }, [link, t]);

  const handleShareTelegram = useCallback((): void => {
    if (!link) {
      return;
    }
    const message = t("shareText", { link: "" }).trim();
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(message)}`;
    const webApp = getTelegramWebApp();
    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, "_blank");
    }
  }, [link, t]);

  const formatDate = (iso: string): string => {
    const date = new Date(iso);
    return date.toLocaleDateString(locale === "en" ? "en-US" : "ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const bothEmpty = active.length === 0 && pending.length === 0;

  return (
    <div>
      <TopBar title={t("title")} showBack />
      <div className={"space-y-4 p-4"}>
        <div className={"bg-card rounded-xl p-4"}>
          <div className={"flex items-start gap-3"}>
            <div
              className={
                "bg-brand/15 text-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              }
            >
              <Gift className={"h-5 w-5"} />
            </div>
            <div className={"flex-1"}>
              <h2 className={"text-foreground text-base font-medium"}>
                {t("heroHeading")}
              </h2>
              <p
                className={"text-muted-foreground mt-1 text-sm leading-relaxed"}
              >
                {t("heroBody")}
              </p>
            </div>
          </div>
        </div>

        <div className={"bg-card rounded-xl p-4"}>
          <p
            className={
              "text-muted-foreground mb-2 text-xs tracking-wide uppercase"
            }
          >
            {t("yourLink")}
          </p>
          <div
            className={
              "bg-surface-hover text-foreground rounded-lg px-3 py-2 font-mono text-sm break-all"
            }
          >
            {isLoading || !link ? "…" : link}
          </div>
          <div className={"mt-3 flex gap-2"}>
            <button
              type={"button"}
              onClick={handleCopy}
              disabled={!link}
              className={
                "bg-surface-hover text-foreground active:bg-border flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
              }
            >
              <Copy className={"h-4 w-4"} />
              {t("copyLink")}
            </button>
            <button
              type={"button"}
              onClick={handleShareTelegram}
              disabled={!link}
              className={
                "bg-primary text-primary-foreground flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-opacity active:opacity-80 disabled:opacity-50"
              }
            >
              <Send className={"h-4 w-4"} />
              {t("shareTelegram")}
            </button>
          </div>
        </div>

        <div className={"grid grid-cols-2 gap-3"}>
          <StatTile
            icon={<Users className={"h-5 w-5"} />}
            accent={"success"}
            label={t("statsActive")}
            value={activeCount}
          />
          <StatTile
            icon={<Clock className={"h-5 w-5"} />}
            accent={"muted"}
            label={t("statsPending")}
            value={pendingCount}
          />
        </div>

        {bothEmpty ? (
          <div
            className={
              "bg-card text-muted-foreground rounded-xl px-4 py-8 text-center text-sm"
            }
          >
            {t("listEmpty")}
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <SpecialistSection
                title={t("sectionActive")}
                items={active}
                dateLabel={(s) =>
                  t("activatedOn", {
                    date: formatDate(s.firstPaymentAt ?? s.createdAt),
                  })
                }
              />
            )}
            {pending.length > 0 && (
              <SpecialistSection
                title={t("sectionPending")}
                items={pending}
                dateLabel={(s) =>
                  t("joinedOn", { date: formatDate(s.createdAt) })
                }
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatTile({
  icon,
  accent,
  label,
  value,
}: {
  icon: ReactNode;
  accent: "success" | "muted";
  label: string;
  value: number;
}): ReactNode {
  const accentClasses =
    accent === "success"
      ? "bg-success/15 text-success"
      : "bg-surface-hover text-muted-foreground";
  return (
    <div className={"bg-card rounded-xl p-4"}>
      <div className={"flex items-center gap-3"}>
        <div
          className={`${accentClasses} flex h-10 w-10 items-center justify-center rounded-lg`}
        >
          {icon}
        </div>
        <div className={"min-w-0"}>
          <div
            className={"text-muted-foreground text-xs tracking-wide uppercase"}
          >
            {label}
          </div>
          <div
            className={"text-foreground text-2xl font-semibold tabular-nums"}
          >
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecialistSection({
  title,
  items,
  dateLabel,
}: {
  title: string;
  items: TReferredSpecialist[];
  dateLabel: (s: TReferredSpecialist) => string;
}): ReactNode {
  return (
    <div>
      <h3
        className={
          "text-muted-foreground mb-2 px-1 text-xs tracking-wide uppercase"
        }
      >
        {title}
      </h3>
      <div
        className={"bg-card divide-border divide-y overflow-hidden rounded-xl"}
      >
        {items.map((s) => (
          <SpecialistRow key={s.id} item={s} subtitle={dateLabel(s)} />
        ))}
      </div>
    </div>
  );
}

function SpecialistRow({
  item,
  subtitle,
}: {
  item: TReferredSpecialist;
  subtitle: string;
}): ReactNode {
  return (
    <div className={"flex items-center gap-3 px-4 py-3"}>
      <div
        className={
          "bg-surface-hover text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        }
      >
        <UserCircle2 className={"h-5 w-5"} />
      </div>
      <div className={"min-w-0 flex-1"}>
        <div className={"text-foreground truncate text-sm font-medium"}>
          {item.name}
        </div>
        <div className={"text-muted-foreground truncate text-xs"}>
          {item.botUsername ? `@${item.botUsername} · ${subtitle}` : subtitle}
        </div>
      </div>
    </div>
  );
}
```

Note: the old imports of `ClientAvatar` and `TReferralClient` are removed — they were only used here.

- [ ] **Step 2: Run the test, expect it to pass**

Run: `cd mini-app && bunx vitest run src/app/admin/settings/referrals/__tests__/referrals-page.test.tsx`
Expected: PASS — all three cases.

- [ ] **Step 3: Run typecheck + lint**

Run: `cd mini-app && bunx tsc --noEmit && bun run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mini-app/src/app/admin/settings/referrals/page.tsx mini-app/src/app/admin/settings/referrals/__tests__/referrals-page.test.tsx
git commit -m "feat(mini-app): rewrite referrals page to show referred specialists"
```

---

## Task 6: Add alpha line to bot `Referral.InviteMessage` — Russian

**Files:**

- Modify: `bot/internal/i18n/locales/active.ru.json:62-64`

- [ ] **Step 1: Replace the `Referral.InviteMessage` value**

At [bot/internal/i18n/locales/active.ru.json:62-64](bot/internal/i18n/locales/active.ru.json:62), replace the `"other"` string with (note the inserted "🧪 Сейчас платформа…" line before "🔗 Ваша ссылка"):

```json
  "Referral.InviteMessage": {
    "other": "🤝 <b>Партнёрская программа</b>\n\nПриглашайте коллег на платформу и получайте бонусы, когда они оформят подписку.\n\n📌 <b>Как это работает</b>\n• Отправляете ссылку ниже специалисту, который хочет принимать записи через Telegram.\n• Он проходит онбординг и получает базовые функции бесплатно.\n• Часть текущих возможностей скоро станет платной, плюс мы готовим расширенные инструменты для продвинутых специалистов.\n• Когда приглашённый специалист оплачивает первую подписку, приглашение становится <b>активным</b> и вам начисляется бонус.\n\n🧪 Сейчас платформа бесплатна на альфа-этапе. Бонусы начнут начисляться после релиза платной версии — приглашения, сделанные сейчас, сохранятся.\n\n🔗 Ваша ссылка:\n<code>{{.Link}}</code>\n\nСтатистика — в панели управления → Настройки → Приглашения (активные / ожидающие)."
  },
```

- [ ] **Step 2: Verify JSON is valid**

Run: `jq . bot/internal/i18n/locales/active.ru.json > /dev/null`
Expected: no errors.

---

## Task 7: Add alpha line to bot `Referral.InviteMessage` — English

**Files:**

- Modify: `bot/internal/i18n/locales/active.en.json:62-64`

- [ ] **Step 1: Replace the `Referral.InviteMessage` value**

At [bot/internal/i18n/locales/active.en.json:62-64](bot/internal/i18n/locales/active.en.json:62), replace the `"other"` string with (note the inserted "🧪 The platform…" line before "🔗 Your link"):

```json
  "Referral.InviteMessage": {
    "other": "🤝 <b>Partner program</b>\n\nInvite fellow specialists to the platform and earn rewards when they subscribe.\n\n📌 <b>How it works</b>\n• Send the link below to a specialist who wants to accept bookings via Telegram.\n• They onboard and get the core features free.\n• Some of the current features will move to a paid tier, and we're rolling out advanced tools for power users.\n• When the invited specialist pays their first subscription, the referral becomes <b>active</b> and you earn a reward.\n\n🧪 The platform is free during alpha. Rewards start accruing once the paid version launches — invites made now will be kept.\n\n🔗 Your link:\n<code>{{.Link}}</code>\n\nStats live in the admin panel → Settings → Referrals (active / pending)."
  },
```

- [ ] **Step 2: Verify JSON is valid**

Run: `jq . bot/internal/i18n/locales/active.en.json > /dev/null`
Expected: no errors.

- [ ] **Step 3: Verify Go build + tests**

Run: `cd bot && go build ./... && go test ./internal/telegram/...`
Expected: build succeeds; existing referral tests pass.

- [ ] **Step 4: Commit both bot locale changes**

```bash
git add bot/internal/i18n/locales/active.ru.json bot/internal/i18n/locales/active.en.json
git commit -m "feat(bot): add alpha-stage note to referral invite message"
```

---

## Task 8: Final verification

- [ ] **Step 1: Full test suites**

Run: `cd mini-app && bunx vitest run && bun run lint && bunx tsc --noEmit`
Expected: all green.

Run: `cd bot && go test ./...`
Expected: all green.

- [ ] **Step 2: Manual smoke (optional but recommended)**

1. `cd mini-app && bun dev`
2. Open `/admin/settings/referrals` in the Telegram Mini App (or browser with mocked Telegram env).
3. Confirm: hero copy mentions alpha + first-payment activation; stat tiles show Active / Pending; sections render correctly for empty, pending-only, and both-populated cases (use browser devtools to override API response if needed).
4. In the specialist's Telegram bot, tap **👤 Профиль → 🎁 Пригласить друга**. Confirm the new "🧪 Сейчас платформа бесплатна…" line appears between the last bullet and the link block.

- [ ] **Step 3: No additional commit** — all work was committed per task.
