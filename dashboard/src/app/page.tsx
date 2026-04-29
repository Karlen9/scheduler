import { DashboardApp } from "@/components/DashboardApp";
import { LoginView } from "@/components/LoginView";
import { getCurrentSessionUser } from "@/lib/session";

import type { ReactNode } from "react";

export default async function Home(): Promise<ReactNode> {
  const user = await getCurrentSessionUser();
  return user ? <DashboardApp initialUser={user} /> : <LoginView />;
}
