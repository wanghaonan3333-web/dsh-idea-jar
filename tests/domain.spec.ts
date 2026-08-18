import { describe, expect, it } from 'vitest'
import {
  cloneFavorites,
  isIdeaStatus,
  mergeFavorites,
  parseIdeaLine,
  parseImportText,
  replaceFavorite,
} from '../src/domain.ts'
import { favoritesToJson, favoritesToMarkdown, type FavoriteIdea } from '../src/shared.ts'

const favorite: FavoriteIdea = {
  id: 'idea-1',
  category: '互动体验',
  idea: '让城市声音变成一张可探索的地图。',
  status: 'planned',
}

function b64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64')
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
    expect(replaceFavorite(source, 'idea-1', { status: 'in-progress', category: '故事' })).toEqual([
      { ...favorite, status: 'in-progress', category: '故事' },
    ])
    expect(source[0].status).toBe('planned')
  })
})

describe('mergeFavorites', () => {
  it('prepends fresh items, replaces existing ones in place, and caps the list', () => {
    const existing = [favorite, { ...favorite, id: 'idea-2', status: 'implemented' as const }]
    const incoming = [
      { ...favorite, idea: '改过的想法。' },
      { ...favorite, id: 'idea-3', status: 'archived' as const },
    ]
    expect(mergeFavorites(existing, incoming, 3)).toEqual([
      { ...favorite, id: 'idea-3', status: 'archived' },
      { ...favorite, idea: '改过的想法。' },
      { ...favorite, id: 'idea-2', status: 'implemented' },
    ])
    expect(mergeFavorites(existing, incoming, 2)).toHaveLength(2)
  })
})

describe('parseImportText', () => {
  it('parses the plugin JSON backup with a favorites wrapper', () => {
    const text = favoritesToJson([favorite])
    const result = parseImportText(text)
    expect(result.skipped).toBe(0)
    expect(result.items).toEqual([favorite])
  })

  it('parses a bare JSON array and skips malformed entries', () => {
    const result = parseImportText(JSON.stringify([favorite, { id: 'x', idea: '缺字段' }]))
    expect(result.skipped).toBe(1)
    expect(result.items).toEqual([favorite])
  })

  it('parses the legacy tab-separated base64 format', () => {
    const line = `idea-12\tplanned\t${b64('开发者工具')}\t${b64('一键审核报告工具。')}`
    const result = parseImportText(line)
    expect(result.skipped).toBe(0)
    expect(result.items).toEqual([{
      id: 'idea-12',
      category: '开发者工具',
      idea: '一键审核报告工具。',
      status: 'planned',
    }])
  })

  it('rejects empty import payloads', () => {
    expect(() => parseImportText('   ')).toThrow('导入内容为空')
  })

  it('round-trips favorites through JSON export', () => {
    const items = [favorite, { ...favorite, id: 'idea-2', status: 'archived' as const }]
    expect(parseImportText(favoritesToJson(items)).items).toEqual(items)
  })

  it('renders a readable markdown list', () => {
    expect(favoritesToMarkdown([favorite])).toContain('- [计划中] 互动体验｜让城市声音变成一张可探索的地图。')
  })
})
