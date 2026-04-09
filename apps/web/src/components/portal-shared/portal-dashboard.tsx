"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Widget = {
  title: string;
  value: string | number;
  subtitle?: string;
};

type Props = {
  widgets: Widget[];
};

/**
 * PortalDashboard — grid of summary cards for portal landing pages.
 * 3-4 columns on desktop, stacked on mobile.
 */
export function PortalDashboard({ widgets }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {widgets.map((w) => (
        <Card key={w.title} className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {w.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{w.value}</div>
            {w.subtitle && (
              <p className="mt-1 text-xs text-muted-foreground">
                {w.subtitle}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
