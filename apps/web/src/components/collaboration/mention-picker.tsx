"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrgUsers, type OrgUser } from "@/hooks/use-activity";

/**
 * MentionPicker — a popover with search/filter for @mentioning org users.
 * Per D-06: uses a filterable list inside a Popover.
 * Shows Avatar + name for each user, with loading skeleton.
 */
export function MentionPicker({
  onSelect,
  open,
  onOpenChange,
  children,
}: {
  onSelect: (userId: string, userName: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}) {
  const [search, setSearch] = React.useState("");
  const { data: users, isLoading } = useOrgUsers();

  const filtered = React.useMemo(() => {
    if (!users) return [];
    if (!search) return users;
    const lower = search.toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(lower));
  }, [users, search]);

  const handleSelect = (user: OrgUser) => {
    onSelect(user.id, user.name);
    setSearch("");
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 h-8"
          autoFocus
        />
        <div className="max-h-48 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">No users found</p>
          ) : (
            filtered.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => handleSelect(u)}
                className="flex w-full items-center gap-2 rounded-md p-1.5 text-sm hover:bg-accent"
              >
                <Avatar size="sm">
                  {u.image && <AvatarImage src={u.image} alt={u.name} />}
                  <AvatarFallback>
                    {u.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>{u.name}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
