import { IDEA_STATUSES, type FavoriteIdea, type Idea, type IdeaStatus } from './shared.ts'

/** Parse one model line in the required `category｜idea` form. */
export function parseIdeaLine(text: string): Omit<Idea, 'id'> {
  const line = text.split('\n').map(value => value.trim()).find(Boolean)
  if (line === undefined) throw new Error('模型没有返回内容，请稍后重试。')
  const separator = line.includes('｜') ? '｜' : '|'
  const index = line.indexOf(separator)
  const category = index > 0 ? line.slice(0, index).replace(/^[-*#\s]+/, '').trim() : '灵感'
  const idea = index > 0 ? line.slice(index + 1).trim() : line
  if (idea.length === 0) throw new Error('模型没有返回有效灵感，请换一个试试。')
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

/** Upsert incoming favorites over the existing list, newest first, capped at `max`. */
export function mergeFavorites(
  existing: readonly FavoriteIdea[],
  incoming: readonly FavoriteIdea[],
  max: number,
): FavoriteIdea[] {
  const existingIds = new Set(existing.map(item => item.id))
  const incomingById = new Map(incoming.map(item => [item.id, item]))
  const fresh = incoming.filter(item => !existingIds.has(item.id))
  const merged = [
    ...fresh,
    ...existing.map(item => incomingById.has(item.id) ? { ...incomingById.get(item.id)! } : { ...item }),
  ]
  return merged.slice(0, max)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function decodeLegacyField(encoded: string): string | undefined {
  try {
    return Buffer.from(encoded.trim(), 'base64').toString('utf8')
  } catch (error) {
    return undefined
  }
}

/** Parse one legacy dynamic-plugin line: `id \t status \t base64(category) \t base64(idea)`. */
function parseLegacyLine(line: string): FavoriteIdea | undefined {
  const parts = line.split('\t')
  if (parts.length !== 4) return undefined
  const [id, status, categoryEncoded, ideaEncoded] = parts
  const category = decodeLegacyField(categoryEncoded)
  const idea = decodeLegacyField(ideaEncoded)
  const trimmedId = id.trim()
  if (trimmedId.length === 0 || !isIdeaStatus(status) || category === undefined || idea === undefined) return undefined
  return { id: trimmedId, status, category: category.trim() || '灵感', idea: idea.trim() }
}

export interface ParsedImport {
  items: FavoriteIdea[]
  skipped: number
}

function parseJsonImport(text: string): ParsedImport {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (error) {
    throw new Error('不是有效的 JSON 文件。')
  }
  const raw = Array.isArray(data) ? data : isRecord(data) ? data.favorites : undefined
  if (!Array.isArray(raw)) throw new Error('JSON 里缺少 favorites 数组。')
  let skipped = 0
  const items: FavoriteIdea[] = []
  for (const entry of raw) {
    if (!isRecord(entry)) { skipped += 1; continue }
    const id = typeof entry.id === 'string' ? entry.id.trim() : ''
    const category = typeof entry.category === 'string' ? entry.category.trim() : ''
    const idea = typeof entry.idea === 'string' ? entry.idea.trim() : ''
    const status = entry.status
    if (id.length === 0 || category.length === 0 || idea.length === 0 || !isIdeaStatus(status)) { skipped += 1; continue }
    items.push({ id, category: category || '灵感', idea, status })
  }
  return { items, skipped }
}

function parseLegacyImport(text: string): ParsedImport {
  let skipped = 0
  const items: FavoriteIdea[] = []
  for (const line of text.split('\n').map(value => value.trim()).filter(Boolean)) {
    const item = parseLegacyLine(line)
    if (item === undefined) skipped += 1
    else items.push(item)
  }
  return { items, skipped }
}

/**
 * Parse an import payload into favorite records. Accepts the plugin's own JSON
 * backup (bare array or `{ favorites: [...] }`) and the legacy dynamic-plugin
 * tab-separated base64 format. Malformed entries are counted and skipped.
 */
export function parseImportText(text: string): ParsedImport {
  const trimmed = text.trim()
  if (trimmed.length === 0) throw new Error('导入内容为空。')
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return parseJsonImport(trimmed)
  return parseLegacyImport(trimmed)
}
