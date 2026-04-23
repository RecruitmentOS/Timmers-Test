"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { NotificationBell } from "@/components/collaboration/notification-bell";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession } from "@/lib/auth-client";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/vacancies": "Vacatures",
  "/candidates": "Kandidaten",
  "/intake": "Intake",
  "/tasks": "Taken",
  "/clients": "Klanten",
  "/campaigns": "Campagnes",
  "/reports": "Rapportages",
  "/settings": "Instellingen",
  "/portal": "Client Portal",
  "/agent": "Agent Portal",
  "/hiring-manager": "Hiring Manager",
};

function getPageTitle(pathname: string): string {
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (pathname === path || pathname.startsWith(path + "/")) return title;
  }
  return "Recruitment OS";
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AppHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const pageTitle = getPageTitle(pathname);
  const userName = session?.user?.name;
  const userImage = session?.user?.image;

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-xl px-6 gap-4">
      {/* Paginatitel */}
      <h1 className="text-base font-semibold text-foreground shrink-0">
        {pageTitle}
      </h1>

      {/* Rechts: zoekbalk + notificaties + avatar */}
      <div className="flex items-center gap-3">
        {/* Zoekbalk — verborgen op kleine schermen */}
        <div className="relative hidden md:flex items-center">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Zoeken..."
            className="h-8 w-52 pl-8 bg-muted/60 border-0 text-sm rounded-lg focus-visible:ring-1 focus-visible:ring-primary/40 placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Notificatiebel */}
        <NotificationBell />

        {/* Gebruikersavatar */}
        {session?.user && (
          <Avatar className="h-7 w-7 ring-2 ring-primary/20 cursor-pointer">
            <AvatarImage src={userImage ?? undefined} alt={userName ?? "Gebruiker"} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </header>
  );
}
