import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Scheduler Owner Dashboard",
  description: "Owner analytics and admin console",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <html lang={"en"}>
      <body>{children}</body>
    </html>
  );
}
