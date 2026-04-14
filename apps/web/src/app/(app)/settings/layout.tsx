"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings,
  Users,
  Building2,
  GitBranch,
  ClipboardCheck,
  CreditCard,
  Calendar,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMode } from "@/lib/use-mode";

const tabs = [
  { label: "Algemeen", href: "/settings", icon: Settings },
  { label: "Team", href: "/settings/team", icon: Users },
  { label: "Klanten", href: "/settings/clients", icon: Building2, agencyLabel: "Klanten", employerLabel: "Hiring managers" },
  { label: "Pipeline", href: "/settings/pipeline", icon: GitBranch },
  { label: "Kwalificaties", href: "/settings/qualifications", icon: ClipboardCheck },
  { label: "Facturatie", href: "/settings/billing", icon: CreditCard },
  { label: "Agenda", href: "/settings/calendar", icon: Calendar },
  { label: "Meldingen", href: "/settings/notifications", icon: Bell },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const mode = useMode();

  return (
    <div className="flex min-h-[calc(100vh-4rem)] gap-6 p-6">
      <nav className="w-56 shrink-0 space-y-1">
        <h1 className="mb-4 text-lg font-semibold">Instellingen</h1>
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/settings"
              ? pathname === "/settings"
              : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          const label =
            mode === "employer" && tab.employerLabel
              ? tab.employerLabel
              : tab.agencyLabel ?? tab.label;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <main className="flex-1">{children}</main>
    </div>
  );
}
