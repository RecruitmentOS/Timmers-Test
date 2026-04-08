"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";

/**
 * WidgetShell
 *
 * Shared presentation for every dashboard widget. Each widget decides
 * its own data source (its own useQuery hook) and renders its own body;
 * the shell handles: title, optional icon, loading skeleton, error card
 * with retry, and height consistency so the grid stays aligned.
 *
 * Height rule: the shell enforces a minimum content height so that a
 * single late-loading widget does not cause layout shift on the whole
 * dashboard grid.
 */

type Props = {
  title: string;
  icon?: ReactNode;
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
  children: ReactNode;
};

export function WidgetShell({
  title,
  icon,
  isLoading,
  error,
  onRetry,
  children,
}: Props) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent className="min-h-[92px]">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-32" />
          </div>
        ) : error ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="size-4" />
              Kon widget niet laden
            </div>
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry}>
                Opnieuw proberen
              </Button>
            )}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
