"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Settings,
  ListChecks,
  BarChart3,
  Megaphone,
  MessageSquareReply,
  LogOut,
  ChevronsLeft,
  ChevronDown,
  GitBranch,
  Users2,
  Bell,
  CreditCard,
  BadgeCheck,
  FileInput,
  CalendarDays,
  Sparkles,
  Building2,
} from "lucide-react";
import { signOut } from "@/lib/auth-client";
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useApplications } from "@/hooks/use-applications";
import { useTasks } from "@/hooks/use-tasks";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tourId?: string;
  badge?: "tasks" | "applications";
};

type SubNavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const EMPLOYER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, tourId: "tour-dashboard" },
  { label: "Vacatures", href: "/vacancies", icon: Briefcase, tourId: "tour-vacatures" },
  { label: "Kandidaten", href: "/candidates", icon: Users, tourId: "tour-kandidaten", badge: "applications" },
  { label: "Intake Inbox", href: "/intake", icon: MessageSquareReply },
  { label: "Taken", href: "/tasks", icon: ListChecks, badge: "tasks" },
  { label: "Campagnes", href: "/campaigns", icon: Megaphone },
  { label: "Rapportages", href: "/reports", icon: BarChart3 },
];

const AGENCY_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, tourId: "tour-dashboard" },
  { label: "Vacatures", href: "/vacancies", icon: Briefcase, tourId: "tour-vacatures" },
  { label: "Kandidaten", href: "/candidates", icon: Users, tourId: "tour-kandidaten", badge: "applications" },
  { label: "Intake Inbox", href: "/intake", icon: MessageSquareReply },
  { label: "Taken", href: "/tasks", icon: ListChecks, badge: "tasks" },
  { label: "Klanten", href: "/clients", icon: Building2 },
  { label: "Campagnes", href: "/campaigns", icon: Megaphone },
  { label: "Rapportages", href: "/reports", icon: BarChart3 },
];

const SETTINGS_SUBNAV: SubNavItem[] = [
  { label: "Pijplijn", href: "/settings/pipeline", icon: GitBranch },
  { label: "Team", href: "/settings/team", icon: Users2 },
  { label: "Notificaties", href: "/settings/notifications", icon: Bell },
  { label: "Facturering", href: "/settings/billing", icon: CreditCard },
  { label: "Kwalificaties", href: "/settings/qualifications", icon: BadgeCheck },
  { label: "Intakesjablonen", href: "/settings/intake-templates", icon: FileInput },
  { label: "Agenda", href: "/settings/calendar", icon: CalendarDays },
  { label: "AI Gebruik", href: "/settings/ai-usage", icon: Sparkles },
];

const CLIENT_NAV: NavItem[] = [
  { label: "Dashboard", href: "/portal", icon: LayoutDashboard },
  { label: "Vacatures", href: "/portal/vacancies", icon: Briefcase },
];

const AGENT_NAV: NavItem[] = [
  { label: "Mijn kandidaten", href: "/agent", icon: Users },
  { label: "Mijn taken", href: "/agent/tasks", icon: ListChecks },
  { label: "Statistieken", href: "/agent/stats", icon: BarChart3 },
];

const HM_NAV: NavItem[] = [
  { label: "Dashboard", href: "/hiring-manager", icon: LayoutDashboard },
  { label: "Vacatures", href: "/hiring-manager/vacancies", icon: Briefcase },
];

export type SidebarVariant = "employer" | "agency" | "full" | "client" | "agent" | "hm";

function SidebarBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white tabular-nums">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function useSidebarCounts() {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, []);

  const { data: pendingApps } = useApplications({
    qualificationStatus: "pending",
    limit: 1,
  });
  const { data: openTasks } = useTasks({
    status: "open",
    dueBefore: today,
  });

  return {
    applications: pendingApps?.total ?? 0,
    tasks: openTasks?.length ?? 0,
  };
}

