import { describe, it, expect } from 'vitest'
import { renderTemplate, buildTemplateContext } from './renderer.js'

describe('renderTemplate', () => {
  it('replaces merge tags with context values', () => {
    const result = renderTemplate(
      'Hoi {{candidate.first_name}}, voor {{vacancy.title}}!',
      {
        candidate: { first_name: 'Jan', full_name: 'Jan de Vries' },
        vacancy: { title: 'Chauffeur CE', location: null, start_date: null },
        tenant: { name: 'Timmers' },
      },
    )
    expect(result).toBe('Hoi Jan, voor Chauffeur CE!')
  })

  it('replaces null/undefined with empty string', () => {
    const result = renderTemplate('Locatie: {{vacancy.location}}', {
      candidate: { first_name: 'Jan', full_name: 'Jan de Vries' },
      vacancy: { title: 'T', location: null, start_date: null },
      tenant: { name: 'T' },
    })
    expect(result).toBe('Locatie: ')
  })

  it('ignores unknown scopes', () => {
    const result = renderTemplate('{{unknown.field}} test', {
      candidate: { first_name: 'J', full_name: 'J V' },
      vacancy: { title: 'T', location: null, start_date: null },
      tenant: { name: 'T' },
    })
    expect(result).toBe(' test')
  })
})

describe('buildTemplateContext', () => {
  it('uses first_name from first word of contactName', () => {
    const ctx = buildTemplateContext(
      { contactName: 'Jan de Vries', context: { vacancy_title: 'Chauffeur CE' } },
      { name: 'Timmers' },
    )
    expect(ctx.candidate.first_name).toBe('Jan')
    expect(ctx.candidate.full_name).toBe('Jan de Vries')
    expect(ctx.vacancy.title).toBe('Chauffeur CE')
    expect(ctx.tenant.name).toBe('Timmers')
  })

  it('falls back to "there" when contactName is null', () => {
    const ctx = buildTemplateContext(
      { contactName: null, context: {} },
      { name: 'T' },
    )
    expect(ctx.candidate.first_name).toBe('there')
    expect(ctx.candidate.full_name).toBe('')
  })

  it('falls back to "there" when contactName is empty string', () => {
    const ctx = buildTemplateContext(
      { contactName: '', context: {} },
      { name: 'T' },
    )
    expect(ctx.candidate.first_name).toBe('there')
  })

  it('returns empty vacancy title when context key missing', () => {
    const ctx = buildTemplateContext(
      { contactName: 'Jan', context: {} },
      { name: 'T' },
    )
    expect(ctx.vacancy.title).toBe('')
    expect(ctx.vacancy.location).toBeNull()
    expect(ctx.vacancy.start_date).toBeNull()
  })

  it('maps vacancy_location and start_date from context', () => {
    const ctx = buildTemplateContext(
      {
        contactName: 'Jan',
        context: {
          vacancy_title: 'Chauffeur',
          vacancy_location: 'Rotterdam',
          start_date: '2026-05-01',
        },
      },
      { name: 'T' },
    )
    expect(ctx.vacancy.location).toBe('Rotterdam')
    expect(ctx.vacancy.start_date).toBe('2026-05-01')
  })
})
