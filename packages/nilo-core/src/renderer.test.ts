import { describe, it, expect } from 'vitest'
import { renderTemplate } from './renderer.js'

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
