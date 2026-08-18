import { IDEA_STATUSES, type FavoriteIdea, type Idea, type IdeaStatus } from './shared.ts'

/** Parse one model line in the required `category｜idea` form. */
export function parseIdeaLine(text: string): Omit<Idea, 'id'> {
  const line = text.split('\n').map(value => value.trim()).find(Boolean)
  if (line === undefined) throw new Error('The model returned empty content.')
  const separator = line.includes('｜') ? '｜' : '|'
  const index = line.indexOf(separator)
  const category = index > 0 ? line.slice(0, index).replace(/^[-*#\s]+/, '').trim() : '灵感'
  const idea = index > 0 ? line.slice(index + 1).trim() : line
  if (idea.length === 0) throw new Error('The model returned an empty idea.')
  return { category: category || '灵感', idea }
}

/** Whether a wire value is one of the persisted status literals. */
export function isIdeaStatus(value: unknown): value is IdeaStatus {
  return typeof value === 'string' && (IDEA_STATUSES as readonly string[]).includes(value)
}

/** Return detached favorite records for wire responses and writes. */
export function cloneFavorites(items: readonly FavoriteIdea[]): FavoriteIdea[] {
  return items.map(item => ({ ...item }))
}

/** Replace one favorite without mutating the current settings snapshot. */
export function replaceFavorite(
  items: readonly FavoriteIdea[],
  id: string,
  change: Partial<Pick<FavoriteIdea, 'idea' | 'category' | 'status'>>,
): FavoriteIdea[] {
  let found = false
  const next = items.map(item => {
    if (item.id !== id) return { ...item }
    found = true
    return { ...item, ...change }
  })
  if (!found) throw new Error('找不到这条收藏。')
  return next
}
