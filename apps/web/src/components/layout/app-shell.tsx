"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar, type SidebarVariant } from "./sidebar";

export default function AppShell({
  variant,
  children,
}: {
  variant: SidebarVariant;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar variant={variant} />
      <main className="flex-1 overflow-auto bg-white dark:bg-slate-950">
        <div className="p-6">{children}</div>
      </main>
    </SidebarProvider>
  );
}
