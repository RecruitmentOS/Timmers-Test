"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar, type SidebarVariant } from "./sidebar";
import { AppHeader } from "./app-header";
import { QuickAddFAB } from "./quick-add-fab";

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
      <div className="flex flex-1 flex-col overflow-auto bg-white dark:bg-slate-950">
        <AppHeader />
        <main className="flex-1 overflow-auto">
          <div className="p-6">{children}</div>
        </main>
      </div>
      <QuickAddFAB />
    </SidebarProvider>
  );
}
