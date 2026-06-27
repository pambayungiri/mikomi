import { describe, it, expect, beforeEach } from 'vitest'
import { slugify, SlugRegistry } from './mangadex-slug'

describe('slugify', () => {
  it('lowercases and replaces spaces with dashes', () => {
    expect(slugify('One Piece')).toBe('one-piece')
  })

  it('removes special characters', () => {
    expect(slugify('Mairimashita! Iruma-kun')).toBe('mairimashita-iruma-kun')
  })

  it('collapses multiple dashes', () => {
    expect(slugify('86--Eighty Six')).toBe('86-eighty-six')
  })

  it('trims leading and trailing dashes', () => {
    expect(slugify('!Hello!')).toBe('hello')
  })

  it('handles already-clean input', () => {
    expect(slugify('naruto')).toBe('naruto')
  })

  it('handles non-latin characters by removing them', () => {
    expect(slugify('進撃の巨人 Attack on Titan')).toBe('attack-on-titan')
  })
})

describe('SlugRegistry', () => {
  let reg: SlugRegistry

  beforeEach(() => { reg = new SlugRegistry() })

  it('registers a UUID and returns a slug', () => {
    expect(reg.register('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'One Piece')).toBe('one-piece')
  })

  it('getUuid returns the UUID for a known slug', () => {
    reg.register('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'One Piece')
    expect(reg.getUuid('one-piece')).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
  })

  it('getSlug returns the slug for a known UUID', () => {
    reg.register('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'One Piece')
    expect(reg.getSlug('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe('one-piece')
  })

  it('returns same slug when same UUID is registered twice', () => {
    reg.register('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'One Piece')
    expect(reg.register('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'One Piece')).toBe('one-piece')
  })

  it('makes slug unique when two different UUIDs produce the same base slug', () => {
    reg.register('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'One Piece')
    const slug2 = reg.register('11111111-bbbb-cccc-dddd-eeeeeeeeeeee', 'One Piece')
    expect(slug2).toBe('one-piece-11111111')
    expect(reg.getUuid('one-piece-11111111')).toBe('11111111-bbbb-cccc-dddd-eeeeeeeeeeee')
  })

  it('returns undefined for unknown slug', () => {
    expect(reg.getUuid('unknown')).toBeUndefined()
  })

  it('returns undefined for unknown UUID', () => {
    expect(reg.getSlug('unknown-uuid')).toBeUndefined()
  })
})