export function AppSidebar({ variant = "employer" }: { variant?: SidebarVariant }) {
  const pathname = usePathname();
  const { toggleSidebar, state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const counts = useSidebarCounts();

  const isSettingsActive = pathname.startsWith("/settings");
  const [manualSettingsOpen, setManualSettingsOpen] = useState(false);
  // Auto-open when on any settings route; user can also toggle manually
  const settingsOpen = isSettingsActive || manualSettingsOpen;

  const items =
    variant === "employer" || variant === "full"
      ? EMPLOYER_NAV
      : variant === "agency"
        ? AGENCY_NAV
        : variant === "client"
          ? CLIENT_NAV
          : variant === "agent"
            ? AGENT_NAV
            : HM_NAV;

  async function handleSignOut() {
    await signOut();
    window.location.href = "/login";
  }

  function getBadgeCount(badge: NavItem["badge"]) {
    if (badge === "applications") return counts.applications;
    if (badge === "tasks") return counts.tasks;
    return 0;
  }

  return (
    <SidebarRoot collapsible="icon" className="bg-slate-900 border-slate-800">
      <SidebarHeader className="p-4">
        <Link
          href={
            variant === "client"
              ? "/portal"
              : variant === "agent"
                ? "/agent"
                : variant === "hm"
                  ? "/hiring-manager"
                  : "/dashboard"
          }
          className="flex items-center gap-2.5 text-slate-100 group-data-[collapsible=icon]:justify-center"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-indigo-400 text-white font-bold text-sm shadow-lg shadow-primary/30">
            R
          </div>
          <span className="text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Recruitment OS
          </span>
        </Link>
      </SidebarHeader>

      <Separator className="bg-slate-700/40" />

      <SidebarContent className="px-2 py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {items.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const badgeCount = item.badge ? getBadgeCount(item.badge) : 0;

                return (
                  <SidebarMenuItem key={item.href} data-tour={item.tourId}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.label}
                      render={
                        <Link
                          href={item.href}
                          className={cn(
                            "rounded-md transition-all duration-150 text-slate-400 hover:text-slate-100 hover:bg-white/5",
                            isActive &&
                              "bg-gradient-to-r from-primary/25 to-primary/5 text-white border-l-2 border-primary font-medium hover:bg-transparent"
                          )}
                        />
                      }
                    >
                      <item.icon
                        className={cn(
                          "shrink-0",
                          isActive ? "text-primary" : "text-slate-500"
                        )}
                      />
                      <span className="flex-1">{item.label}</span>
                      <SidebarBadge count={badgeCount} />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* Instellingen with expandable sub-nav */}
              {(variant === "employer" || variant === "agency" || variant === "full") && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={isSettingsActive}
                      tooltip="Instellingen"
                      onClick={() => setManualSettingsOpen((o) => !o)}
                      className={cn(
                        "rounded-md transition-all duration-150 text-slate-400 hover:text-slate-100 hover:bg-white/5 cursor-pointer",
                        isSettingsActive &&
                          "bg-gradient-to-r from-primary/25 to-primary/5 text-white border-l-2 border-primary font-medium hover:bg-transparent"
                      )}
                    >
                      <Settings
                        className={cn(
                          "shrink-0",
                          isSettingsActive ? "text-primary" : "text-slate-500"
                        )}
                      />
                      <span className="flex-1">Instellingen</span>
                      {!isCollapsed && (
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 transition-transform text-slate-500",
                            settingsOpen && "rotate-180"
                          )}
                        />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {/* Sub-nav items */}
                  {settingsOpen && !isCollapsed && (
                    <div className="ml-3 border-l border-slate-700/60 pl-3 space-y-0.5 py-0.5">
                      {SETTINGS_SUBNAV.map((sub) => {
                        const isSubActive = pathname === sub.href || pathname.startsWith(sub.href + "/");
                        return (
                          <SidebarMenuItem key={sub.href}>
                            <SidebarMenuButton
                              isActive={isSubActive}
                              tooltip={sub.label}
                              render={
                                <Link
                                  href={sub.href}
                                  className={cn(
                                    "text-slate-400 hover:text-slate-200 text-xs",
                                    isSubActive && "text-primary"
                                  )}
                                />
                              }
                            >
                              <sub.icon className="shrink-0 h-3.5 w-3.5" />
                              <span className="text-xs">{sub.label}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-2 pb-3">
        <Separator className="bg-slate-700/40 mb-2" />
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Uitloggen"
              onClick={handleSignOut}
              className="rounded-md text-slate-500 hover:text-slate-100 hover:bg-white/5 transition-all duration-150"
            >
              <LogOut className="shrink-0" />
              <span>Uitloggen</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Zijbalk inklappen"
              onClick={toggleSidebar}
              className="rounded-md text-slate-500 hover:text-slate-100 hover:bg-white/5 transition-all duration-150"
            >
              <ChevronsLeft className="shrink-0 transition-transform group-data-[state=collapsed]:rotate-180" />
              <span>Inklappen</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </SidebarRoot>
  );
}
