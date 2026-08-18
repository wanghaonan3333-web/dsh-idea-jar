import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import {
  IDEA_JAR_API_PATH,
  IDEA_STATUSES,
  type FavoriteIdea,
  type FavoritesResult,
  type GenerateResult,
  type Idea,
  type IdeaJarRequest,
  type IdeaStatus,
} from '../shared.ts'

export const name = 'dsh-idea-jar'
export const inject = ['slots']

interface SlotsService {
  inject(name: string, register: () => unknown): void
  register(meta: Record<string, unknown>, component: () => unknown): unknown
}

interface ClientContext {
  slots: SlotsService
}

interface CurrentIdea extends Idea {
  error?: boolean
  favorite?: boolean
}

interface CardFeedback {
  id: string
  kind: 'loading' | 'success' | 'error'
  message: string
}

const labels: Record<IdeaStatus, string> = {
  planned: '计划中',
  'in-progress': '进行中',
  implemented: '已实现',
  archived: '暂不做',
}

const paperLayouts = [
  [14, 68, -8], [33, 69, 7], [23, 59, 4], [42, 58, -9], [10, 55, 10], [31, 49, -4],
  [16, 42, -8], [40, 41, 8], [27, 34, 3], [9, 31, 9], [38, 27, -7], [21, 22, 5],
] as const

