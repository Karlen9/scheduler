"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DashboardI18nProvider,
  LanguageSwitch,
  dashboardLocale,
  translateStatus,
  useDashboardI18n,
  weekdayName,
} from "@/lib/i18n";
import type {
  Booking,
  DashboardAdminsResponse,
  DashboardAuditLogItem,
  DashboardCalendarEvent,
  DashboardConflictReport,
  DashboardOverview,
  DashboardSearchResponse,
  DashboardSpecialist,
  DashboardSystemStatus,
  DashboardUser,
  OwnerActivityEvent,
  OwnerNamedValue,
  OwnerRevenueLeader,
  SessionType,
  SpecialistListResponse,
  SpecialistProfile,
  SpecialistSnapshot,
} from "@/lib/types";
import type { FormEvent, ReactNode } from "react";

type ViewKey =
  | "overview"
  | "specialists"
  | "activity"
  | "search"
  | "calendar"
  | "bookings"
  | "clients"
  | "recurring"
  | "services"
  | "schedule"
  | "referrals"
  | "ops"
  | "settings";

const navItems: Array<{
  key: ViewKey;
  label: string;
  needsSpecialist?: boolean;
}> = [
  { key: "overview", label: "Overview" },
  { key: "specialists", label: "Specialists" },
  { key: "activity", label: "Activity" },
  { key: "search", label: "Search" },
  { key: "calendar", label: "Calendar" },
  { key: "bookings", label: "Bookings", needsSpecialist: true },
  { key: "clients", label: "Clients", needsSpecialist: true },
  { key: "recurring", label: "Recurring", needsSpecialist: true },
  { key: "services", label: "Services", needsSpecialist: true },
  { key: "schedule", label: "Schedule", needsSpecialist: true },
  { key: "referrals", label: "Referrals", needsSpecialist: true },
  { key: "ops", label: "Ops" },
  { key: "settings", label: "Settings", needsSpecialist: true },
];

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/dashboard/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error((await response.text()) || `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

async function apiEmpty(path: string, init?: RequestInit): Promise<void> {
  const response = await fetch(`/api/dashboard/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error((await response.text()) || `HTTP ${response.status}`);
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(dashboardLocale()).format(value || 0);
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat(dashboardLocale(), { maximumFractionDigits: 1 }).format(value || 0)}%`;
}

function formatDateTime(value?: string): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat(dashboardLocale(), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value?: string): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat(dashboardLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function dateInputValue(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function shortID(value: string): string {
  return value ? value.slice(0, 8) : "-";
}

function statusClass(status: string): string {
  if (status === "confirmed" || status === "active" || status === "completed") {
    return "status status-good";
  }
  if (
    status === "pending" ||
    status === "reschedule_pending" ||
    status === "cancel_requested"
  ) {
    return "status status-warn";
  }
  return "status status-bad";
}

function Card({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}): ReactNode {
  return (
    <div className={"metric-card"}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function Section({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <section className={"panel"}>
      <div className={"section-title"}>
        <h2>{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: ReactNode }): ReactNode {
  return <div className={"empty-state"}>{children}</div>;
}

export function DashboardApp(props: { initialUser: DashboardUser }): ReactNode {
  return (
    <DashboardI18nProvider>
      <DashboardAppInner {...props} />
    </DashboardI18nProvider>
  );
}

function DashboardAppInner({
  initialUser,
}: {
  initialUser: DashboardUser;
}): ReactNode {
  const { language, t } = useDashboardI18n();
  const [view, setView] = useState<ViewKey>("overview");
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [specialists, setSpecialists] = useState<DashboardSpecialist[]>([]);
  const [specialistTotal, setSpecialistTotal] = useState(0);
  const [selectedSpecialistId, setSelectedSpecialistId] = useState("");
  const [snapshot, setSnapshot] = useState<SpecialistSnapshot | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ghostName, setGhostName] = useState("");
  const [dayOffDate, setDayOffDate] = useState("");
  const [dayOffReason, setDayOffReason] = useState("");
  const [workingHoursJson, setWorkingHoursJson] = useState("[]");
  const [profileForm, setProfileForm] = useState<Partial<SpecialistProfile>>(
    {},
  );
  const [notifications, setNotifications] = useState({
    notifyNewBookings: true,
    notifyCancellations: true,
  });
  const [serviceForm, setServiceForm] = useState({
    type: "common",
    name: "",
    durationMinutes: "60",
    price: "0",
    currency: "RUB",
    sessionsCount: "0",
  });
  const [bookingForm, setBookingForm] = useState({
    clientId: "",
    sessionTypeId: "",
    duration: "60",
    date: "",
    time: "",
    message: "",
  });
  const [activity, setActivity] = useState<OwnerActivityEvent[]>([]);
  const [auditLog, setAuditLog] = useState<DashboardAuditLogItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] =
    useState<DashboardSearchResponse | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<
    DashboardCalendarEvent[]
  >([]);
  const [calendarFrom, setCalendarFrom] = useState(dateInputValue(0));
  const [calendarTo, setCalendarTo] = useState(dateInputValue(31));
  const [conflicts, setConflicts] = useState<DashboardConflictReport | null>(
    null,
  );
  const [systemStatus, setSystemStatus] =
    useState<DashboardSystemStatus | null>(null);
  const [admins, setAdmins] = useState<DashboardAdminsResponse | null>(null);

  const selectedSpecialist = useMemo(
    () =>
      specialists.find(
        (specialist) => specialist.id === selectedSpecialistId,
      ) ?? null,
    [specialists, selectedSpecialistId],
  );

  const totalRevenue = useMemo(
    () =>
      overview?.revenueByCurrency.reduce(
        (sum, item) => sum + item.revenue,
        0,
      ) ?? 0,
    [overview],
  );

  const batchServices = useMemo(
    () =>
      snapshot?.services.filter(
        (service) => service.type === "batch" && service.sessionsCount,
      ) ?? [],
    [snapshot],
  );

  const loadOverview = useCallback(async (): Promise<void> => {
    setOverview(await apiJson<DashboardOverview>("overview"));
  }, []);

  const loadSpecialists = useCallback(async (): Promise<void> => {
    const query = new URLSearchParams({ page: "1", limit: "50" });
    if (search.trim()) {
      query.set("search", search.trim());
    }
    if (statusFilter) {
      query.set("status", statusFilter);
    }
    const response = await apiJson<SpecialistListResponse>(
      `specialists?${query.toString()}`,
    );
    setSpecialists(response.specialists);
    setSpecialistTotal(response.total);
    setSelectedSpecialistId((current) =>
      response.specialists.some((specialist) => specialist.id === current)
        ? current
        : response.specialists[0]?.id || "",
    );
  }, [search, statusFilter]);

  const loadSnapshot = useCallback(
    async (specialistId: string): Promise<void> => {
      if (!specialistId) {
        setSnapshot(null);
        return;
      }
      setIsSnapshotLoading(true);
      try {
        const data = await apiJson<SpecialistSnapshot>(
          `specialists/${specialistId}/snapshot`,
        );
        setSnapshot(data);
        setProfileForm(data.profile);
        setNotifications(data.notifications);
        setWorkingHoursJson(
          JSON.stringify(data.schedule.workingHours, null, 2),
        );
        setBookingForm((current) => ({
          ...current,
          clientId: current.clientId || data.clients.clients[0]?.id || "",
          sessionTypeId: current.sessionTypeId || data.services[0]?.id || "",
          duration: current.duration || String(data.durations[0] ?? 60),
        }));
      } finally {
        setIsSnapshotLoading(false);
      }
    },
    [],
  );

  const loadActivity = useCallback(async (): Promise<void> => {
    const response = await apiJson<{ activity: OwnerActivityEvent[] }>(
      "activity?limit=75",
    );
    setActivity(response.activity);
  }, []);

  const loadAuditLog = useCallback(async (): Promise<void> => {
    const response = await apiJson<{ items: DashboardAuditLogItem[] }>(
      "audit-log?limit=100",
    );
    setAuditLog(response.items);
  }, []);

  const loadOps = useCallback(async (): Promise<void> => {
    const [conflictResponse, systemResponse, adminsResponse] =
      await Promise.all([
        apiJson<DashboardConflictReport>("conflicts?limit=50"),
        apiJson<DashboardSystemStatus>("system"),
        apiJson<DashboardAdminsResponse>("admins"),
      ]);
    setConflicts(conflictResponse);
    setSystemStatus(systemResponse);
    setAdmins(adminsResponse);
    await loadAuditLog();
  }, [loadAuditLog]);

  const loadCalendar = useCallback(async (): Promise<void> => {
    const query = new URLSearchParams({
      dateFrom: calendarFrom,
      dateTo: calendarTo,
    });
    const response = await apiJson<{ events: DashboardCalendarEvent[] }>(
      `calendar?${query.toString()}`,
    );
    setCalendarEvents(response.events);
  }, [calendarFrom, calendarTo]);

  const runSearch = useCallback(async (): Promise<void> => {
    const query = new URLSearchParams({ q: searchQuery, limit: "12" });
    setSearchResults(
      await apiJson<DashboardSearchResponse>(`search?${query.toString()}`),
    );
  }, [searchQuery]);

  const loadAll = useCallback(async (): Promise<void> => {
    setError("");
    setIsLoading(true);
    try {
      await Promise.all([loadOverview(), loadSpecialists(), loadActivity()]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("Failed to load dashboard."),
      );
    } finally {
      setIsLoading(false);
    }
  }, [loadActivity, loadOverview, loadSpecialists, t]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    void loadSnapshot(selectedSpecialistId);
  }, [loadSnapshot, selectedSpecialistId]);

  useEffect(() => {
    if (view === "activity") {
      void loadActivity();
      void loadAuditLog();
    }
    if (view === "calendar") {
      void loadCalendar();
    }
    if (view === "ops") {
      void loadOps();
    }
  }, [loadActivity, loadAuditLog, loadCalendar, loadOps, view]);

  async function mutate(label: string, fn: () => Promise<void>): Promise<void> {
    setNotice("");
    setError("");
    try {
      await fn();
      setNotice(label);
      await Promise.all([
        loadOverview(),
        loadSpecialists(),
        loadSnapshot(selectedSpecialistId),
        loadActivity(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Action failed."));
    }
  }

  async function logout(): Promise<void> {
    await fetch("/api/logout", { method: "POST" });
    window.location.reload();
  }

  function requireSnapshot(): SpecialistSnapshot | null {
    if (!selectedSpecialistId) {
      return null;
    }
    return snapshot;
  }

  function selectSpecialist(id: string, nextView: ViewKey = "settings"): void {
    setSelectedSpecialistId(id);
    setView(nextView);
  }

  function renderOverview(): ReactNode {
    if (!overview) {
      return <EmptyState>{t("No overview data loaded.")}</EmptyState>;
    }
    const maxMonthly = Math.max(
      ...overview.monthlyTrends.map((point) => point.bookings),
      1,
    );
    return (
      <div className={"content-stack"}>
        <div className={"metrics-grid"}>
          <Card
            label={t("Specialists")}
            value={formatNumber(overview.platform.totalSpecialists)}
            detail={`${formatNumber(overview.platform.activeSpecialists)} ${translateStatus(language, "active")}`}
          />
          <Card
            label={t("Bookings, 30d")}
            value={formatNumber(overview.bookings.last30d)}
            detail={`${formatNumber(overview.bookings.statusPending)} ${translateStatus(language, "pending")}`}
          />
          <Card
            label={t("Clients")}
            value={formatNumber(overview.clients.total)}
            detail={`${formatNumber(overview.clients.blocked)} ${translateStatus(language, "blocked")}`}
          />
          <Card
            label={t("Revenue")}
            value={formatNumber(totalRevenue)}
            detail={
              overview.revenueByCurrency
                .map((item) => item.currency)
                .join(", ") || t("No currency")
            }
          />
          <Card
            label={t("Completion")}
            value={formatPercent(
              overview.bookings.total
                ? (overview.bookings.statusCompleted /
                    overview.bookings.total) *
                    100
                : 0,
            )}
          />
          <Card
            label={t("Cancellation")}
            value={formatPercent(overview.bookings.cancellationRate)}
          />
          <Card
            label={t("Recurring")}
            value={formatNumber(overview.recurring.total)}
            detail={`${formatNumber(overview.recurring.pending)} ${translateStatus(language, "pending")}`}
          />
          <Card
            label={t("Referrals")}
            value={formatNumber(
              overview.referrals.referredClients +
                overview.referrals.specialistsWithCode,
            )}
            detail={t("clients and specialists")}
          />
        </div>

        <div className={"metrics-grid compact"}>
          <Card
            label={t("Funnel completion")}
            value={formatPercent(overview.bookingFunnel.completionRate)}
            detail={`${formatNumber(overview.bookingFunnel.completed)} ${translateStatus(language, "completed")} / ${formatNumber(overview.bookingFunnel.created)}`}
          />
          <Card
            label={t("Capacity, 7d")}
            value={formatPercent(overview.capacity.utilizationRate)}
            detail={`${formatNumber(overview.capacity.bookedSlots)} ${translateStatus(language, "active")} ${t("Bookings").toLowerCase()}`}
          />
          <Card
            label={t("Returning clients")}
            value={formatPercent(overview.retention.returningRate)}
            detail={`${formatNumber(overview.retention.repeatClients)} ${t("Returning clients").toLowerCase()}`}
          />
          <Card
            label={t("Reminder queue")}
            value={formatNumber(overview.notificationHealth.remindersPending)}
            detail={`${formatNumber(overview.notificationHealth.remindersSent)} ${t("sent")}`}
          />
        </div>

        <Section title={t("Monthly activity")}>
          <div className={"bar-chart"}>
            {overview.monthlyTrends.map((point) => (
              <div className={"bar-row"} key={point.month}>
                <span>{point.month}</span>
                <div>
                  <b
                    style={{
                      width: `${Math.max(6, (point.bookings / maxMonthly) * 100)}%`,
                    }}
                  />
                </div>
                <strong>{formatNumber(point.bookings)}</strong>
              </div>
            ))}
          </div>
        </Section>

        <div className={"two-col"}>
          <Section title={t("Top by bookings")}>
            <RankList items={overview.topSpecialistsByBookings} />
          </Section>
          <Section title={t("Revenue by currency")}>
            <div className={"compact-list"}>
              {overview.revenueByCurrency.length ? (
                overview.revenueByCurrency.map((item) => (
                  <div key={item.currency}>
                    <span>{item.currency}</span>
                    <strong>{formatNumber(item.revenue)}</strong>
                  </div>
                ))
              ) : (
                <EmptyState>{t("No completed paid bookings yet.")}</EmptyState>
              )}
            </div>
          </Section>
        </div>

        <div className={"two-col"}>
          <Section title={t("Revenue by specialist")}>
            <RevenueLeaderList items={overview.revenueBySpecialist} />
          </Section>
          <Section title={t("Revenue by service")}>
            <RevenueLeaderList items={overview.revenueByService} />
          </Section>
        </div>

        <div className={"two-col"}>
          <Section title={t("Booking funnel")}>
            <NamedValueList
              items={[
                { name: t("Pending"), value: overview.bookingFunnel.pending },
                {
                  name: t("Confirmed"),
                  value: overview.bookingFunnel.confirmed,
                },
                {
                  name: t("Completed"),
                  value: overview.bookingFunnel.completed,
                },
                {
                  name: t("Cancelled"),
                  value: overview.bookingFunnel.cancelled,
                },
                { name: t("Rejected"), value: overview.bookingFunnel.rejected },
              ]}
            />
          </Section>
          <Section title={t("Cancellation sources")}>
            <NamedValueList
              items={[
                {
                  name: t("Client cancelled"),
                  value: overview.cancellations.clientCancelled,
                },
                {
                  name: t("Specialist cancelled"),
                  value: overview.cancellations.specialistCancelled,
                },
                { name: t("Rejected"), value: overview.cancellations.rejected },
              ]}
            />
          </Section>
        </div>

        <div className={"two-col"}>
          <Section title={t("Busiest hours")}>
            <NamedValueList items={overview.capacity.busiestHours} />
          </Section>
          <Section title={t("Cancellation by service")}>
            <NamedValueList items={overview.cancellations.byService} />
          </Section>
        </div>

        <div className={"two-col"}>
          <Section title={t("Cancellation by specialist")}>
            <NamedValueList items={overview.cancellations.bySpecialist} />
          </Section>
          <Section title={t("Recent activity")}>
            <ActivityList events={overview.activity} />
          </Section>
        </div>
      </div>
    );
  }

  function renderSpecialists(): ReactNode {
    return (
      <div className={"content-stack"}>
        <Section
          title={`${t("Specialists")} (${formatNumber(specialistTotal)})`}
          actions={
            <form
              className={"toolbar-form"}
              onSubmit={(event) => {
                event.preventDefault();
                void loadSpecialists();
              }}
            >
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("Search")}
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value={""}>{t("All")}</option>
                <option value={"active"}>{t("Active")}</option>
                <option value={"inactive"}>{t("Inactive")}</option>
                <option value={"deleted"}>{t("Deleted")}</option>
              </select>
              <button type={"submit"}>{t("Apply")}</button>
            </form>
          }
        >
          <div className={"table-wrap"}>
            <table>
              <thead>
                <tr>
                  <th>{t("Name")}</th>
                  <th>{t("Bot")}</th>
                  <th>{t("Telegram ID")}</th>
                  <th>{t("Bookings")}</th>
                  <th>{t("Clients")}</th>
                  <th>{t("Status")}</th>
                  <th>{t("Created")}</th>
                </tr>
              </thead>
              <tbody>
                {specialists.map((specialist) => (
                  <tr
                    key={specialist.id}
                    onClick={() => selectSpecialist(specialist.id)}
                  >
                    <td>
                      <strong>{specialist.name}</strong>
                    </td>
                    <td>
                      {specialist.botUsername
                        ? `@${specialist.botUsername}`
                        : "-"}
                    </td>
                    <td>{specialist.telegramUserId}</td>
                    <td>{formatNumber(specialist.bookingCount)}</td>
                    <td>{formatNumber(specialist.clientCount)}</td>
                    <td>
                      <span
                        className={
                          specialist.deletedAt
                            ? "status status-bad"
                            : specialist.isActive
                              ? "status status-good"
                              : "status status-warn"
                        }
                      >
                        {specialist.deletedAt
                          ? translateStatus(language, "deleted")
                          : specialist.isActive
                            ? translateStatus(language, "active")
                            : translateStatus(language, "inactive")}
                      </span>
                    </td>
                    <td>{formatDate(specialist.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    );
  }

  function renderActivity(): ReactNode {
    return (
      <div className={"content-stack"}>
        <Section
          title={t("Live activity")}
          actions={
            <button onClick={() => void loadActivity()}>{t("Refresh")}</button>
          }
        >
          <ActivityList events={activity} />
        </Section>
        <Section title={t("Audit trail")}>
          <AuditLogTable items={auditLog} />
        </Section>
      </div>
    );
  }

  function renderSearch(): ReactNode {
    return (
      <div className={"content-stack"}>
        <Section title={t("Global search")}>
          <form
            className={"toolbar-form"}
            onSubmit={(event) => {
              event.preventDefault();
              void runSearch();
            }}
          >
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("Specialist, client, booking ID, Telegram ID")}
            />
            <button type={"submit"}>{t("Search")}</button>
          </form>
        </Section>
        {searchResults ? (
          <div className={"three-col"}>
            <Section
              title={`${t("Specialists")} (${formatNumber(searchResults.specialists.length)})`}
            >
              <div className={"compact-list"}>
                {searchResults.specialists.map((item) => (
                  <button
                    className={"result-row"}
                    key={item.id}
                    onClick={() => selectSpecialist(item.id, "settings")}
                  >
                    <span>
                      <strong>{item.name}</strong>
                      {item.botUsername ? ` @${item.botUsername}` : ""}
                    </span>
                    <small>
                      {formatNumber(item.bookingCount)}{" "}
                      {t("Bookings").toLowerCase()}
                    </small>
                  </button>
                ))}
              </div>
            </Section>
            <Section
              title={`${t("Clients")} (${formatNumber(searchResults.clients.length)})`}
            >
              <div className={"compact-list"}>
                {searchResults.clients.map((item) => (
                  <button
                    className={"result-row"}
                    key={item.id}
                    onClick={() =>
                      selectSpecialist(item.specialistId, "clients")
                    }
                  >
                    <span>
                      <strong>{item.displayName || item.name}</strong>
                      {item.telegramUsername
                        ? ` @${item.telegramUsername}`
                        : ""}
                    </span>
                    <small>{item.specialistName}</small>
                  </button>
                ))}
              </div>
            </Section>
            <Section
              title={`${t("Bookings")} (${formatNumber(searchResults.bookings.length)})`}
            >
              <div className={"compact-list"}>
                {searchResults.bookings.map((item) => (
                  <button
                    className={"result-row"}
                    key={item.id}
                    onClick={() =>
                      selectSpecialist(item.specialistId, "bookings")
                    }
                  >
                    <span>
                      <strong>{item.clientName}</strong>
                      {item.serviceName ? ` · ${item.serviceName}` : ""}
                    </span>
                    <small>
                      {formatDateTime(item.startsAt)} ·{" "}
                      {translateStatus(language, item.status)}
                    </small>
                  </button>
                ))}
              </div>
            </Section>
          </div>
        ) : (
          <EmptyState>
            {t("Search across specialists, clients, and bookings.")}
          </EmptyState>
        )}
      </div>
    );
  }

  function renderCalendar(): ReactNode {
    return (
      <div className={"content-stack"}>
        <Section
          title={`${t("Platform calendar")} (${formatNumber(calendarEvents.length)})`}
          actions={
            <form
              className={"toolbar-form"}
              onSubmit={(event) => {
                event.preventDefault();
                void loadCalendar();
              }}
            >
              <input
                type={"date"}
                value={calendarFrom}
                onChange={(event) => setCalendarFrom(event.target.value)}
              />
              <input
                type={"date"}
                value={calendarTo}
                onChange={(event) => setCalendarTo(event.target.value)}
              />
              <button type={"submit"}>{t("Load")}</button>
              <a
                className={"button-link"}
                href={`/api/dashboard/export/bookings.csv?dateFrom=${calendarFrom}&dateTo=${calendarTo}`}
              >
                {t("Export CSV")}
              </a>
            </form>
          }
        >
          <CalendarTable events={calendarEvents} onOpen={selectSpecialist} />
        </Section>
      </div>
    );
  }

  function renderOps(): ReactNode {
    return (
      <div className={"content-stack"}>
        <div className={"metrics-grid compact"}>
          <Card
            label={t("Backend")}
            value={systemStatus?.backendOk ? t("OK") : "-"}
            detail={
              systemStatus?.serverTime
                ? formatDateTime(systemStatus.serverTime)
                : ""
            }
          />
          <Card
            label={t("Database")}
            value={systemStatus?.databaseOk ? t("OK") : t("Check")}
          />
          <Card
            label={t("Telegram auth")}
            value={
              systemStatus?.telegramAuthConfigured ? t("OK") : t("Missing")
            }
          />
          <Card
            label={t("Admins")}
            value={formatNumber(admins?.count ?? 0)}
            detail={admins?.adminIds.join(", ") || t("No ADMIN_IDS loaded")}
          />
        </div>
        <div className={"two-col"}>
          <Section
            title={t("Conflict detector")}
            actions={
              <button onClick={() => void loadOps()}>{t("Refresh")}</button>
            }
          >
            <ConflictList report={conflicts} onOpen={selectSpecialist} />
          </Section>
          <Section title={t("Danger zone")}>
            {selectedSpecialist ? (
              <div className={"cards-list"}>
                <div className={"list-card"}>
                  <div>
                    <strong>{selectedSpecialist.name}</strong>
                    <span>
                      {selectedSpecialist.isActive
                        ? t("Active")
                        : t("Inactive")}{" "}
                      · {t("whole-bot deletion is not available here")}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      void toggleSpecialistState(
                        selectedSpecialist.id,
                        !selectedSpecialist.isActive,
                      )
                    }
                  >
                    {selectedSpecialist.isActive ? t("Disable") : t("Enable")}
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState>
                {t("Select a specialist to manage state.")}
              </EmptyState>
            )}
          </Section>
        </div>
        <Section title={t("Audit log")}>
          <AuditLogTable items={auditLog} />
        </Section>
      </div>
    );
  }

  function renderNeedsSpecialist(
    children: (data: SpecialistSnapshot) => ReactNode,
  ): ReactNode {
    const data = requireSnapshot();
    if (!selectedSpecialistId) {
      return <EmptyState>{t("Select a specialist first.")}</EmptyState>;
    }
    if (isSnapshotLoading || !data) {
      return <EmptyState>{t("Loading specialist data...")}</EmptyState>;
    }
    return children(data);
  }

  function renderBookings(): ReactNode {
    return renderNeedsSpecialist((data) => (
      <div className={"content-stack"}>
        <div className={"metrics-grid compact"}>
          <Card
            label={t("Total")}
            value={formatNumber(data.stats.totalBookings)}
          />
          <Card
            label={t("This month")}
            value={formatNumber(data.stats.bookingsThisMonth)}
          />
          <Card
            label={t("Completion")}
            value={formatPercent(data.stats.completionRate)}
          />
          <Card
            label={t("Revenue")}
            value={`${formatNumber(data.stats.revenueThisMonth)} ${data.stats.revenueCurrency || ""}`}
          />
        </div>
        <Section title={t("Create booking")}>
          <form
            className={"form-grid"}
            onSubmit={(event) => void createBooking(event)}
          >
            <select
              value={bookingForm.clientId}
              onChange={(event) =>
                setBookingForm({ ...bookingForm, clientId: event.target.value })
              }
            >
              <option value={""}>{t("Select client")}</option>
              {data.clients.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.displayName || client.name}
                </option>
              ))}
            </select>
            <select
              value={bookingForm.sessionTypeId}
              onChange={(event) =>
                setBookingForm({
                  ...bookingForm,
                  sessionTypeId: event.target.value,
                })
              }
            >
              <option value={""}>{t("Select service")}</option>
              {data.services
                .filter((service) => service.type !== "")
                .map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
            </select>
            <input
              type={"number"}
              value={bookingForm.duration}
              onChange={(event) =>
                setBookingForm({ ...bookingForm, duration: event.target.value })
              }
              placeholder={t("Duration")}
            />
            <input
              type={"date"}
              value={bookingForm.date}
              onChange={(event) =>
                setBookingForm({ ...bookingForm, date: event.target.value })
              }
            />
            <input
              type={"time"}
              value={bookingForm.time}
              onChange={(event) =>
                setBookingForm({ ...bookingForm, time: event.target.value })
              }
            />
            <input
              value={bookingForm.message}
              onChange={(event) =>
                setBookingForm({ ...bookingForm, message: event.target.value })
              }
              placeholder={t("Message")}
            />
            <button type={"submit"}>{t("Create")}</button>
          </form>
        </Section>
        <Section
          title={`${t("Recent bookings")} (${formatNumber(data.bookings.total)})`}
        >
          <BookingsTable
            bookings={data.bookings.bookings}
            onStatus={updateBookingStatus}
            onReschedule={rescheduleBooking}
          />
        </Section>
      </div>
    ));
  }

  function renderClients(): ReactNode {
    return renderNeedsSpecialist((data) => (
      <div className={"content-stack"}>
        <Section
          title={`${t("Clients")} (${formatNumber(data.clients.total)})`}
        >
          <form
            className={"inline-form"}
            onSubmit={(event) => void createGhostClient(event)}
          >
            <input
              value={ghostName}
              onChange={(event) => setGhostName(event.target.value)}
              placeholder={t("Ghost client name")}
            />
            <button type={"submit"}>{t("Create ghost")}</button>
          </form>
          <div className={"table-wrap"}>
            <table>
              <thead>
                <tr>
                  <th>{t("Name")}</th>
                  <th>{t("Telegram")}</th>
                  <th>{t("Created")}</th>
                  <th>{t("State")}</th>
                  <th>{t("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {data.clients.clients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <strong>{client.displayName || client.name}</strong>
                      {client.isGhost ? <small> {t("ghost")}</small> : null}
                    </td>
                    <td>
                      {client.telegramUsername
                        ? `@${client.telegramUsername}`
                        : client.telegramUserId || "-"}
                    </td>
                    <td>{formatDate(client.createdAt)}</td>
                    <td>
                      <span
                        className={
                          client.isBlocked
                            ? "status status-bad"
                            : "status status-good"
                        }
                      >
                        {client.isBlocked
                          ? translateStatus(language, "blocked")
                          : translateStatus(language, "active")}
                      </span>
                    </td>
                    <td className={"actions-cell"}>
                      <button
                        onClick={() =>
                          void renameClient(
                            client.id,
                            client.displayName || client.name,
                          )
                        }
                      >
                        {t("Rename")}
                      </button>
                      {batchServices.length ? (
                        <button onClick={() => void assignBatch(client.id)}>
                          {t("Batch")}
                        </button>
                      ) : null}
                      {!client.isGhost ? (
                        <button
                          onClick={() =>
                            void setClientBlocked(client.id, !client.isBlocked)
                          }
                        >
                          {client.isBlocked ? t("Unblock") : t("Block")}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    ));
  }

  function renderServices(): ReactNode {
    return renderNeedsSpecialist((data) => (
      <div className={"content-stack"}>
        <Section title={t("Create service")}>
          <form
            className={"form-grid"}
            onSubmit={(event) => void createService(event)}
          >
            <select
              value={serviceForm.type}
              onChange={(event) =>
                setServiceForm({ ...serviceForm, type: event.target.value })
              }
            >
              <option value={"common"}>{t("Common")}</option>
              <option value={"batch"}>{t("Batch")}</option>
            </select>
            <input
              value={serviceForm.name}
              onChange={(event) =>
                setServiceForm({ ...serviceForm, name: event.target.value })
              }
              placeholder={t("Name")}
            />
            <input
              type={"number"}
              value={serviceForm.durationMinutes}
              onChange={(event) =>
                setServiceForm({
                  ...serviceForm,
                  durationMinutes: event.target.value,
                })
              }
              placeholder={t("Minutes")}
            />
            <input
              type={"number"}
              value={serviceForm.price}
              onChange={(event) =>
                setServiceForm({ ...serviceForm, price: event.target.value })
              }
              placeholder={t("Price")}
            />
            <input
              value={serviceForm.currency}
              onChange={(event) =>
                setServiceForm({
                  ...serviceForm,
                  currency: event.target.value.toUpperCase(),
                })
              }
              placeholder={t("Currency")}
            />
            <input
              type={"number"}
              value={serviceForm.sessionsCount}
              onChange={(event) =>
                setServiceForm({
                  ...serviceForm,
                  sessionsCount: event.target.value,
                })
              }
              placeholder={t("Batch sessions")}
            />
            <button type={"submit"}>{t("Create")}</button>
          </form>
        </Section>
        <Section title={t("Services")}>
          <div className={"cards-list"}>
            {data.services.map((service) => (
              <div className={"list-card"} key={service.id}>
                <div>
                  <strong>{service.name}</strong>
                  <span>
                    {t(service.type === "batch" ? "Batch" : "Common")} ·{" "}
                    {service.durationMinutes} {t("min")} ·{" "}
                    {formatNumber(service.price)} {service.currency}
                  </span>
                </div>
                <div className={"actions-cell"}>
                  <button onClick={() => void editService(service)}>
                    {t("Edit")}
                  </button>
                  <button onClick={() => void deleteService(service.id)}>
                    {t("Deactivate")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    ));
  }

  function renderSchedule(): ReactNode {
    return renderNeedsSpecialist((data) => (
      <div className={"content-stack"}>
        <Section title={t("Working hours")}>
          <p className={"muted"}>
            {t("JSON preserves multiple intervals per day.")}
          </p>
          <textarea
            className={"json-editor"}
            value={workingHoursJson}
            onChange={(event) => setWorkingHoursJson(event.target.value)}
          />
          <div className={"actions-row"}>
            <button onClick={() => void saveWorkingHours()}>
              {t("Save working hours")}
            </button>
          </div>
        </Section>
        <Section title={t("Days off")}>
          <form
            className={"inline-form"}
            onSubmit={(event) => void createDayOff(event)}
          >
            <input
              type={"date"}
              value={dayOffDate}
              onChange={(event) => setDayOffDate(event.target.value)}
            />
            <input
              value={dayOffReason}
              onChange={(event) => setDayOffReason(event.target.value)}
              placeholder={t("Reason")}
            />
            <button type={"submit"}>{t("Add day off")}</button>
          </form>
          <div className={"cards-list"}>
            {data.schedule.daysOff.map((day) => (
              <div className={"list-card"} key={day.id}>
                <div>
                  <strong>{formatDate(day.date)}</strong>
                  <span>{day.reason || t("No reason")}</span>
                </div>
                <button onClick={() => void deleteDayOff(day.id)}>
                  {t("Delete")}
                </button>
              </div>
            ))}
          </div>
        </Section>
      </div>
    ));
  }

  function renderRecurring(): ReactNode {
    return renderNeedsSpecialist((data) => (
      <Section
        title={`${t("Recurring schedules")} (${formatNumber(data.recurring.length)})`}
      >
        <div className={"table-wrap"}>
          <table>
            <thead>
              <tr>
                <th>{t("Client")}</th>
                <th>{t("Days")}</th>
                <th>{t("Time")}</th>
                <th>{t("Service")}</th>
                <th>{t("Status")}</th>
                <th>{t("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {data.recurring.map((schedule) => (
                <tr key={schedule.id}>
                  <td>{schedule.clientDisplayName || schedule.clientName}</td>
                  <td>
                    {schedule.daysOfWeek ||
                      weekdayName(language, schedule.dayOfWeek)}
                  </td>
                  <td>{schedule.time}</td>
                  <td>
                    {schedule.sessionType?.name ||
                      `${schedule.durationMinutes} ${t("min")}`}
                  </td>
                  <td>
                    <span className={statusClass(schedule.status)}>
                      {translateStatus(language, schedule.status)}
                    </span>
                  </td>
                  <td className={"actions-cell"}>
                    {schedule.status === "pending" ? (
                      <button
                        onClick={() =>
                          void recurringAction(schedule.id, "approve")
                        }
                      >
                        {t("Approve")}
                      </button>
                    ) : null}
                    {schedule.status === "pending" ? (
                      <button
                        onClick={() =>
                          void recurringAction(schedule.id, "decline")
                        }
                      >
                        {t("Decline")}
                      </button>
                    ) : null}
                    {schedule.status !== "cancelled" ? (
                      <button onClick={() => void deleteRecurring(schedule.id)}>
                        {t("Cancel")}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    ));
  }

  function renderReferrals(): ReactNode {
    return renderNeedsSpecialist((data) => (
      <div className={"content-stack"}>
        <div className={"metrics-grid compact"}>
          <Card label={t("Code")} value={data.referrals.code || "-"} />
          <Card
            label={t("Client referrals")}
            value={formatNumber(data.referrals.count)}
          />
          <Card
            label={t("Specialist referrals")}
            value={formatNumber(data.referrals.specialistCount)}
          />
          <Card
            label={t("Active referred specialists")}
            value={formatNumber(data.referrals.activeCount)}
          />
        </div>
        <Section title={t("Referral link")}>
          <a
            className={"text-link"}
            href={data.referrals.link}
            target={"_blank"}
            rel={"noreferrer"}
          >
            {data.referrals.link}
          </a>
        </Section>
        <div className={"two-col"}>
          <Section title={t("Referred clients")}>
            <ReferralClientList data={data} />
          </Section>
          <Section title={t("Referred specialists")}>
            <ReferralSpecialistList data={data} />
          </Section>
        </div>
      </div>
    ));
  }

  function renderSettings(): ReactNode {
    return renderNeedsSpecialist(() => (
      <div className={"content-stack"}>
        <Section title={t("Profile")}>
          <form
            className={"form-grid"}
            onSubmit={(event) => void saveProfile(event)}
          >
            <input
              value={profileForm.name ?? ""}
              onChange={(event) =>
                setProfileForm({ ...profileForm, name: event.target.value })
              }
              placeholder={t("Name")}
            />
            <input
              value={profileForm.telegramHandle ?? ""}
              onChange={(event) =>
                setProfileForm({
                  ...profileForm,
                  telegramHandle: event.target.value,
                })
              }
              placeholder={t("Telegram handle")}
            />
            <input
              value={profileForm.phone ?? ""}
              onChange={(event) =>
                setProfileForm({ ...profileForm, phone: event.target.value })
              }
              placeholder={t("Phone")}
            />
            <input
              value={profileForm.specialization ?? ""}
              onChange={(event) =>
                setProfileForm({
                  ...profileForm,
                  specialization: event.target.value,
                })
              }
              placeholder={t("Specialization")}
            />
            <input
              value={profileForm.photoUrl ?? ""}
              onChange={(event) =>
                setProfileForm({ ...profileForm, photoUrl: event.target.value })
              }
              placeholder={t("Photo URL or file id")}
            />
            <select
              value={profileForm.language ?? "ru"}
              onChange={(event) =>
                setProfileForm({ ...profileForm, language: event.target.value })
              }
            >
              <option value={"ru"}>{t("Russian")}</option>
              <option value={"en"}>{t("English")}</option>
            </select>
            <textarea
              value={profileForm.bio ?? ""}
              onChange={(event) =>
                setProfileForm({ ...profileForm, bio: event.target.value })
              }
              placeholder={t("Bio")}
            />
            <button type={"submit"}>{t("Save profile")}</button>
          </form>
        </Section>
        <Section title={t("Notifications")}>
          <div className={"toggle-row"}>
            <label>
              <input
                type={"checkbox"}
                checked={notifications.notifyNewBookings}
                onChange={(event) =>
                  setNotifications({
                    ...notifications,
                    notifyNewBookings: event.target.checked,
                  })
                }
              />
              {t("New bookings")}
            </label>
            <label>
              <input
                type={"checkbox"}
                checked={notifications.notifyCancellations}
                onChange={(event) =>
                  setNotifications({
                    ...notifications,
                    notifyCancellations: event.target.checked,
                  })
                }
              />
              {t("Cancellations")}
            </label>
            <button onClick={() => void saveNotifications()}>
              {t("Save notifications")}
            </button>
          </div>
        </Section>
      </div>
    ));
  }

  async function updateBookingStatus(
    booking: Booking,
    status: string,
  ): Promise<void> {
    const reason =
      status === "rejected" || status === "cancelled"
        ? window.prompt(t("Reason"), "") || undefined
        : undefined;
    await mutate(t("Booking updated."), async () => {
      await apiJson(
        `specialists/${selectedSpecialistId}/bookings/${booking.id}/status`,
        {
          method: "PUT",
          body: JSON.stringify({ status, reason }),
        },
      );
    });
  }

  async function rescheduleBooking(booking: Booking): Promise<void> {
    const date = window.prompt(
      t("New date YYYY-MM-DD"),
      booking.startsAt.slice(0, 10),
    );
    if (!date) {
      return;
    }
    const time = window.prompt(t("New time HH:MM"), "10:00");
    if (!time) {
      return;
    }
    await mutate(t("Booking rescheduled."), async () => {
      await apiJson(
        `specialists/${selectedSpecialistId}/bookings/${booking.id}/reschedule`,
        {
          method: "PUT",
          body: JSON.stringify({ date, time }),
        },
      );
    });
  }

  async function createBooking(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    await mutate(t("Booking created."), async () => {
      await apiJson(`specialists/${selectedSpecialistId}/bookings`, {
        method: "POST",
        body: JSON.stringify({
          clientId: bookingForm.clientId,
          sessionTypeId: bookingForm.sessionTypeId || undefined,
          duration: Number(bookingForm.duration),
          date: bookingForm.date,
          time: bookingForm.time,
          message: bookingForm.message || undefined,
        }),
      });
    });
  }

  async function createGhostClient(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (!ghostName.trim()) {
      return;
    }
    await mutate(t("Client created."), async () => {
      await apiJson(`specialists/${selectedSpecialistId}/clients`, {
        method: "POST",
        body: JSON.stringify({ name: ghostName.trim() }),
      });
      setGhostName("");
    });
  }

  async function renameClient(
    clientId: string,
    currentName: string,
  ): Promise<void> {
    const name = window.prompt(t("Client display name"), currentName);
    if (!name) {
      return;
    }
    await mutate(t("Client renamed."), async () => {
      await apiJson(`specialists/${selectedSpecialistId}/clients/${clientId}`, {
        method: "PUT",
        body: JSON.stringify({ name }),
      });
    });
  }

  async function setClientBlocked(
    clientId: string,
    blocked: boolean,
  ): Promise<void> {
    const cancelBookings = blocked
      ? window.confirm(
          t("Cancel active bookings and recurring schedules for this client?"),
        )
      : false;
    await mutate(
      blocked ? t("Client blocked.") : t("Client unblocked."),
      async () => {
        await apiJson(
          `specialists/${selectedSpecialistId}/clients/${clientId}/block`,
          {
            method: "PUT",
            body: JSON.stringify({ blocked, cancelBookings }),
          },
        );
      },
    );
  }

  async function assignBatch(clientId: string): Promise<void> {
    const serviceId = window.prompt(
      t("Batch service ID"),
      batchServices[0]?.id ?? "",
    );
    if (!serviceId) {
      return;
    }
    await mutate(t("Batch assigned."), async () => {
      await apiJson(
        `specialists/${selectedSpecialistId}/clients/${clientId}/batches`,
        {
          method: "POST",
          body: JSON.stringify({ serviceId }),
        },
      );
    });
  }

  async function createService(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    await mutate(t("Service created."), async () => {
      await apiJson(`specialists/${selectedSpecialistId}/services`, {
        method: "POST",
        body: JSON.stringify({
          type: serviceForm.type,
          name: serviceForm.name,
          durationMinutes: Number(serviceForm.durationMinutes),
          price: Number(serviceForm.price),
          currency: serviceForm.currency || "RUB",
          sessionsCount:
            serviceForm.type === "batch"
              ? Number(serviceForm.sessionsCount)
              : undefined,
        }),
      });
      setServiceForm({ ...serviceForm, name: "", price: "0" });
    });
  }

  async function editService(service: SessionType): Promise<void> {
    const name = window.prompt(t("Service name"), service.name);
    if (!name) {
      return;
    }
    const price = window.prompt(t("Price"), String(service.price));
    if (price == null) {
      return;
    }
    await mutate(t("Service updated."), async () => {
      await apiJson(
        `specialists/${selectedSpecialistId}/services/${service.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ name, price: Number(price) }),
        },
      );
    });
  }

  async function deleteService(serviceId: string): Promise<void> {
    if (!window.confirm(t("Deactivate this service?"))) {
      return;
    }
    await mutate(t("Service deactivated."), async () => {
      await apiEmpty(
        `specialists/${selectedSpecialistId}/services/${serviceId}`,
        { method: "DELETE" },
      );
    });
  }

  async function saveWorkingHours(): Promise<void> {
    const hours = JSON.parse(workingHoursJson) as unknown;
    await mutate(t("Working hours saved."), async () => {
      await apiJson(`specialists/${selectedSpecialistId}/working-hours`, {
        method: "PUT",
        body: JSON.stringify({ hours }),
      });
    });
  }

  async function createDayOff(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (!dayOffDate) {
      return;
    }
    await mutate(t("Day off added."), async () => {
      await apiJson(`specialists/${selectedSpecialistId}/days-off/batch`, {
        method: "POST",
        body: JSON.stringify({
          dates: [dayOffDate],
          reason: dayOffReason || undefined,
        }),
      });
      setDayOffDate("");
      setDayOffReason("");
    });
  }

  async function deleteDayOff(dayOffId: string): Promise<void> {
    await mutate(t("Day off deleted."), async () => {
      await apiEmpty(
        `specialists/${selectedSpecialistId}/days-off/${dayOffId}`,
        { method: "DELETE" },
      );
    });
  }

  async function recurringAction(
    id: string,
    action: "approve" | "decline",
  ): Promise<void> {
    await mutate(t("Recurring schedule updated."), async () => {
      await apiJson(
        `specialists/${selectedSpecialistId}/recurring/${id}/${action}`,
        { method: "PUT" },
      );
    });
  }

  async function deleteRecurring(id: string): Promise<void> {
    if (!window.confirm(t("Cancel this recurring schedule?"))) {
      return;
    }
    await mutate(t("Recurring schedule cancelled."), async () => {
      await apiEmpty(`specialists/${selectedSpecialistId}/recurring/${id}`, {
        method: "DELETE",
      });
    });
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await mutate(t("Profile saved."), async () => {
      await apiJson(`specialists/${selectedSpecialistId}/profile`, {
        method: "PUT",
        body: JSON.stringify(profileForm),
      });
    });
  }

  async function saveNotifications(): Promise<void> {
    await mutate(t("Notifications saved."), async () => {
      await apiJson(`specialists/${selectedSpecialistId}/notifications`, {
        method: "PUT",
        body: JSON.stringify(notifications),
      });
    });
  }

  async function toggleSpecialistState(
    specialistId: string,
    active: boolean,
  ): Promise<void> {
    if (
      !window.confirm(
        active
          ? t("Enable this specialist bot?")
          : t("Disable this specialist bot? Existing data stays in place."),
      )
    ) {
      return;
    }
    await mutate(
      active ? t("Specialist enabled.") : t("Specialist disabled."),
      async () => {
        await apiJson(`specialists/${specialistId}/state`, {
          method: "PATCH",
          body: JSON.stringify({ active }),
        });
        if (!active && selectedSpecialistId === specialistId) {
          setView("specialists");
        }
      },
    );
    await loadOps();
  }

  const content = (() => {
    switch (view) {
      case "overview":
        return renderOverview();
      case "specialists":
        return renderSpecialists();
      case "activity":
        return renderActivity();
      case "search":
        return renderSearch();
      case "calendar":
        return renderCalendar();
      case "bookings":
        return renderBookings();
      case "clients":
        return renderClients();
      case "recurring":
        return renderRecurring();
      case "services":
        return renderServices();
      case "schedule":
        return renderSchedule();
      case "referrals":
        return renderReferrals();
      case "ops":
        return renderOps();
      case "settings":
        return renderSettings();
    }
  })();
  const currentNavLabel =
    navItems.find((item) => item.key === view)?.label ?? "Overview";

  return (
    <div className={"dashboard-shell"}>
      <aside className={"sidebar"}>
        <div className={"brand-block"}>
          <span>{t("Scheduler")}</span>
          <strong>{t("Owner dashboard")}</strong>
        </div>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.key}
              className={view === item.key ? "active" : ""}
              disabled={item.needsSpecialist && !selectedSpecialistId}
              onClick={() => setView(item.key)}
            >
              {t(item.label)}
            </button>
          ))}
        </nav>
        <button className={"logout-button"} onClick={() => void logout()}>
          {t("Log out")}
        </button>
      </aside>
      <main className={"dashboard-main"}>
        <header className={"topbar"}>
          <div>
            <p className={"eyebrow"}>
              {initialUser.username
                ? `@${initialUser.username}`
                : `Telegram ID ${initialUser.id}`}
            </p>
            <h1>
              {view === "overview"
                ? t("Platform overview")
                : t(currentNavLabel)}
            </h1>
          </div>
          <div className={"topbar-actions"}>
            <LanguageSwitch />
            <div className={"selected-specialist"}>
              <span>{t("Selected specialist")}</span>
              <select
                value={selectedSpecialistId}
                onChange={(event) =>
                  setSelectedSpecialistId(event.target.value)
                }
              >
                <option value={""}>{t("None")}</option>
                {specialists.map((specialist) => (
                  <option key={specialist.id} value={specialist.id}>
                    {specialist.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>
        {selectedSpecialist ? (
          <div className={"context-strip"}>
            {selectedSpecialist.name}{" "}
            {selectedSpecialist.botUsername
              ? `@${selectedSpecialist.botUsername}`
              : ""}
          </div>
        ) : null}
        {error ? <div className={"error-box"}>{error}</div> : null}
        {notice ? <div className={"notice-box"}>{notice}</div> : null}
        {isLoading ? (
          <EmptyState>{t("Loading dashboard...")}</EmptyState>
        ) : (
          content
        )}
      </main>
    </div>
  );
}

function RankList({
  items,
}: {
  items: Array<{ name: string; botUsername: string; value: number }>;
}): ReactNode {
  const { t } = useDashboardI18n();
  if (!items.length) {
    return <EmptyState>{t("No data yet.")}</EmptyState>;
  }
  return (
    <div className={"compact-list"}>
      {items.map((item, index) => (
        <div key={`${item.name}-${index}`}>
          <span>
            {index + 1}. {item.name}
            {item.botUsername ? ` @${item.botUsername}` : ""}
          </span>
          <strong>{formatNumber(item.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function NamedValueList({ items }: { items: OwnerNamedValue[] }): ReactNode {
  const { t } = useDashboardI18n();
  if (!items.length) {
    return <EmptyState>{t("No data yet.")}</EmptyState>;
  }
  return (
    <div className={"compact-list"}>
      {items.map((item) => (
        <div key={item.name}>
          <span>{item.name}</span>
          <strong>{formatNumber(item.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function RevenueLeaderList({
  items,
}: {
  items: OwnerRevenueLeader[];
}): ReactNode {
  const { t } = useDashboardI18n();
  if (!items.length) {
    return <EmptyState>{t("No revenue yet.")}</EmptyState>;
  }
  return (
    <div className={"compact-list"}>
      {items.map((item, index) => (
        <div key={`${item.name}-${item.currency}-${index}`}>
          <span>
            {item.name}
            {item.botUsername ? ` @${item.botUsername}` : ""}
          </span>
          <strong>
            {formatNumber(item.revenue)} {item.currency}
          </strong>
        </div>
      ))}
    </div>
  );
}

function ActivityList({ events }: { events: OwnerActivityEvent[] }): ReactNode {
  const { language, t } = useDashboardI18n();
  if (!events.length) {
    return <EmptyState>{t("No activity yet.")}</EmptyState>;
  }
  return (
    <div className={"activity-list"}>
      {events.map((event) => (
        <div className={"activity-item"} key={event.id}>
          <div>
            <strong>{t(event.title)}</strong>
            <span>
              {event.detail ? t(event.detail) : event.entityType || t("Event")}
              {event.specialistName ? ` · ${event.specialistName}` : ""}
            </span>
          </div>
          <div>
            {event.status ? (
              <span className={statusClass(event.status)}>
                {translateStatus(language, event.status)}
              </span>
            ) : null}
            <small>{formatDateTime(event.occurredAt)}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditLogTable({
  items,
}: {
  items: DashboardAuditLogItem[];
}): ReactNode {
  const { t } = useDashboardI18n();
  if (!items.length) {
    return <EmptyState>{t("No dashboard actions recorded yet.")}</EmptyState>;
  }
  return (
    <div className={"table-wrap"}>
      <table>
        <thead>
          <tr>
            <th>{t("Time")}</th>
            <th>{t("Actor")}</th>
            <th>{t("Action")}</th>
            <th>{t("Specialist")}</th>
            <th>{t("Status")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{formatDateTime(item.createdAt)}</td>
              <td>{item.actorTelegramId}</td>
              <td>
                <strong>{item.method}</strong>
                <small>{item.path}</small>
              </td>
              <td>{item.specialistName || item.specialistId || "-"}</td>
              <td>
                <span
                  className={
                    item.statusCode < 400
                      ? "status status-good"
                      : "status status-bad"
                  }
                >
                  {item.statusCode}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CalendarTable({
  events,
  onOpen,
}: {
  events: DashboardCalendarEvent[];
  onOpen: (id: string, view?: ViewKey) => void;
}): ReactNode {
  const { language, t } = useDashboardI18n();
  if (!events.length) {
    return <EmptyState>{t("No bookings in this range.")}</EmptyState>;
  }
  return (
    <div className={"table-wrap"}>
      <table>
        <thead>
          <tr>
            <th>{t("Time")}</th>
            <th>{t("Specialist")}</th>
            <th>{t("Client")}</th>
            <th>{t("Service")}</th>
            <th>{t("Status")}</th>
            <th>{t("Open")}</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.bookingId}>
              <td>
                <strong>{formatDateTime(event.startsAt)}</strong>
                <small>{formatDateTime(event.endsAt)}</small>
              </td>
              <td>
                {event.specialistName}
                {event.botUsername ? <small>@{event.botUsername}</small> : null}
              </td>
              <td>{event.clientName}</td>
              <td>{event.serviceName || "-"}</td>
              <td>
                <span className={statusClass(event.status)}>
                  {translateStatus(language, event.status)}
                </span>
              </td>
              <td>
                <button onClick={() => onOpen(event.specialistId, "bookings")}>
                  {shortID(event.bookingId)}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConflictList({
  report,
  onOpen,
}: {
  report: DashboardConflictReport | null;
  onOpen: (id: string, view?: ViewKey) => void;
}): ReactNode {
  const { language, t } = useDashboardI18n();
  if (!report) {
    return <EmptyState>{t("Loading checks...")}</EmptyState>;
  }
  if (
    !report.overlappingBookings.length &&
    !report.invalidWorkingHours.length
  ) {
    return <EmptyState>{t("No conflicts detected.")}</EmptyState>;
  }
  return (
    <div className={"cards-list"}>
      {report.overlappingBookings.map((item) => (
        <div
          className={"list-card"}
          key={`${item.firstBookingId}-${item.secondBookingId}`}
        >
          <div>
            <strong>{item.specialistName}</strong>
            <span>
              {item.firstClient} {t("overlaps")} {item.secondClient} ·{" "}
              {formatDateTime(item.startsAt)}
            </span>
          </div>
          <button onClick={() => onOpen(item.specialistId, "bookings")}>
            {t("Open")}
          </button>
        </div>
      ))}
      {report.invalidWorkingHours.map((item, index) => (
        <div
          className={"list-card"}
          key={`${item.specialistId}-${item.dayOfWeek}-${index}`}
        >
          <div>
            <strong>{item.specialistName}</strong>
            <span>
              {weekdayName(language, item.dayOfWeek)} {item.startTime}-
              {item.endTime} · {t(item.reason)}
            </span>
          </div>
          <button onClick={() => onOpen(item.specialistId, "schedule")}>
            {t("Open")}
          </button>
        </div>
      ))}
    </div>
  );
}

function BookingsTable({
  bookings,
  onStatus,
  onReschedule,
}: {
  bookings: Booking[];
  onStatus: (booking: Booking, status: string) => Promise<void>;
  onReschedule: (booking: Booking) => Promise<void>;
}): ReactNode {
  const { language, t } = useDashboardI18n();
  return (
    <div className={"table-wrap"}>
      <table>
        <thead>
          <tr>
            <th>{t("Client")}</th>
            <th>{t("Time")}</th>
            <th>{t("Service")}</th>
            <th>{t("Status")}</th>
            <th>{t("Actions")}</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr key={booking.id}>
              <td>
                <strong>
                  {booking.clientDisplayName || booking.clientName}
                </strong>
                <small>{booking.clientMessage || ""}</small>
              </td>
              <td>{formatDateTime(booking.startsAt)}</td>
              <td>
                {booking.sessionType?.name ||
                  `${booking.durationMinutes ?? "-"} ${t("min")}`}
              </td>
              <td>
                <span className={statusClass(booking.status)}>
                  {translateStatus(language, booking.status)}
                </span>
              </td>
              <td className={"actions-cell"}>
                {booking.status === "pending" &&
                booking.createdBy !== "specialist" ? (
                  <button onClick={() => void onStatus(booking, "confirmed")}>
                    {t("Confirm")}
                  </button>
                ) : null}
                {booking.status === "pending" ? (
                  <button onClick={() => void onStatus(booking, "rejected")}>
                    {t("Reject")}
                  </button>
                ) : null}
                {booking.status === "pending" ||
                booking.status === "confirmed" ? (
                  <button onClick={() => void onReschedule(booking)}>
                    {t("Move")}
                  </button>
                ) : null}
                {booking.status === "confirmed" ? (
                  <button onClick={() => void onStatus(booking, "completed")}>
                    {t("Complete")}
                  </button>
                ) : null}
                {booking.status === "pending" ||
                booking.status === "confirmed" ? (
                  <button onClick={() => void onStatus(booking, "cancelled")}>
                    {t("Cancel")}
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReferralClientList({ data }: { data: SpecialistSnapshot }): ReactNode {
  const { t } = useDashboardI18n();
  if (!data.referrals.referrals.length) {
    return <EmptyState>{t("No referred clients yet.")}</EmptyState>;
  }
  return (
    <div className={"compact-list"}>
      {data.referrals.referrals.map((item) => (
        <div key={item.id}>
          <span>{item.displayName || item.name}</span>
          <strong>{formatDate(item.createdAt)}</strong>
        </div>
      ))}
    </div>
  );
}

function ReferralSpecialistList({
  data,
}: {
  data: SpecialistSnapshot;
}): ReactNode {
  const { language, t } = useDashboardI18n();
  if (!data.referrals.specialists.length) {
    return <EmptyState>{t("No referred specialists yet.")}</EmptyState>;
  }
  return (
    <div className={"compact-list"}>
      {data.referrals.specialists.map((item) => (
        <div key={item.id}>
          <span>
            {item.name} @{item.botUsername}
          </span>
          <strong>
            {translateStatus(language, item.isActive ? "active" : "passive")}
          </strong>
        </div>
      ))}
    </div>
  );
}
