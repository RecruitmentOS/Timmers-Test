"use client";
import { useState } from "react";
import Link from "next/link";
import { useIntakeSessions } from "@/hooks/use-intake";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";

const TABS = [
  { key: "in_progress", label: "Actief" },
  { key: "awaiting_human", label: "Wacht op mens" },
  { key: "awaiting_first_reply", label: "Eerste bericht gestuurd" },
  { key: "completed", label: "Afgerond" },
] as const;

export default function IntakeInboxPage() {
  const [tab, setTab] = useState<typeof TABS[number]["key"]>("in_progress");
  const { data } = useIntakeSessions(tab);

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Intake Inbox</h1>
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          {TABS.map((t) => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.key} value={t.key} className="mt-4">
            {data && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kandidaat</TableHead>
                    <TableHead>Vacature</TableHead>
                    <TableHead>Verdict</TableHead>
                    <TableHead>Laatste activiteit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.sessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link href={`/intake/${s.id}`} className="hover:underline font-medium">
                          {s.candidateName}
                        </Link>
                      </TableCell>
                      <TableCell>{s.vacancyTitle}</TableCell>
                      <TableCell>{s.verdict ? <Badge>{s.verdict}</Badge> : "–"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.lastInboundAt ? formatDistanceToNow(new Date(s.lastInboundAt), { addSuffix: true }) : "–"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.sessions.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Geen sessies</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