const style = `
.ideaJarScene{position:fixed;right:18px;bottom:18px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;gap:9px;pointer-events:none;color:var(--dsw-alias-label-primary)}
.ideaJarScene button,.ideaJarScene input,.ideaJarScene textarea{font:inherit}.ideaJarBubble,.ideaJarPanel,.ideaJarJarWrap,.ideaJarRequirement{pointer-events:auto}
.ideaJarBubble,.ideaJarPanel{box-shadow:0 12px 30px rgba(0,0,0,.16)}.ideaJarBubble{position:relative;max-width:320px;padding:12px 40px 12px 13px;border:1px solid var(--dsw-alias-border-l1);border-radius:17px 17px 5px 17px;background:var(--dsw-alias-bg-overlay);font-size:13px;line-height:1.55}
.ideaJarMeta{display:flex;gap:5px;margin-bottom:4px;font-size:10px;color:var(--dsw-alias-label-secondary)}.ideaJarTag{padding:2px 7px;border-radius:999px;background:var(--dsw-alias-state-business-tertiary)}.ideaJarIcon{position:absolute;top:6px;border:0;background:transparent;cursor:pointer}.ideaJarStar{right:25px;color:var(--dsw-alias-state-warn-primary)}.ideaJarBubbleClose{right:6px;color:var(--dsw-alias-label-secondary)}
.ideaJarRequirement{box-sizing:border-box;width:230px;padding:8px 11px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;outline:none;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font-size:12px}.ideaJarRequirement:focus{border-color:var(--dsw-alias-brand-primary)}
.ideaJarJarWrap{position:relative;width:82px;height:98px}.ideaJarJar{position:absolute;right:5px;bottom:0;width:72px;height:90px;padding:0;border:0;background:transparent;cursor:pointer;filter:drop-shadow(0 5px 7px rgba(0,0,0,.14))}.ideaJarJar:disabled{cursor:wait}.ideaJarJar svg{width:72px;height:90px}
.ideaJarLibrary{position:absolute;right:-5px;top:15px;z-index:3;width:31px;height:31px;border:1px solid var(--dsw-alias-border-l1);border-radius:50%;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-state-warn-primary);box-shadow:0 4px 10px rgba(0,0,0,.16);cursor:pointer}.ideaJarCount{position:absolute;right:-5px;top:-5px;min-width:15px;height:15px;padding:0 3px;border-radius:8px;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-overlay);font-size:9px;line-height:15px}
.ideaJarWait{position:absolute;left:27px;top:-31px;width:30px;height:55px}.ideaJarWaitDot{position:absolute;left:11px;bottom:0;border:1.6px solid var(--dsw-alias-brand-primary);border-radius:50%;opacity:0;animation:ideaJarUp 1.5s ease-in-out infinite both}.ideaJarWaitDot:nth-child(1){width:7px;height:7px}.ideaJarWaitDot:nth-child(2){left:8px;width:10px;height:10px;animation-delay:.38s}.ideaJarWaitDot:nth-child(3){left:14px;width:6px;height:6px;animation-delay:.76s}.ideaJarPaper{animation:ideaJarDrop .42s ease-out both;transform-box:fill-box}
.ideaJarPanel{width:min(390px,calc(100vw - 32px));max-height:min(500px,68vh);overflow:auto;border:1px solid var(--dsw-alias-border-l1);border-radius:18px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 92%,#f2cf74 8%)}.ideaJarPanelTop{position:sticky;top:0;z-index:8;padding:13px 14px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}.ideaJarTitleRow{display:flex;justify-content:space-between}.ideaJarTitle{font-size:15px;font-weight:700}.ideaJarSubtitle{margin-top:2px;color:var(--dsw-alias-label-secondary);font-size:10px}.ideaJarPanelClose{width:25px;height:25px;border:0;border-radius:50%;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-secondary);cursor:pointer}
.ideaJarFilters{display:flex;gap:5px;margin-top:9px;overflow-x:auto;white-space:nowrap;scrollbar-width:none}.ideaJarFilter{flex:none;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:3px 8px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:10px}.ideaJarFilterOn{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-brand-text)}.ideaJarList{display:flex;flex-direction:column;gap:8px;padding:9px}
.ideaJarCard{position:relative;padding:10px 11px 9px 12px;border:1px solid var(--dsw-alias-border-l1);border-left-width:3px;border-radius:11px;background:color-mix(in srgb,var(--dsw-alias-bg-overlay) 91%,#ffe9a8 9%);box-shadow:0 2px 7px rgba(0,0,0,.05)}.ideaJarCard-planned{border-left-color:var(--dsw-alias-state-warn-primary)}.ideaJarCard-in-progress{border-left-color:var(--dsw-alias-brand-primary)}.ideaJarCard-implemented{border-left-color:var(--dsw-alias-state-success-primary)}.ideaJarCard-archived{border-left-color:var(--dsw-alias-label-secondary)}
.ideaJarCardHead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}.ideaJarCategory{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:10px;font-weight:650}.ideaJarStatusArea{position:relative;flex:none}.ideaJarStatus{display:flex;align-items:center;gap:5px;border:1px solid currentColor;border-radius:999px;padding:4px 8px;background:var(--dsw-alias-bg-overlay);font-size:10px;font-weight:650;cursor:pointer}.ideaJarStatus:disabled{opacity:.5}.ideaJarStatus-planned{color:var(--dsw-alias-state-warn-primary)}.ideaJarStatus-in-progress{color:var(--dsw-alias-brand-primary)}.ideaJarStatus-implemented{color:var(--dsw-alias-state-success-primary)}.ideaJarStatus-archived{color:var(--dsw-alias-label-secondary)}.ideaJarDot{width:6px;height:6px;border-radius:50%;background:currentColor}.ideaJarMenu{position:absolute;right:0;top:30px;z-index:20;width:116px;padding:5px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-overlay);box-shadow:0 8px 24px rgba(0,0,0,.18)}.ideaJarMenuItem{display:flex;width:100%;align-items:center;gap:7px;border:0;border-radius:7px;padding:7px 8px;background:transparent;color:var(--dsw-alias-label-primary);font-size:11px;cursor:pointer}.ideaJarMenuItem:hover{background:var(--dsw-alias-bg-layer-2)}
.ideaJarText{font-size:12px;line-height:1.58;white-space:pre-wrap}.ideaJarCollapsed{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.ideaJarEdit{box-sizing:border-box;width:100%;min-height:86px;padding:8px;border:1px solid var(--dsw-alias-brand-primary);border-radius:8px;resize:vertical;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:12px}.ideaJarFeedback{display:flex;gap:6px;align-items:center;margin-bottom:7px;padding:6px 8px;border-radius:7px;font-size:10px}.ideaJarFeedback-loading{background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-brand-text)}.ideaJarFeedback-success{border:1px solid var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary)}.ideaJarFeedback-error{border:1px solid var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}.ideaJarSpin{width:9px;height:9px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:ideaJarSpin .7s linear infinite}
.ideaJarActions{display:flex;align-items:center;gap:3px;margin-top:8px;flex-wrap:wrap}.ideaJarAction{border:0;border-radius:7px;padding:4px 6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:10px}.ideaJarAction:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}.ideaJarAction:disabled{opacity:.5;cursor:not-allowed}.ideaJarPrimary{background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-brand-text)}.ideaJarDelete{margin-left:auto}.ideaJarDelete:hover{color:var(--dsw-alias-state-error-primary)}.ideaJarCopied{color:var(--dsw-alias-state-success-primary);background:var(--dsw-alias-bg-layer-2)}.ideaJarEmpty{padding:30px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:11px}
@keyframes ideaJarUp{0%{opacity:0;transform:translate(0,9px) scale(.35)}18%{opacity:.9}50%{transform:translate(-3px,-18px) scale(.8)}100%{opacity:0;transform:translate(3px,-52px) scale(1.3)}}@keyframes ideaJarDrop{from{opacity:0;transform:translateY(-28px)}to{opacity:1;transform:translateY(0)}}@keyframes ideaJarSpin{to{transform:rotate(360deg)}}
@media(max-width:520px){.ideaJarScene{right:10px;bottom:10px}.ideaJarPanel{width:calc(100vw - 20px);max-height:72vh}.ideaJarBubble{max-width:calc(100vw - 50px)}}
`

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '请求失败。'
}

