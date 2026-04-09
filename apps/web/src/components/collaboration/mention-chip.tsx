"use client";

import { Badge } from "@/components/ui/badge";

/**
 * MentionChip — renders an @mention as an indigo badge with the user name.
 * Per UI-SPEC: indigo badge inline with comment text.
 */
export function MentionChip({ name }: { name: string }) {
  return (
    <Badge
      variant="secondary"
      className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
    >
      @{name}
    </Badge>
  );
}
