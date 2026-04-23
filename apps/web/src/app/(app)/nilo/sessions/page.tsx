'use client'

import { useNiloSessions } from '@/hooks/use-nilo-sessions'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { nl } from 'date-fns/locale'

const STATE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  created: 'outline',
  initiated: 'secondary',
  in_progress: 'default',
  awaiting_human: 'destructive',
  completed: 'secondary',
  abandoned: 'outline',
}

const VERDICT_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  qualified: 'default',
  rejected: 'destructive',
  unsure: 'secondary',
}

export default function NiloSessionsPage() {
  const { data, isLoading } = useNiloSessions()

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Sessies laden...</div>
  }

  const sessions = data?.sessions ?? []

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Hey Nilo — Sessies</h1>
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} sessies</p>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uitkomst</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Aangemaakt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Link href={`/nilo/sessions/${s.id}`} className="hover:underline font-medium">
                    {s.contactName ?? s.contactPhone}
                  </Link>
                  {s.contactName && (
                    <p className="text-xs text-muted-foreground">{s.contactPhone}</p>
                  )}
                  {Boolean(s.context['vacancy_title']) && (
                    <p className="text-xs text-muted-foreground">
                      {String(s.context['vacancy_title'])}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={STATE_VARIANT[s.state] ?? 'outline'}>{s.state}</Badge>
                </TableCell>
                <TableCell>
                  {s.verdict ? (
                    <Badge variant={VERDICT_VARIANT[s.verdict] ?? 'outline'}>{s.verdict}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {s.matchScore != null ? (
                    <span className="font-mono">{s.matchScore}%</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true, locale: nl })}
                </TableCell>
              </TableRow>
            ))}
            {sessions.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Geen sessies gevonden
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
