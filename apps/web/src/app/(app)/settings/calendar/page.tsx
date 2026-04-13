"use client";

import { useState } from "react";
import {
  useCalendarConnections,
  useCalendarProviders,
  useConnectGoogle,
  useConnectOutlook,
  useDisconnectCalendar,
} from "@/hooks/use-calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar, Trash2 } from "lucide-react";

export default function CalendarConnectionsPage() {
  const { data: connections, isLoading } = useCalendarConnections();
  const { data: providers } = useCalendarProviders();
  const connectGoogle = useConnectGoogle();
  const connectOutlook = useConnectOutlook();
  const disconnectCalendar = useDisconnectCalendar();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDisconnect = async (id: string) => {
    await disconnectCalendar.mutateAsync(id);
    setConfirmDeleteId(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const hasConnections = connections && connections.length > 0;

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-xl font-semibold">Agenda-koppelingen</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verbonden agenda&apos;s</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasConnections ? (
            <div className="text-center py-8">
              <Calendar className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                Nog geen agenda gekoppeld. Koppel je Google of Outlook agenda om
                interviews te plannen.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                      {conn.provider === "google" ? (
                        <span className="text-sm font-semibold text-blue-600">G</span>
                      ) : (
                        <span className="text-sm font-semibold text-blue-800">O</span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {conn.provider === "google"
                            ? "Google Calendar"
                            : "Outlook Calendar"}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          Verbonden
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {conn.calendarEmail ?? "Geen e-mail"}
                        {" - "}
                        {new Date(conn.createdAt).toLocaleDateString("nl-NL")}
                      </p>
                    </div>
                  </div>

                  <Dialog
                    open={confirmDeleteId === conn.id}
                    onOpenChange={(open) =>
                      setConfirmDeleteId(open ? conn.id : null)
                    }
                  >
                    <DialogTrigger
                      render={
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      }
                    />
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Agenda ontkoppelen</DialogTitle>
                      </DialogHeader>
                      <p className="text-sm text-muted-foreground">
                        Weet je zeker dat je deze agenda-koppeling wilt
                        verwijderen? Geplande interviews worden niet
                        geannuleerd.
                      </p>
                      <div className="flex justify-end gap-2 mt-4">
                        <Button
                          variant="outline"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Annuleren
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleDisconnect(conn.id)}
                          disabled={disconnectCalendar.isPending}
                        >
                          {disconnectCalendar.isPending
                            ? "Ontkoppelen..."
                            : "Ontkoppelen"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connect buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agenda toevoegen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {providers?.google && (
              <Button
                variant="outline"
                onClick={() => connectGoogle.mutate()}
                disabled={connectGoogle.isPending}
              >
                <span className="mr-2 font-semibold text-blue-600">G</span>
                Google Calendar verbinden
              </Button>
            )}
            {providers?.outlook && (
              <Button
                variant="outline"
                onClick={() => connectOutlook.mutate()}
                disabled={connectOutlook.isPending}
              >
                <span className="mr-2 font-semibold text-blue-800">O</span>
                Outlook Calendar verbinden
              </Button>
            )}
            {!providers?.google && !providers?.outlook && (
              <p className="text-sm text-muted-foreground">
                Geen agenda-providers geconfigureerd. Neem contact op met de
                beheerder.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