async function callApi<T>(request: IdeaJarRequest): Promise<T> {
  const response = await fetch(IDEA_JAR_API_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  })
  const value = await response.json() as unknown
  if (!response.ok) {
    const message = typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string'
      ? value.error
      : `请求失败（${String(response.status)}）。`
    throw new Error(message)
  }
  return value as T
}

function JarGraphic({ favorites }: { favorites: FavoriteIdea[] }) {
  const colors: Record<IdeaStatus, string> = {
    planned: 'var(--dsw-alias-state-warn-primary)',
    'in-progress': 'var(--dsw-alias-brand-primary)',
    implemented: 'var(--dsw-alias-state-success-primary)',
    archived: 'var(--dsw-alias-label-secondary)',
  }
  return <svg viewBox="0 0 72 90" aria-hidden="true">
    <defs><clipPath id="idea-jar-clip"><path d="M21 20H51C52 27 61 28 64 39V67C64 80 55 86 45 86H27C17 86 8 80 8 67V39C11 28 20 27 21 20Z" /></clipPath></defs>
    <g clipPath="url(#idea-jar-clip)">{favorites.slice(0, 12).reverse().map((item, index) => {
      const layout = paperLayouts[index]
      return <g key={item.id} transform={`translate(${String(layout[0])} ${String(layout[1])}) rotate(${String(layout[2])} 9 5)`}>
        <g className="ideaJarPaper"><rect width="18" height="10" rx="2" fill={colors[item.status]} opacity=".86" /></g>
      </g>
    })}</g>
    <path d="M21 20H51C52 27 61 28 64 39V67C64 80 55 86 45 86H27C17 86 8 80 8 67V39C11 28 20 27 21 20Z" fill="var(--dsw-alias-bg-overlay)" fillOpacity=".18" stroke="var(--dsw-alias-brand-primary)" strokeWidth="2.4" />
    <rect x="19" y="3" width="34" height="18" rx="5" fill="var(--dsw-alias-bg-overlay)" fillOpacity=".35" stroke="var(--dsw-alias-brand-primary)" strokeWidth="2.4" />
  </svg>
}

