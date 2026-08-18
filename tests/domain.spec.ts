import { describe, expect, it } from 'vitest'
import { cloneFavorites, isIdeaStatus, parseIdeaLine, replaceFavorite } from '../src/domain.ts'

const favorite = {
  id: 'idea-1',
  category: '互动体验',
  idea: '让城市声音变成一张可探索的地图。',
  status: 'planned' as const,
}

describe('idea domain', () => {
  it('parses full-width and ASCII separators', () => {
    expect(parseIdeaLine('互动体验｜让城市声音可视化。')).toEqual({
      category: '互动体验',
      idea: '让城市声音可视化。',
    })
    expect(parseIdeaLine('故事|一封来自未来的退稿信。')).toEqual({
      category: '故事',
      idea: '一封来自未来的退稿信。',
    })
  })

  it('rejects empty model output', () => {
    expect(() => parseIdeaLine('  \n ')).toThrow('empty content')
  })

  it('recognizes only supported statuses', () => {
    expect(isIdeaStatus('implemented')).toBe(true)
    expect(isIdeaStatus('done')).toBe(false)
  })

  it('returns detached copies and immutable replacements', () => {
    const source = [favorite]
    const copies = cloneFavorites(source)
    expect(copies).toEqual(source)
    expect(copies[0]).not.toBe(source[0])
    expect(replaceFavorite(source, 'idea-1', { status: 'in-progress' })).toEqual([
      { ...favorite, status: 'in-progress' },
    ])
    expect(source[0].status).toBe('planned')
  })
})
