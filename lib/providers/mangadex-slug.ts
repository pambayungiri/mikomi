export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export class SlugRegistry {
  private slugToUuid = new Map<string, string>()
  private uuidToSlug = new Map<string, string>()

  register(uuid: string, title: string): string {
    const existing = this.uuidToSlug.get(uuid)
    if (existing) return existing
    const slug = this.makeUnique(slugify(title), uuid)
    this.slugToUuid.set(slug, uuid)
    this.uuidToSlug.set(uuid, slug)
    return slug
  }

  getUuid(slug: string): string | undefined {
    return this.slugToUuid.get(slug)
  }

  getSlug(uuid: string): string | undefined {
    return this.uuidToSlug.get(uuid)
  }

  private makeUnique(base: string, uuid: string): string {
    if (!this.slugToUuid.has(base)) return base
    return `${base}-${uuid.slice(0, 8)}`
  }
}

export const slugRegistry = new SlugRegistry()
