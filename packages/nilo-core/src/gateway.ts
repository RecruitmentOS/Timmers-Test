export interface WhatsAppSendInput {
  toPhone: string
  body: string
  templateSid?: string
  templateVariables?: Record<string, string>
}

export interface WhatsAppSendResult {
  messageSid: string
  status: 'queued' | 'sent'
}

export interface WhatsAppInboundParsed {
  fromPhone: string
  messageSid: string
  body: string
  mediaUrls: string[]
}

export interface WhatsAppGateway {
  send(input: WhatsAppSendInput): Promise<WhatsAppSendResult>
  verifyWebhook(signature: string, url: string, params: Record<string, string>): boolean
  parseWebhook(params: Record<string, string>): WhatsAppInboundParsed
  isWithin24hWindow(phone: string, orgId: string): Promise<boolean>
}
