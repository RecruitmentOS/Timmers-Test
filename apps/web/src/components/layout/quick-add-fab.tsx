"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Plus, Briefcase, Users, ListChecks, Megaphone, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTIONS = [
  {
    label: "Nieuwe vacature",
    href: "/vacancies/new",
    icon: Briefcase,
    color: "bg-violet-500 hover:bg-violet-600",
  },
  {
    label: "Kandidaat toevoegen",
    href: "/candidates/new",
    icon: Users,
    color: "bg-emerald-500 hover:bg-emerald-600",
  },
  {
    label: "Taak aanmaken",
    href: "/tasks",
    icon: ListChecks,
    color: "bg-amber-500 hover:bg-amber-600",
  },
  {
    label: "Campagne aanmaken",
    href: "/campaigns",
    icon: Megaphone,
    color: "bg-sky-500 hover:bg-sky-600",
  },
];

export function QuickAddFAB() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2"
    >
      {/* Action items — slide up when open */}
      <div
        className={cn(
          "flex flex-col gap-2 items-end transition-all duration-200",
          open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-border/60 px-4 py-2.5 text-sm font-medium text-foreground hover:shadow-xl transition-all"
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-white shrink-0",
                action.color
              )}
            >
              <action.icon className="h-3.5 w-3.5" />
            </span>
            {action.label}
          </Link>
        ))}
      </div>

      {/* FAB button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200",
          "bg-gradient-to-br from-indigo-500 to-violet-600 text-white",
          "hover:shadow-xl hover:scale-105 active:scale-95",
          open && "rotate-45"
        )}
        aria-label={open ? "Sluiten" : "Snel aanmaken"}
      >
        {open ? (
          <X className="h-6 w-6 transition-transform" />
        ) : (
          <Plus className="h-6 w-6 transition-transform" />
        )}
      </button>
    </div>
  );
}
