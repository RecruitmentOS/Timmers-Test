"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";

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
    <Card className="h-full border-0 shadow-md bg-gradient-to-br from-card to-card/70 backdrop-blur-sm ring-1 ring-border/60 dark:ring-border/40 transition-shadow hover:shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && (
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/8 text-primary">
            {icon}
          </div>
        )}
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
