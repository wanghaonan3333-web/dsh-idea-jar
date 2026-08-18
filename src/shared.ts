export const IDEA_JAR_API_PATH = '/idea-jar/api'

export const IDEA_STATUSES = ['planned', 'in-progress', 'implemented', 'archived'] as const

export type IdeaStatus = typeof IDEA_STATUSES[number]

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

export interface GenerateResult {
  item: Idea
}

export type IdeaJarRequest =
  | { action: 'list' }
  | { action: 'generate'; request: string }
  | { action: 'favorite'; item: Idea }
  | { action: 'update'; id: string; idea?: string; status?: IdeaStatus }
  | { action: 'optimize'; id: string }
  | { action: 'remove'; id: string }
