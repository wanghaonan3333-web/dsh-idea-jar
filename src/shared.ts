export const IDEA_JAR_API_PATH = '/idea-jar/api'

export const IDEA_STATUSES = ['planned', 'in-progress', 'implemented', 'archived'] as const

export type IdeaStatus = typeof IDEA_STATUSES[number]

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  planned: '计划中',
  'in-progress': '进行中',
  implemented: '已实现',
  archived: '暂不做',
}

export interface Idea {
  id: string
  category: string
  idea: string
}

export interface FavoriteIdea extends Idea {
  status: IdeaStatus
}

export interface FavoritesResult {
  favorites: FavoriteIdea[]
}

export interface FeatureFlags {
  newSession: boolean
}

export interface ListResult extends FavoritesResult {
  features: FeatureFlags
}

export interface GenerateResult {
  items: Idea[]
}

export interface ExpandResult {
  id: string
  plan: string
}

export interface ImportResult extends FavoritesResult {
  imported: number
  skipped: number
}

export type IdeaJarRequest =
  | { action: 'list' }
  | { action: 'generate'; request: string; count?: number }
  | { action: 'favorite'; item: Idea }
  | { action: 'update'; id: string; category?: string; idea?: string; status?: IdeaStatus }
  | { action: 'optimize'; id: string }
  | { action: 'expand'; id: string }
  | { action: 'remove'; id: string }
  | { action: 'import'; text: string }

/** Serialize favorites to the canonical, round-trippable JSON backup format. */
export function favoritesToJson(items: readonly FavoriteIdea[]): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), favorites: items }, null, 2)
}

/** Render favorites as a human-readable Markdown list (read-only, not re-importable). */
export function favoritesToMarkdown(items: readonly FavoriteIdea[]): string {
  const lines = ['# 灵感罐收藏', '', `共 ${String(items.length)} 条`, '']
  for (const item of items) lines.push(`- [${IDEA_STATUS_LABELS[item.status]}] ${item.category}｜${item.idea}`)
  lines.push('')
  return lines.join('\n')
}

/** Render one favorite as an executable prompt for a new session. */
export function ideaToTaskPrompt(item: FavoriteIdea): string {
  return `灵感分类：${item.category}\n灵感内容：${item.idea}\n\n请据此直接开始执行：先给出简短计划，再完成第一版。`
}
