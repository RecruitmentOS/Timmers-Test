'use client'

import { use } from 'react'
import { useNiloSession } from '@/hooks/use-nilo-sessions'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { format, formatDistanceToNow } from 'date-fns'
import { nl } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Props {
  params: Promise<{ id: string }>
}

export default function NiloSessionDetailPage({ params }: Props) {
  const { id } = use(params)
  const { data: session, isLoading, refetch } = useNiloSession(id)
  const router = useRouter()

  if (isLoading) return <div className="p-6 text-muted-foreground">Laden...</div>
  if (!session) return <div className="p-6 text-muted-foreground">Sessie niet gevonden</div>

  async function resolveHandoff(resolution: string, verdict?: string) {
    await fetch(`/api/nilo/sessions/${id}/handoff`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution, verdict }),
    })
    void refetch()
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {session.contactName ?? session.contactPhone}
          </h1>
          <p className="text-sm text-muted-foreground">
            {session.contactPhone}
            {session.context['vacancy_title'] ? ` · ${String(session.context['vacancy_title'])}` : ''}
          </p>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Badge>{session.state}</Badge>
            {session.verdict && (
              <Badge variant={session.verdict === 'qualified' ? 'default' : 'destructive'}>
                {session.verdict}
              </Badge>
            )}
            {session.matchScore != null && (
              <Badge variant="outline">{session.matchScore}% match</Badge>
            )}
          </div>
        </div>

        {session.state === 'awaiting_human' && (
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => resolveHandoff('resumed_bot')}>
              Bot hervatten
            </Button>
            <Button size="sm" variant="default" onClick={() => resolveHandoff('dismissed', 'qualified')}>
              Gekwalificeerd
            </Button>
            <Button size="sm" variant="destructive" onClick={() => resolveHandoff('dismissed', 'rejected')}>
              Afgewezen
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gesprek</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {session.messages.map((msg) => (
            <div
              key={msg.id}
              className={cn('flex', msg.direction === 'outbound' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[75%] rounded-2xl px-4 py-2 text-sm',
                  msg.direction === 'outbound'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted',
                )}
              >
                <p className="whitespace-pre-wrap">{msg.body}</p>
                <p className="text-[10px] opacity-60 mt-1">
                  {format(new Date(msg.sentAt), 'HH:mm')}
                </p>
              </div>
            </div>
          ))}
          {session.messages.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-4">Geen berichten</p>
          )}
        </CardContent>
      </Card>

      {Object.keys(session.answers).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Antwoorden</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3">
              {Object.entries(session.answers).map(([key, ans]) => (
                <div key={key}>
                  <dt className="text-xs text-muted-foreground">{key}</dt>
                  <dd className="text-sm font-medium">
                    {JSON.stringify((ans as { value: unknown }).value)}
                    <span className="text-xs text-muted-foreground ml-1">
                      ({(ans as { confidence: string }).confidence})
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Aangemaakt {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true, locale: nl })}
        {session.completedAt && ` · Voltooid ${formatDistanceToNow(new Date(session.completedAt), { addSuffix: true, locale: nl })}`}
      </p>
    </div>
  )
}
