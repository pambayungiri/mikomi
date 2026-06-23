import { describe, it, expect } from 'vitest'
import { parseValue, parseDoc } from './firestore'

describe('parseValue', () => {
  it('parses stringValue', () => {
    expect(parseValue({ stringValue: 'hello' })).toBe('hello')
  })

  it('parses integerValue as number', () => {
    expect(parseValue({ integerValue: '42' })).toBe(42)
  })

  it('parses doubleValue', () => {
    expect(parseValue({ doubleValue: 8.33 })).toBe(8.33)
  })

  it('parses timestampValue', () => {
    expect(parseValue({ timestampValue: '2026-06-01T00:00:00Z' })).toBe('2026-06-01T00:00:00Z')
  })

  it('parses arrayValue', () => {
    expect(parseValue({
      arrayValue: { values: [{ stringValue: 'Action' }, { stringValue: 'Fantasy' }] }
    })).toEqual(['Action', 'Fantasy'])
  })

  it('parses empty arrayValue', () => {
    expect(parseValue({ arrayValue: {} })).toEqual([])
  })

  it('parses mapValue', () => {
    expect(parseValue({
      mapValue: { fields: { name: { stringValue: 'test' } } }
    })).toEqual({ name: 'test' })
  })

  it('parses nullValue', () => {
    expect(parseValue({ nullValue: null })).toBeNull()
  })
})

describe('parseDoc', () => {
  it('extracts id from document name and parses fields', () => {
    const doc = {
      name: 'projects/p/databases/(default)/documents/KomikApp/abc123',
      fields: {
        name: { stringValue: 'One Piece' },
        views: { integerValue: '9999' },
      },
    }
    const result = parseDoc(doc)
    expect(result.id).toBe('abc123')
    expect(result.name).toBe('One Piece')
    expect(result.views).toBe(9999)
  })
})
