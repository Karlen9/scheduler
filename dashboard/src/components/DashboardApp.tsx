"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value || 0)}%`;
}

function formatDateTime(value?: string): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-US", {
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
  return new Intl.DateTimeFormat("en-US", {
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

export function DashboardApp({
  initialUser,
}: {
  initialUser: DashboardUser;
}): ReactNode {
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
        err instanceof Error ? err.message : "Failed to load dashboard.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [loadActivity, loadOverview, loadSpecialists]);

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
      setError(err instanceof Error ? err.message : "Action failed.");
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
      return <EmptyState>{"No overview data loaded."}</EmptyState>;
    }
    const maxMonthly = Math.max(
      ...overview.monthlyTrends.map((point) => point.bookings),
      1,
    );
    return (
      <div className={"content-stack"}>
        <div className={"metrics-grid"}>
          <Card
            label={"Specialists"}
            value={formatNumber(overview.platform.totalSpecialists)}
            detail={`${overview.platform.activeSpecialists} active`}
          />
          <Card
            label={"Bookings, 30d"}
            value={formatNumber(overview.bookings.last30d)}
            detail={`${overview.bookings.statusPending} pending`}
          />
          <Card
            label={"Clients"}
            value={formatNumber(overview.clients.total)}
            detail={`${overview.clients.blocked} blocked`}
          />
          <Card
            label={"Revenue"}
            value={formatNumber(totalRevenue)}
            detail={
              overview.revenueByCurrency
                .map((item) => item.currency)
                .join(", ") || "No currency"
            }
          />
          <Card
            label={"Completion"}
            value={formatPercent(
              overview.bookings.total
                ? (overview.bookings.statusCompleted /
                    overview.bookings.total) *
                    100
                : 0,
            )}
          />
          <Card
            label={"Cancellation"}
            value={formatPercent(overview.bookings.cancellationRate)}
          />
          <Card
            label={"Recurring"}
            value={formatNumber(overview.recurring.total)}
            detail={`${overview.recurring.pending} pending`}
          />
          <Card
            label={"Referrals"}
            value={formatNumber(
              overview.referrals.referredClients +
                overview.referrals.specialistsWithCode,
            )}
            detail={"clients and specialists"}
          />
        </div>

        <div className={"metrics-grid compact"}>
          <Card
            label={"Funnel completion"}
            value={formatPercent(overview.bookingFunnel.completionRate)}
            detail={`${formatNumber(overview.bookingFunnel.completed)} completed of ${formatNumber(overview.bookingFunnel.created)}`}
          />
          <Card
            label={"Capacity, 7d"}
            value={formatPercent(overview.capacity.utilizationRate)}
            detail={`${formatNumber(overview.capacity.bookedSlots)} active bookings`}
          />
          <Card
            label={"Returning clients"}
            value={formatPercent(overview.retention.returningRate)}
            detail={`${formatNumber(overview.retention.repeatClients)} repeat clients`}
          />
          <Card
            label={"Reminder queue"}
            value={formatNumber(overview.notificationHealth.remindersPending)}
            detail={`${formatNumber(overview.notificationHealth.remindersSent)} sent`}
          />
        </div>

        <Section title={"Monthly activity"}>
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
          <Section title={"Top by bookings"}>
            <RankList items={overview.topSpecialistsByBookings} />
          </Section>
          <Section title={"Revenue by currency"}>
            <div className={"compact-list"}>
              {overview.revenueByCurrency.length ? (
                overview.revenueByCurrency.map((item) => (
                  <div key={item.currency}>
                    <span>{item.currency}</span>
                    <strong>{formatNumber(item.revenue)}</strong>
                  </div>
                ))
              ) : (
                <EmptyState>{"No completed paid bookings yet."}</EmptyState>
              )}
            </div>
          </Section>
        </div>

        <div className={"two-col"}>
          <Section title={"Revenue by specialist"}>
            <RevenueLeaderList items={overview.revenueBySpecialist} />
          </Section>
          <Section title={"Revenue by service"}>
            <RevenueLeaderList items={overview.revenueByService} />
          </Section>
        </div>

        <div className={"two-col"}>
          <Section title={"Booking funnel"}>
            <NamedValueList
              items={[
                { name: "Pending", value: overview.bookingFunnel.pending },
                { name: "Confirmed", value: overview.bookingFunnel.confirmed },
                { name: "Completed", value: overview.bookingFunnel.completed },
                { name: "Cancelled", value: overview.bookingFunnel.cancelled },
                { name: "Rejected", value: overview.bookingFunnel.rejected },
              ]}
            />
          </Section>
          <Section title={"Cancellation sources"}>
            <NamedValueList
              items={[
                {
                  name: "Client cancelled",
                  value: overview.cancellations.clientCancelled,
                },
                {
                  name: "Specialist cancelled",
                  value: overview.cancellations.specialistCancelled,
                },
                { name: "Rejected", value: overview.cancellations.rejected },
              ]}
            />
          </Section>
        </div>

        <div className={"two-col"}>
          <Section title={"Busiest hours"}>
            <NamedValueList items={overview.capacity.busiestHours} />
          </Section>
          <Section title={"Cancellation by service"}>
            <NamedValueList items={overview.cancellations.byService} />
          </Section>
        </div>

        <div className={"two-col"}>
          <Section title={"Cancellation by specialist"}>
            <NamedValueList items={overview.cancellations.bySpecialist} />
          </Section>
          <Section title={"Recent activity"}>
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
          title={`Specialists (${formatNumber(specialistTotal)})`}
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
                placeholder={"Search"}
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value={""}>{"All"}</option>
                <option value={"active"}>{"Active"}</option>
                <option value={"inactive"}>{"Inactive"}</option>
                <option value={"deleted"}>{"Deleted"}</option>
              </select>
              <button type={"submit"}>{"Apply"}</button>
            </form>
          }
        >
          <div className={"table-wrap"}>
            <table>
              <thead>
                <tr>
                  <th>{"Name"}</th>
                  <th>{"Bot"}</th>
                  <th>{"Telegram ID"}</th>
                  <th>{"Bookings"}</th>
                  <th>{"Clients"}</th>
                  <th>{"Status"}</th>
                  <th>{"Created"}</th>
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
                          ? "deleted"
                          : specialist.isActive
                            ? "active"
                            : "inactive"}
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
          title={"Live activity"}
          actions={
            <button onClick={() => void loadActivity()}>{"Refresh"}</button>
          }
        >
          <ActivityList events={activity} />
        </Section>
        <Section title={"Audit trail"}>
          <AuditLogTable items={auditLog} />
        </Section>
      </div>
    );
  }

  function renderSearch(): ReactNode {
    return (
      <div className={"content-stack"}>
        <Section title={"Global search"}>
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
              placeholder={"Specialist, client, booking ID, Telegram ID"}
            />
            <button type={"submit"}>{"Search"}</button>
          </form>
        </Section>
        {searchResults ? (
          <div className={"three-col"}>
            <Section
              title={`Specialists (${searchResults.specialists.length})`}
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
                    <small>{formatNumber(item.bookingCount)} bookings</small>
                  </button>
                ))}
              </div>
            </Section>
            <Section title={`Clients (${searchResults.clients.length})`}>
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
            <Section title={`Bookings (${searchResults.bookings.length})`}>
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
                      {formatDateTime(item.startsAt)} · {item.status}
                    </small>
                  </button>
                ))}
              </div>
            </Section>
          </div>
        ) : (
          <EmptyState>
            {"Search across specialists, clients, and bookings."}
          </EmptyState>
        )}
      </div>
    );
  }

  function renderCalendar(): ReactNode {
    return (
      <div className={"content-stack"}>
        <Section
          title={`Platform calendar (${formatNumber(calendarEvents.length)})`}
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
              <button type={"submit"}>{"Load"}</button>
              <a
                className={"button-link"}
                href={`/api/dashboard/export/bookings.csv?dateFrom=${calendarFrom}&dateTo=${calendarTo}`}
              >
                {"Export CSV"}
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
            label={"Backend"}
            value={systemStatus?.backendOk ? "OK" : "-"}
            detail={
              systemStatus?.serverTime
                ? formatDateTime(systemStatus.serverTime)
                : ""
            }
          />
          <Card
            label={"Database"}
            value={systemStatus?.databaseOk ? "OK" : "Check"}
          />
          <Card
            label={"Telegram auth"}
            value={systemStatus?.telegramAuthConfigured ? "OK" : "Missing"}
          />
          <Card
            label={"Admins"}
            value={formatNumber(admins?.count ?? 0)}
            detail={admins?.adminIds.join(", ") || "No ADMIN_IDS loaded"}
          />
        </div>
        <div className={"two-col"}>
          <Section
            title={"Conflict detector"}
            actions={
              <button onClick={() => void loadOps()}>{"Refresh"}</button>
            }
          >
            <ConflictList report={conflicts} onOpen={selectSpecialist} />
          </Section>
          <Section title={"Danger zone"}>
            {selectedSpecialist ? (
              <div className={"cards-list"}>
                <div className={"list-card"}>
                  <div>
                    <strong>{selectedSpecialist.name}</strong>
                    <span>
                      {selectedSpecialist.isActive ? "Active" : "Inactive"} ·
                      whole-bot deletion is not available here
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
                    {selectedSpecialist.isActive ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState>{"Select a specialist to manage state."}</EmptyState>
            )}
          </Section>
        </div>
        <Section title={"Audit log"}>
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
      return <EmptyState>{"Select a specialist first."}</EmptyState>;
    }
    if (isSnapshotLoading || !data) {
      return <EmptyState>{"Loading specialist data..."}</EmptyState>;
    }
    return children(data);
  }

  function renderBookings(): ReactNode {
    return renderNeedsSpecialist((data) => (
      <div className={"content-stack"}>
        <div className={"metrics-grid compact"}>
          <Card
            label={"Total"}
            value={formatNumber(data.stats.totalBookings)}
          />
          <Card
            label={"This month"}
            value={formatNumber(data.stats.bookingsThisMonth)}
          />
          <Card
            label={"Completion"}
            value={formatPercent(data.stats.completionRate)}
          />
          <Card
            label={"Revenue"}
            value={`${formatNumber(data.stats.revenueThisMonth)} ${data.stats.revenueCurrency || ""}`}
          />
        </div>
        <Section title={"Create booking"}>
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
              <option value={""}>{"Select client"}</option>
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
              <option value={""}>{"Select service"}</option>
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
              placeholder={"Duration"}
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
              placeholder={"Message"}
            />
            <button type={"submit"}>{"Create"}</button>
          </form>
        </Section>
        <Section
          title={`Recent bookings (${formatNumber(data.bookings.total)})`}
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
        <Section title={`Clients (${formatNumber(data.clients.total)})`}>
          <form
            className={"inline-form"}
            onSubmit={(event) => void createGhostClient(event)}
          >
            <input
              value={ghostName}
              onChange={(event) => setGhostName(event.target.value)}
              placeholder={"Ghost client name"}
            />
            <button type={"submit"}>{"Create ghost"}</button>
          </form>
          <div className={"table-wrap"}>
            <table>
              <thead>
                <tr>
                  <th>{"Name"}</th>
                  <th>{"Telegram"}</th>
                  <th>{"Created"}</th>
                  <th>{"State"}</th>
                  <th>{"Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {data.clients.clients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <strong>{client.displayName || client.name}</strong>
                      {client.isGhost ? <small>{" ghost"}</small> : null}
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
                        {client.isBlocked ? "blocked" : "active"}
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
                        {"Rename"}
                      </button>
                      {batchServices.length ? (
                        <button onClick={() => void assignBatch(client.id)}>
                          {"Batch"}
                        </button>
                      ) : null}
                      {!client.isGhost ? (
                        <button
                          onClick={() =>
                            void setClientBlocked(client.id, !client.isBlocked)
                          }
                        >
                          {client.isBlocked ? "Unblock" : "Block"}
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
        <Section title={"Create service"}>
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
              <option value={"common"}>{"Common"}</option>
              <option value={"batch"}>{"Batch"}</option>
            </select>
            <input
              value={serviceForm.name}
              onChange={(event) =>
                setServiceForm({ ...serviceForm, name: event.target.value })
              }
              placeholder={"Name"}
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
              placeholder={"Minutes"}
            />
            <input
              type={"number"}
              value={serviceForm.price}
              onChange={(event) =>
                setServiceForm({ ...serviceForm, price: event.target.value })
              }
              placeholder={"Price"}
            />
            <input
              value={serviceForm.currency}
              onChange={(event) =>
                setServiceForm({
                  ...serviceForm,
                  currency: event.target.value.toUpperCase(),
                })
              }
              placeholder={"Currency"}
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
              placeholder={"Batch sessions"}
            />
            <button type={"submit"}>{"Create"}</button>
          </form>
        </Section>
        <Section title={"Services"}>
          <div className={"cards-list"}>
            {data.services.map((service) => (
              <div className={"list-card"} key={service.id}>
                <div>
                  <strong>{service.name}</strong>
                  <span>
                    {service.type} · {service.durationMinutes} min ·{" "}
                    {formatNumber(service.price)} {service.currency}
                  </span>
                </div>
                <div className={"actions-cell"}>
                  <button onClick={() => void editService(service)}>
                    {"Edit"}
                  </button>
                  <button onClick={() => void deleteService(service.id)}>
                    {"Deactivate"}
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
        <Section title={"Working hours"}>
          <p className={"muted"}>
            {"JSON preserves multiple intervals per day."}
          </p>
          <textarea
            className={"json-editor"}
            value={workingHoursJson}
            onChange={(event) => setWorkingHoursJson(event.target.value)}
          />
          <div className={"actions-row"}>
            <button onClick={() => void saveWorkingHours()}>
              {"Save working hours"}
            </button>
          </div>
        </Section>
        <Section title={"Days off"}>
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
              placeholder={"Reason"}
            />
            <button type={"submit"}>{"Add day off"}</button>
          </form>
          <div className={"cards-list"}>
            {data.schedule.daysOff.map((day) => (
              <div className={"list-card"} key={day.id}>
                <div>
                  <strong>{formatDate(day.date)}</strong>
                  <span>{day.reason || "No reason"}</span>
                </div>
                <button onClick={() => void deleteDayOff(day.id)}>
                  {"Delete"}
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
        title={`Recurring schedules (${formatNumber(data.recurring.length)})`}
      >
        <div className={"table-wrap"}>
          <table>
            <thead>
              <tr>
                <th>{"Client"}</th>
                <th>{"Days"}</th>
                <th>{"Time"}</th>
                <th>{"Service"}</th>
                <th>{"Status"}</th>
                <th>{"Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {data.recurring.map((schedule) => (
                <tr key={schedule.id}>
                  <td>{schedule.clientDisplayName || schedule.clientName}</td>
                  <td>{schedule.daysOfWeek || weekDays[schedule.dayOfWeek]}</td>
                  <td>{schedule.time}</td>
                  <td>
                    {schedule.sessionType?.name ||
                      `${schedule.durationMinutes} min`}
                  </td>
                  <td>
                    <span className={statusClass(schedule.status)}>
                      {schedule.status}
                    </span>
                  </td>
                  <td className={"actions-cell"}>
                    {schedule.status === "pending" ? (
                      <button
                        onClick={() =>
                          void recurringAction(schedule.id, "approve")
                        }
                      >
                        {"Approve"}
                      </button>
                    ) : null}
                    {schedule.status === "pending" ? (
                      <button
                        onClick={() =>
                          void recurringAction(schedule.id, "decline")
                        }
                      >
                        {"Decline"}
                      </button>
                    ) : null}
                    {schedule.status !== "cancelled" ? (
                      <button onClick={() => void deleteRecurring(schedule.id)}>
                        {"Cancel"}
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
          <Card label={"Code"} value={data.referrals.code || "-"} />
          <Card
            label={"Client referrals"}
            value={formatNumber(data.referrals.count)}
          />
          <Card
            label={"Specialist referrals"}
            value={formatNumber(data.referrals.specialistCount)}
          />
          <Card
            label={"Active referred specialists"}
            value={formatNumber(data.referrals.activeCount)}
          />
        </div>
        <Section title={"Referral link"}>
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
          <Section title={"Referred clients"}>
            <ReferralClientList data={data} />
          </Section>
          <Section title={"Referred specialists"}>
            <ReferralSpecialistList data={data} />
          </Section>
        </div>
      </div>
    ));
  }

  function renderSettings(): ReactNode {
    return renderNeedsSpecialist(() => (
      <div className={"content-stack"}>
        <Section title={"Profile"}>
          <form
            className={"form-grid"}
            onSubmit={(event) => void saveProfile(event)}
          >
            <input
              value={profileForm.name ?? ""}
              onChange={(event) =>
                setProfileForm({ ...profileForm, name: event.target.value })
              }
              placeholder={"Name"}
            />
            <input
              value={profileForm.telegramHandle ?? ""}
              onChange={(event) =>
                setProfileForm({
                  ...profileForm,
                  telegramHandle: event.target.value,
                })
              }
              placeholder={"Telegram handle"}
            />
            <input
              value={profileForm.phone ?? ""}
              onChange={(event) =>
                setProfileForm({ ...profileForm, phone: event.target.value })
              }
              placeholder={"Phone"}
            />
            <input
              value={profileForm.specialization ?? ""}
              onChange={(event) =>
                setProfileForm({
                  ...profileForm,
                  specialization: event.target.value,
                })
              }
              placeholder={"Specialization"}
            />
            <input
              value={profileForm.photoUrl ?? ""}
              onChange={(event) =>
                setProfileForm({ ...profileForm, photoUrl: event.target.value })
              }
              placeholder={"Photo URL or file id"}
            />
            <select
              value={profileForm.language ?? "ru"}
              onChange={(event) =>
                setProfileForm({ ...profileForm, language: event.target.value })
              }
            >
              <option value={"ru"}>{"Russian"}</option>
              <option value={"en"}>{"English"}</option>
            </select>
            <textarea
              value={profileForm.bio ?? ""}
              onChange={(event) =>
                setProfileForm({ ...profileForm, bio: event.target.value })
              }
              placeholder={"Bio"}
            />
            <button type={"submit"}>{"Save profile"}</button>
          </form>
        </Section>
        <Section title={"Notifications"}>
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
              {"New bookings"}
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
              {"Cancellations"}
            </label>
            <button onClick={() => void saveNotifications()}>
              {"Save notifications"}
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
        ? window.prompt("Reason", "") || undefined
        : undefined;
    await mutate("Booking updated.", async () => {
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
      "New date YYYY-MM-DD",
      booking.startsAt.slice(0, 10),
    );
    if (!date) {
      return;
    }
    const time = window.prompt("New time HH:MM", "10:00");
    if (!time) {
      return;
    }
    await mutate("Booking rescheduled.", async () => {
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
    await mutate("Booking created.", async () => {
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
    await mutate("Client created.", async () => {
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
    const name = window.prompt("Client display name", currentName);
    if (!name) {
      return;
    }
    await mutate("Client renamed.", async () => {
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
          "Cancel active bookings and recurring schedules for this client?",
        )
      : false;
    await mutate(
      blocked ? "Client blocked." : "Client unblocked.",
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
      "Batch service ID",
      batchServices[0]?.id ?? "",
    );
    if (!serviceId) {
      return;
    }
    await mutate("Batch assigned.", async () => {
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
    await mutate("Service created.", async () => {
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
    const name = window.prompt("Service name", service.name);
    if (!name) {
      return;
    }
    const price = window.prompt("Price", String(service.price));
    if (price == null) {
      return;
    }
    await mutate("Service updated.", async () => {
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
    if (!window.confirm("Deactivate this service?")) {
      return;
    }
    await mutate("Service deactivated.", async () => {
      await apiEmpty(
        `specialists/${selectedSpecialistId}/services/${serviceId}`,
        { method: "DELETE" },
      );
    });
  }

  async function saveWorkingHours(): Promise<void> {
    const hours = JSON.parse(workingHoursJson) as unknown;
    await mutate("Working hours saved.", async () => {
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
    await mutate("Day off added.", async () => {
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
    await mutate("Day off deleted.", async () => {
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
    await mutate("Recurring schedule updated.", async () => {
      await apiJson(
        `specialists/${selectedSpecialistId}/recurring/${id}/${action}`,
        { method: "PUT" },
      );
    });
  }

  async function deleteRecurring(id: string): Promise<void> {
    if (!window.confirm("Cancel this recurring schedule?")) {
      return;
    }
    await mutate("Recurring schedule cancelled.", async () => {
      await apiEmpty(`specialists/${selectedSpecialistId}/recurring/${id}`, {
        method: "DELETE",
      });
    });
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await mutate("Profile saved.", async () => {
      await apiJson(`specialists/${selectedSpecialistId}/profile`, {
        method: "PUT",
        body: JSON.stringify(profileForm),
      });
    });
  }

  async function saveNotifications(): Promise<void> {
    await mutate("Notifications saved.", async () => {
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
          ? "Enable this specialist bot?"
          : "Disable this specialist bot? Existing data stays in place.",
      )
    ) {
      return;
    }
    await mutate(
      active ? "Specialist enabled." : "Specialist disabled.",
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

  return (
    <div className={"dashboard-shell"}>
      <aside className={"sidebar"}>
        <div className={"brand-block"}>
          <span>{"Scheduler"}</span>
          <strong>{"Owner dashboard"}</strong>
        </div>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.key}
              className={view === item.key ? "active" : ""}
              disabled={item.needsSpecialist && !selectedSpecialistId}
              onClick={() => setView(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <button className={"logout-button"} onClick={() => void logout()}>
          {"Log out"}
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
                ? "Platform overview"
                : view[0].toUpperCase() + view.slice(1)}
            </h1>
          </div>
          <div className={"selected-specialist"}>
            <span>{"Selected specialist"}</span>
            <select
              value={selectedSpecialistId}
              onChange={(event) => setSelectedSpecialistId(event.target.value)}
            >
              <option value={""}>{"None"}</option>
              {specialists.map((specialist) => (
                <option key={specialist.id} value={specialist.id}>
                  {specialist.name}
                </option>
              ))}
            </select>
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
          <EmptyState>{"Loading dashboard..."}</EmptyState>
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
  if (!items.length) {
    return <EmptyState>{"No data yet."}</EmptyState>;
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
  if (!items.length) {
    return <EmptyState>{"No data yet."}</EmptyState>;
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
  if (!items.length) {
    return <EmptyState>{"No revenue yet."}</EmptyState>;
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
  if (!events.length) {
    return <EmptyState>{"No activity yet."}</EmptyState>;
  }
  return (
    <div className={"activity-list"}>
      {events.map((event) => (
        <div className={"activity-item"} key={event.id}>
          <div>
            <strong>{event.title}</strong>
            <span>
              {event.detail || event.entityType || "Event"}
              {event.specialistName ? ` · ${event.specialistName}` : ""}
            </span>
          </div>
          <div>
            {event.status ? (
              <span className={statusClass(event.status)}>{event.status}</span>
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
  if (!items.length) {
    return <EmptyState>{"No dashboard actions recorded yet."}</EmptyState>;
  }
  return (
    <div className={"table-wrap"}>
      <table>
        <thead>
          <tr>
            <th>{"Time"}</th>
            <th>{"Actor"}</th>
            <th>{"Action"}</th>
            <th>{"Specialist"}</th>
            <th>{"Status"}</th>
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
  if (!events.length) {
    return <EmptyState>{"No bookings in this range."}</EmptyState>;
  }
  return (
    <div className={"table-wrap"}>
      <table>
        <thead>
          <tr>
            <th>{"Time"}</th>
            <th>{"Specialist"}</th>
            <th>{"Client"}</th>
            <th>{"Service"}</th>
            <th>{"Status"}</th>
            <th>{"Open"}</th>
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
                  {event.status}
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
  if (!report) {
    return <EmptyState>{"Loading checks..."}</EmptyState>;
  }
  if (
    !report.overlappingBookings.length &&
    !report.invalidWorkingHours.length
  ) {
    return <EmptyState>{"No conflicts detected."}</EmptyState>;
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
              {item.firstClient} overlaps {item.secondClient} ·{" "}
              {formatDateTime(item.startsAt)}
            </span>
          </div>
          <button onClick={() => onOpen(item.specialistId, "bookings")}>
            {"Open"}
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
              {weekDays[item.dayOfWeek]} {item.startTime}-{item.endTime} ·{" "}
              {item.reason}
            </span>
          </div>
          <button onClick={() => onOpen(item.specialistId, "schedule")}>
            {"Open"}
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
  return (
    <div className={"table-wrap"}>
      <table>
        <thead>
          <tr>
            <th>{"Client"}</th>
            <th>{"Time"}</th>
            <th>{"Service"}</th>
            <th>{"Status"}</th>
            <th>{"Actions"}</th>
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
                  `${booking.durationMinutes ?? "-"} min`}
              </td>
              <td>
                <span className={statusClass(booking.status)}>
                  {booking.status}
                </span>
              </td>
              <td className={"actions-cell"}>
                {booking.status === "pending" &&
                booking.createdBy !== "specialist" ? (
                  <button onClick={() => void onStatus(booking, "confirmed")}>
                    {"Confirm"}
                  </button>
                ) : null}
                {booking.status === "pending" ? (
                  <button onClick={() => void onStatus(booking, "rejected")}>
                    {"Reject"}
                  </button>
                ) : null}
                {booking.status === "pending" ||
                booking.status === "confirmed" ? (
                  <button onClick={() => void onReschedule(booking)}>
                    {"Move"}
                  </button>
                ) : null}
                {booking.status === "confirmed" ? (
                  <button onClick={() => void onStatus(booking, "completed")}>
                    {"Complete"}
                  </button>
                ) : null}
                {booking.status === "pending" ||
                booking.status === "confirmed" ? (
                  <button onClick={() => void onStatus(booking, "cancelled")}>
                    {"Cancel"}
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
  if (!data.referrals.referrals.length) {
    return <EmptyState>{"No referred clients yet."}</EmptyState>;
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
  if (!data.referrals.specialists.length) {
    return <EmptyState>{"No referred specialists yet."}</EmptyState>;
  }
  return (
    <div className={"compact-list"}>
      {data.referrals.specialists.map((item) => (
        <div key={item.id}>
          <span>
            {item.name} @{item.botUsername}
          </span>
          <strong>{item.isActive ? "active" : "passive"}</strong>
        </div>
      ))}
    </div>
  );
}
