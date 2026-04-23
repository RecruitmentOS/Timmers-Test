import { useQuery } from '@tanstack/react-query'

export interface NiloSessionSummary {
  id: string
  contactPhone: string
  contactName: string | null
  state: string
  verdict: string | null
  matchScore: number | null
  answers: Record<string, { value: unknown; confidence: string }>
  context: Record<string, unknown>
  createdAt: string
  completedAt: string | null
}

export interface NiloMessage {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  isFromBot: boolean
  sentAt: string
}

async function fetchSessions(state?: string): Promise<{ sessions: NiloSessionSummary[]; total: number }> {
  const url = state ? `/api/nilo/sessions?state=${encodeURIComponent(state)}` : '/api/nilo/sessions'
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch nilo sessions')
  return res.json()
}

async function fetchSession(id: string): Promise<NiloSessionSummary & { messages: NiloMessage[]; handoffs: unknown[] }> {
  const res = await fetch(`/api/nilo/sessions/${id}`)
  if (!res.ok) throw new Error('Failed to fetch nilo session')
  return res.json()
}

export function useNiloSessions(state?: string) {
  return useQuery({
    queryKey: ['nilo-sessions', state],
    queryFn: () => fetchSessions(state),
    refetchInterval: 15000,
  })
}

export function useNiloSession(id: string) {
  return useQuery({
    queryKey: ['nilo-session', id],
    queryFn: () => fetchSession(id),
    refetchInterval: 5000,
  })
}