function IdeaJar() {
  const [current, setCurrent] = useState<CurrentIdea | null>(null)
  const [request, setRequest] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState<FavoriteIdea[]>([])
  const [filter, setFilter] = useState<'all' | IdeaStatus>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [optimizingId, setOptimizingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<CardFeedback | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void callApi<FavoritesResult>({ action: 'list' }).then(result => {
      if (active) setSaved(result.favorites)
    }).catch(error => console.error('[dsh-idea-jar]', error))
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (copiedId === null) return
    const timeout = window.setTimeout(() => setCopiedId(null), 1600)
    return () => window.clearTimeout(timeout)
  }, [copiedId])

  const visible = useMemo(
    () => filter === 'all' ? saved : saved.filter(item => item.status === filter),
    [filter, saved],
  )

  const generate = async () => {
    if (busy) return
    setBusy(true)
    try {
      const result = await callApi<GenerateResult>({ action: 'generate', request })
      setCurrent(result.item)
    } catch (error) {
      setCurrent({ id: `error-${String(Date.now())}`, category: '提示', idea: errorMessage(error), error: true })
    } finally {
      setBusy(false)
    }
  }

  const handleRequirementKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    void generate()
  }

  const favoriteCurrent = async () => {
    if (current === null || current.error) return
    try {
      const result = await callApi<FavoritesResult>({ action: 'favorite', item: current })
      setSaved(result.favorites)
      setCurrent({ ...current, favorite: true })
    } catch (error) {
      setCurrent({ ...current, category: '保存失败', idea: errorMessage(error), error: true })
    }
  }

  const updateStatus = async (item: FavoriteIdea, status: IdeaStatus) => {
    setStatusMenuId(null)
    try {
      const result = await callApi<FavoritesResult>({ action: 'update', id: item.id, status })
      setSaved(result.favorites)
    } catch (error) {
      setFeedback({ id: item.id, kind: 'error', message: errorMessage(error) })
    }
  }

  const saveEdit = async (item: FavoriteIdea) => {
    try {
      const result = await callApi<FavoritesResult>({ action: 'update', id: item.id, idea: editText })
      setSaved(result.favorites)
      setEditId(null)
      setEditText('')
    } catch (error) {
      setFeedback({ id: item.id, kind: 'error', message: errorMessage(error) })
    }
  }

  const optimize = async (item: FavoriteIdea) => {
    if (optimizingId !== null) return
    setExpandedId(item.id)
    setOptimizingId(item.id)
    setFeedback({ id: item.id, kind: 'loading', message: 'AI 正在打磨这张纸条…' })
    try {
      const result = await callApi<FavoritesResult>({ action: 'optimize', id: item.id })
      setSaved(result.favorites)
      setFeedback({ id: item.id, kind: 'success', message: '优化完成，内容已保存。' })
    } catch (error) {
      setFeedback({ id: item.id, kind: 'error', message: errorMessage(error) })
    } finally {
      setOptimizingId(null)
    }
  }

  const remove = async (item: FavoriteIdea) => {
    try {
      const result = await callApi<FavoritesResult>({ action: 'remove', id: item.id })
      setSaved(result.favorites)
      if (expandedId === item.id) setExpandedId(null)
    } catch (error) {
      setFeedback({ id: item.id, kind: 'error', message: errorMessage(error) })
    }
  }

  const copyIdea = async (item: FavoriteIdea) => {
    try {
      await navigator.clipboard.writeText(`${item.category}｜${item.idea}`)
      setCopiedId(item.id)
      setFeedback(null)
    } catch (error) {
      setFeedback({ id: item.id, kind: 'error', message: `复制失败：${errorMessage(error)}` })
    }
  }

  return <div className="ideaJarScene">
    <style>{style}</style>
    {current !== null && <>
      <div className="ideaJarBubble">
        {!current.error && <button className="ideaJarIcon ideaJarStar" onClick={() => void favoriteCurrent()} aria-label="收藏灵感">{current.favorite ? '★' : '☆'}</button>}
        <button className="ideaJarIcon ideaJarBubbleClose" onClick={() => setCurrent(null)} aria-label="关闭灵感">×</button>
        <div className="ideaJarMeta"><span className="ideaJarTag">{current.category}</span></div>
        {current.idea}
      </div>
      <input className="ideaJarRequirement" value={request} onChange={event => setRequest(event.target.value)} onKeyDown={handleRequirementKey} placeholder="继续加一点需求…" aria-label="额外创意需求" />
    </>}

    {open && <section className="ideaJarPanel" aria-label="灵感收藏">
      <div className="ideaJarPanelTop">
        <div className="ideaJarTitleRow">
          <div><div className="ideaJarTitle">灵感收藏</div><div className="ideaJarSubtitle">{saved.length} 张纸条 · 自动持久保存</div></div>
          <button className="ideaJarPanelClose" onClick={() => setOpen(false)} aria-label="关闭收藏">×</button>
        </div>
        <div className="ideaJarFilters">
          {([['all', '全部'], ...IDEA_STATUSES.map(status => [status, labels[status]] as const)] as const).map(([key, text]) => {
            const count = key === 'all' ? saved.length : saved.filter(item => item.status === key).length
            return <button key={key} className={`ideaJarFilter${filter === key ? ' ideaJarFilterOn' : ''}`} onClick={() => setFilter(key)}>{text} {count}</button>
          })}
        </div>
      </div>
      {visible.length === 0
        ? <div className="ideaJarEmpty">{saved.length === 0 ? '罐子还是空的' : '这个状态还没有灵感'}</div>
        : <div className="ideaJarList">{visible.map(item => {
          const loading = optimizingId === item.id
          const editing = editId === item.id
          const ownFeedback = feedback?.id === item.id ? feedback : null
          const expanded = expandedId === item.id || editing || loading || ownFeedback !== null
          return <article key={item.id} className={`ideaJarCard ideaJarCard-${item.status}`}>
            <div className="ideaJarCardHead">
              <span className="ideaJarCategory">{item.category}</span>
              <div className="ideaJarStatusArea">
                <button className={`ideaJarStatus ideaJarStatus-${item.status}`} disabled={loading} onClick={() => setStatusMenuId(statusMenuId === item.id ? null : item.id)}>
                  <span className="ideaJarDot" />{labels[item.status]}⌄
                </button>
                {statusMenuId === item.id && <div className="ideaJarMenu">{IDEA_STATUSES.map(status => <button key={status} className="ideaJarMenuItem" onClick={() => void updateStatus(item, status)}>
                  <span className={`ideaJarDot ideaJarStatus-${status}`} />{labels[status]}
                </button>)}</div>}
              </div>
            </div>
            {ownFeedback !== null && <div className={`ideaJarFeedback ideaJarFeedback-${ownFeedback.kind}`}>
              {ownFeedback.kind === 'loading' ? <span className="ideaJarSpin" /> : ownFeedback.kind === 'success' ? '✓' : '!'}{ownFeedback.message}
            </div>}
            {editing
              ? <textarea className="ideaJarEdit" value={editText} onChange={event => setEditText(event.target.value)} aria-label="编辑灵感" />
              : <div className={`ideaJarText${expanded ? '' : ' ideaJarCollapsed'}`}>{item.idea}</div>}
            <div className="ideaJarActions">
              {editing ? <>
                <button className="ideaJarAction ideaJarPrimary" onClick={() => void saveEdit(item)}>保存</button>
                <button className="ideaJarAction" onClick={() => { setEditId(null); setEditText('') }}>取消</button>
              </> : <>
                <button className="ideaJarAction" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>{expanded ? '收起' : '展开'}</button>
                <button className={`ideaJarAction${copiedId === item.id ? ' ideaJarCopied' : ''}`} onClick={() => void copyIdea(item)}>{copiedId === item.id ? '✓ 已复制' : '⧉ 复制'}</button>
                <button className="ideaJarAction" disabled={loading} onClick={() => { setEditId(item.id); setEditText(item.idea); setExpandedId(item.id); setFeedback(null) }}>编辑</button>
                <button className="ideaJarAction ideaJarPrimary" disabled={loading} onClick={() => void optimize(item)}>{loading ? '优化中…' : '✦ AI 优化'}</button>
                <button className="ideaJarAction ideaJarDelete" disabled={loading} onClick={() => void remove(item)}>删除</button>
              </>}
            </div>
          </article>
        })}</div>}
    </section>}

    <div className="ideaJarJarWrap">
      {busy && <div className="ideaJarWait"><span className="ideaJarWaitDot" /><span className="ideaJarWaitDot" /><span className="ideaJarWaitDot" /></div>}
      <button className="ideaJarJar" onClick={() => void generate()} disabled={busy} aria-label="生成一条灵感"><JarGraphic favorites={saved} /></button>
      <button className="ideaJarLibrary" onClick={() => setOpen(!open)} aria-label="打开灵感收藏">★{saved.length > 0 && <span className="ideaJarCount">{saved.length}</span>}</button>
    </div>
  </div>
}

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'idea-jar',
    order: 20,
    label: '灵感罐',
  }, IdeaJar))
}
