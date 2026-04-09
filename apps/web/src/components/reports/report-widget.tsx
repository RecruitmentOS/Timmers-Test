"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Download } from "lucide-react";

interface ReportWidgetProps {
  title: string;
  children: ReactNode;
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
  onExport: () => void;
}

/**
 * ReportWidget — shell for each report widget on the reports page.
 * Follows the WidgetShell pattern from dashboard but adds CSV export button.
 */
export function ReportWidget({
  title,
  children,
  isLoading,
  error,
  onRetry,
  onExport,
}: ReportWidgetProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={onExport}
          className="text-muted-foreground hover:text-foreground"
          title="Exporteer CSV"
        >
          <Download className="size-4 mr-1" />
          <span className="text-xs">CSV</span>
        </Button>
      </CardHeader>
      <CardContent className="min-h-[120px]">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        ) : error ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="size-4" />
              Kon rapport niet laden
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
