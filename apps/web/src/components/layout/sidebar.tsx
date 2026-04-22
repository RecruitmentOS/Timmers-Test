"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Building2,
  Settings,
  ListChecks,
  BarChart3,
  Megaphone,
  MessageSquareReply,
  LogOut,
  ChevronsLeft,
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

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tourId?: string;
};

const FULL_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, tourId: "tour-dashboard" },
  { label: "Vacancies", href: "/vacancies", icon: Briefcase, tourId: "tour-vacatures" },
  { label: "Candidates", href: "/candidates", icon: Users, tourId: "tour-kandidaten" },
  { label: "Intake", href: "/intake", icon: MessageSquareReply },
  { label: "Taken", href: "/tasks", icon: ListChecks },
  { label: "Clients", href: "/clients", icon: Building2 },
  { label: "Campagnes", href: "/campaigns", icon: Megaphone },
  { label: "Rapportages", href: "/reports", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings, tourId: "tour-instellingen" },
];

const CLIENT_NAV: NavItem[] = [
  { label: "Dashboard", href: "/portal", icon: LayoutDashboard },
  { label: "Vacancies", href: "/portal/vacancies", icon: Briefcase },
];

const AGENT_NAV: NavItem[] = [
  { label: "Mijn kandidaten", href: "/agent", icon: Users },
  { label: "Mijn taken", href: "/agent/tasks", icon: ListChecks },
  { label: "Stats", href: "/agent/stats", icon: BarChart3 },
];

const HM_NAV: NavItem[] = [
  { label: "Dashboard", href: "/hiring-manager", icon: LayoutDashboard },
  { label: "Vacatures", href: "/hiring-manager/vacancies", icon: Briefcase },
];

const NAV_MAP = {
  full: FULL_NAV,
  client: CLIENT_NAV,
  agent: AGENT_NAV,
  hm: HM_NAV,
} as const;

export type SidebarVariant = "full" | "client" | "agent" | "hm";

export function AppSidebar({ variant = "full" }: { variant?: SidebarVariant }) {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();
  const items = NAV_MAP[variant];

  async function handleSignOut() {
    await signOut();
    window.location.href = "/login";
  }

  return (
    <SidebarRoot collapsible="icon" className="bg-slate-900 border-slate-800">
      <SidebarHeader className="p-4">
        <Link
          href={variant === "client" ? "/portal" : variant === "agent" ? "/agent" : variant === "hm" ? "/hiring-manager" : "/dashboard"}
          className="flex items-center gap-2 text-slate-100 group-data-[collapsible=icon]:justify-center"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm">
            R
          </div>
          <span className="text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Recruitment OS
          </span>
        </Link>
      </SidebarHeader>

      <Separator className="bg-slate-700/50" />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <SidebarMenuItem key={item.href} data-tour={item.tourId}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.label}
                      render={
                        <Link
                          href={item.href}
                          className={cn(
                            "text-slate-300 hover:text-slate-100",
                            isActive && "bg-indigo-600/20 text-indigo-400"
                          )}
                        />
                      }
                    >
                      <item.icon className="shrink-0" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <Separator className="bg-slate-700/50" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              onClick={handleSignOut}
              className="text-slate-400 hover:text-slate-100"
            >
              <LogOut className="shrink-0" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Collapse sidebar"
              onClick={toggleSidebar}
              className="text-slate-400 hover:text-slate-100"
            >
              <ChevronsLeft className="shrink-0 transition-transform group-data-[state=collapsed]:rotate-180" />
              <span>Collapse</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </SidebarRoot>
  );
}
