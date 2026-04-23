export type NiloSessionState =
  | 'created'
  | 'initiated'
  | 'in_progress'
  | 'awaiting_human'
  | 'completed'
  | 'abandoned'

export type NiloConfidence = 'high' | 'medium' | 'low'

export interface NiloSession {
  id: string
  orgId: string
  flowId: string | null
  contactPhone: string
  contactName: string | null
  context: Record<string, unknown>
  state: NiloSessionState
  verdict: 'qualified' | 'rejected' | 'unsure' | null
  verdictReason: string | null
  answers: Record<string, { value: unknown; confidence: NiloConfidence }>
  stuckCounter: Record<string, number>
  reminderCount: number
  matchScore: number | null
  outboundWebhookUrl: string | null
  createdAt: Date
  initiatedAt: Date | null
  completedAt: Date | null
  lastInboundAt: Date | null
  lastOutboundAt: Date | null
}

export interface NiloCriteria {
  mustHave: {
    licenses?: string[]
    availability?: boolean
    rightToWork?: boolean
    minAge?: number
    locationRadiusKm?: number
    customKeys?: Array<{ key: string; question: string; required: boolean }>
    [key: string]: unknown
  }
  niceToHave?: {
    experienceYearsMin?: number
    certifications?: string[]
    preferredLanguages?: string[]
    freeText?: string
    [key: string]: unknown
  }
}

export interface NiloTemplates {
  first_contact: string
  reminder_24h: string
  reminder_72h: string
  no_response_farewell: string
  [variant: string]: string
}

export interface ReminderStep {
  afterSeconds: number
  variant: string
}

export interface NiloFlow {
  id: string
  orgId: string
  name: string
  locale: 'nl' | 'en' | 'pl' | 'ro'
  vacancyId?: string
  criteria: NiloCriteria
  templates: NiloTemplates
  reminderChain: ReminderStep[]
  systemPromptExtra?: string
  webhookUrl?: string
  slackWebhookUrl?: string
  scoreThreshold?: number
}

export interface NiloPersistence {
  getSession(orgId: string, sessionId: string): Promise<NiloSession | null>
  getRecentMessages(
    orgId: string,
    sessionId: string,
    limit?: number,
  ): Promise<Array<{ direction: 'inbound' | 'outbound'; body: string; sentAt: Date }>>
  setInitiated(orgId: string, sessionId: string): Promise<void>
  setInProgress(orgId: string, sessionId: string): Promise<void>
  incrementReminderCount(orgId: string, sessionId: string): Promise<void>
  persistOutbound(
    orgId: string,
    sessionId: string,
    body: string,
    twilioSid: string,
    toolCalls?: Array<{ name: string; input: Record<string, unknown> }>,
  ): Promise<void>
  recordAnswer(orgId: string, sessionId: string, key: string, value: unknown, confidence: NiloConfidence): Promise<void>
  bumpStuck(orgId: string, sessionId: string, key: string): Promise<number>
  escalate(orgId: string, sessionId: string, reason: string, context: string): Promise<void>
  finalize(orgId: string, sessionId: string, status: 'qualified' | 'rejected' | 'unsure', summary: string, rejectionReason?: string): Promise<void>
  scheduleJob(orgId: string, sessionId: string, afterSeconds: number, variant: string): Promise<void>
}

export interface NiloTemplateContext {
  candidate: { first_name: string; full_name: string }
  vacancy: { title: string; location: string | null; start_date: string | null }
  tenant: { name: string }
}
