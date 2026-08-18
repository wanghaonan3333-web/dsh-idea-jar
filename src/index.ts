import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type AgentDefaultModelConfig from '@deepseek-ai/dsh-agent-default-model'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { BlockAssembler, MessageId } from '@deepseek-ai/dsh-llm'
import Schema from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { cloneFavorites, isIdeaStatus, mergeFavorites, parseIdeaLine, parseImportText, replaceFavorite } from './domain.ts'
import {
  IDEA_JAR_API_PATH,
  type ExpandResult,
  type FavoriteIdea,
  type FavoritesResult,
  type GenerateResult,
  type Idea,
  type IdeaJarRequest,
  type ImportResult,
  type ListResult,
} from './shared.ts'

export const name = 'dsh-idea-jar'
export const inject = ['llm', 'agentDefaultModel', 'settings', 'webServer']

export interface Config {
  maxFavorites: number
  maxRequestChars: number
  maxIdeaChars: number
  maxTokens: number
  maxBatch: number
  enableNewSession: boolean
}

export const Config: Schema<Config> = Schema.object({
  maxFavorites: Schema.number().step(1).min(1).max(2000).default(200),
  maxRequestChars: Schema.number().step(1).min(1).max(20000).default(2000),
  maxIdeaChars: Schema.number().step(1).min(80).max(10000).default(1000),
  maxTokens: Schema.number().step(1).min(64).max(4096).default(320),
  maxBatch: Schema.number().step(1).min(1).max(10).default(3),
  enableNewSession: Schema.boolean().default(false),
})

interface IdeaJarSettings {
  favorites: FavoriteIdea[]
}

const favoriteSchema: Schema<FavoriteIdea> = Schema.object({
  id: Schema.string().required(),
  category: Schema.string().required(),
  idea: Schema.string().required(),
  status: Schema.union(['planned', 'in-progress', 'implemented', 'archived']).required(),
})

const settingsSchema: Schema<IdeaJarSettings> = Schema.object({
  favorites: Schema.array(favoriteSchema).default([]),
})

const SETTINGS_NAMESPACE = settingsNamespace('idea-jar')
const MAX_API_BODY_BYTES = 2 * 1024 * 1024
const MAX_CATEGORY_CHARS = 100

const generationSystem = `你是“灵感罐”的创意总监。生成一条新颖、具体、可继续执行的创作灵感，类型可以是软件、插件、网页、故事、短片、视觉设计、互动体验、内容栏目、工作流、游戏机制或其他形式。没有额外需求时随机选择不同领域；有需求时判断领域、目标和限制，在满足要求的基础上加入合理但意外的创意转折。灵感必须具体，并根据作品类型补足适合的核心维度。不要强行转化媒介。只有用户明确要求 DeepSeek Harness 插件时才按该方向构思，且不虚构具体 API。输出 80 至 180 个汉字，只输出一条，不解释，不使用 Markdown。格式：分类｜灵感内容。`

const optimizationSystem = `你是“灵感罐”的创意编辑。保留已有灵感最有价值的核心，判断创作类型，补充具体细节、核心体验和差异化亮点，删除空泛重复内容，使其可以继续创作或做出第一版。不要替换成完全不同的想法。只输出：分类｜优化后的灵感。`

const expansionSystem = `你是“灵感罐”的执行教练。针对用户给的一条创作灵感，产出可立即动手的执行拆解，包含：一句话目标、具体的第一步动作、所需的素材或工具清单。输出为简洁中文，分点列出，不要寒暄，不要重复原文。`

interface IdeaJarContext extends Context {
  agentDefaultModel: AgentDefaultModelConfig
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(value: unknown, field: string, maxChars: number): string {
  if (typeof value !== 'string') throw new HttpError(400, `${field} 必须是字符串。`)
  const text = value.trim()
  if (text.length === 0 || text.length > maxChars) {
    throw new HttpError(400, `${field} 长度必须在 1 到 ${String(maxChars)} 个字符之间。`)
  }
  return text
}

function requireIdea(value: unknown, maxIdeaChars: number): Idea {
  if (!isRecord(value)) throw new HttpError(400, '灵感数据无效。')
  return {
    id: requireString(value.id, 'id', 100),
    category: requireString(value.category, 'category', MAX_CATEGORY_CHARS),
    idea: requireString(value.idea, 'idea', maxIdeaChars),
  }
}

function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  const host = req.headers.host
  if (origin === undefined || host === undefined) return false
  try {
    const parsed = new URL(origin)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.host === host
  } catch (error) {
    if (error instanceof TypeError) return false
    throw error
  }
}

async function readRequest(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += buffer.byteLength
    if (bytes > MAX_API_BODY_BYTES) throw new HttpError(413, '请求内容过大。')
    chunks.push(buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch (error) {
    throw new HttpError(400, error instanceof SyntaxError ? '请求不是有效 JSON。' : '无法读取请求。')
  }
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(value))
}

function parseRequest(value: unknown, config: Config): IdeaJarRequest {
  if (!isRecord(value) || typeof value.action !== 'string') throw new HttpError(400, '缺少 action。')
  switch (value.action) {
    case 'list': return { action: 'list' }
    case 'generate': {
      if (typeof value.request !== 'string' || value.request.length > config.maxRequestChars) {
        throw new HttpError(400, `额外需求不能超过 ${String(config.maxRequestChars)} 个字符。`)
      }
      const count = value.count === undefined ? 1 : value.count
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > config.maxBatch) {
        throw new HttpError(400, `一次只能生成 1 到 ${String(config.maxBatch)} 条灵感。`)
      }
      return { action: 'generate', request: value.request.trim(), count }
    }
    case 'favorite': return { action: 'favorite', item: requireIdea(value.item, config.maxIdeaChars) }
    case 'update': {
      const id = requireString(value.id, 'id', 100)
      const category = value.category === undefined ? undefined : requireString(value.category, 'category', MAX_CATEGORY_CHARS)
      const idea = value.idea === undefined ? undefined : requireString(value.idea, 'idea', config.maxIdeaChars)
      const status = value.status === undefined ? undefined : value.status
      if (status !== undefined && !isIdeaStatus(status)) throw new HttpError(400, '收藏状态无效。')
      if (category === undefined && idea === undefined && status === undefined) throw new HttpError(400, '没有可更新的字段。')
      return { action: 'update', id, ...(category === undefined ? {} : { category }), ...(idea === undefined ? {} : { idea }), ...(status === undefined ? {} : { status }) }
    }
    case 'optimize': return { action: 'optimize', id: requireString(value.id, 'id', 100) }
    case 'expand': return { action: 'expand', id: requireString(value.id, 'id', 100) }
    case 'remove': return { action: 'remove', id: requireString(value.id, 'id', 100) }
    case 'import': {
      if (typeof value.text !== 'string' || value.text.trim().length === 0) throw new HttpError(400, '导入内容为空。')
      return { action: 'import', text: value.text }
    }
    default: throw new HttpError(400, '未知 action。')
  }
}

function boundedIdea(parsed: Omit<Idea, 'id'>, config: Config): Omit<Idea, 'id'> {
  if (parsed.category.length > MAX_CATEGORY_CHARS) throw new Error('模型返回的分类过长。')
  if (parsed.idea.length > config.maxIdeaChars) throw new Error('模型返回的灵感超过保存上限。')
  return parsed
}

export function apply(ctx: IdeaJarContext, config: Config): void {
  const settings = ctx.settings.register(SETTINGS_NAMESPACE, settingsSchema)
  const recent: string[] = []
  let writeQueue = Promise.resolve()

  const serializeWrite = <T>(operation: () => Promise<T>): Promise<T> => {
    const current = writeQueue.then(operation)
    writeQueue = current.then(() => undefined, () => undefined)
    return current
  }

  const save = async (favorites: FavoriteIdea[]): Promise<FavoritesResult> => {
    await settings.replace({ favorites })
    return { favorites: cloneFavorites(favorites) }
  }

  const requestModelText = async (prompt: string, system: string): Promise<string> => {
    const selection = ctx.agentDefaultModel.currentSelection()
    const assembler = new BlockAssembler()
    for await (const chunk of ctx.llm.stream({
      provider: selection.provider,
      model: selection.model,
      ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: selection.reasoningEffort }),
      messages: [{
        id: MessageId(`idea-jar-${randomUUID()}`),
        role: 'user',
        content: [{ type: 'text', text: prompt }],
        source: { kind: 'plugin', plugin: name },
      }],
      system,
      maxTokens: config.maxTokens,
    })) assembler.push(chunk)
    const finish = assembler.finish
    if (finish.kind === 'error' || finish.kind === 'aborted') throw new Error(finish.failure.message)
    return assembler.blocks()
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('')
      .trim()
  }

  const runTextModel = async (prompt: string, system: string): Promise<string> => {
    const first = await requestModelText(prompt, system)
    if (first.length > 0) return first
    const retry = await requestModelText(`${prompt}\n\n上一次没有返回正文，请直接给出完整结果。`, system)
    if (retry.length === 0) throw new Error('模型连续两次没有返回内容，请稍后再试。')
    return retry
  }

  const runIdeaModel = async (prompt: string, system: string): Promise<Omit<Idea, 'id'>> => {
    return boundedIdea(parseIdeaLine(await runTextModel(prompt, system)), config)
  }

  const generate = async (request: string, count: number): Promise<GenerateResult> => {
    const recentText = () => recent.length === 0 ? '暂无' : recent.join('\n')
    const base = request.length > 0
      ? `用户的额外需求：\n${request}\n\n判断合适的创作领域，在满足要求时加入有价值的创意转折。`
      : `用户没有提供额外需求。随机选择一个创作领域生成新灵感。`
    const items: Idea[] = []
    for (let index = 0; index < count; index++) {
      const distinct = count > 1 ? `\n\n请生成第 ${String(index + 1)} 条灵感，并与前面几条明显不同，避免重复。` : ''
      const parsed = await runIdeaModel(`${base}\n最近灵感：\n${recentText()}${distinct}`, generationSystem)
      items.push({ id: randomUUID(), ...parsed })
      recent.push(`${parsed.category}｜${parsed.idea}`)
      if (recent.length > 8) recent.shift()
    }
    return { items }
  }

  const favorite = (item: Idea): Promise<FavoritesResult> => serializeWrite(async () => {
    const current = cloneFavorites(settings.get().favorites)
    if (current.some(entry => entry.id === item.id)) return { favorites: current }
    if (current.length >= config.maxFavorites) throw new HttpError(409, `收藏数量已达到 ${String(config.maxFavorites)} 条上限。`)
    return save([{ ...item, status: 'planned' }, ...current])
  })

  const update = (request: Extract<IdeaJarRequest, { action: 'update' }>): Promise<FavoritesResult> => serializeWrite(async () => {
    const current = settings.get().favorites
    return save(replaceFavorite(current, request.id, {
      ...(request.category === undefined ? {} : { category: request.category }),
      ...(request.idea === undefined ? {} : { idea: request.idea }),
      ...(request.status === undefined ? {} : { status: request.status }),
    }))
  })

  const optimize = async (id: string): Promise<FavoritesResult> => {
    const snapshot = settings.get().favorites.find(item => item.id === id)
    if (snapshot === undefined) throw new HttpError(404, '找不到这条收藏。')
    const optimized = await runIdeaModel(`原灵感：\n${snapshot.category}｜${snapshot.idea}`, optimizationSystem)
    return serializeWrite(async () => {
      const current = settings.get().favorites
      const latest = current.find(item => item.id === id)
      if (latest === undefined) throw new HttpError(404, '这条收藏已被删除。')
      if (latest.idea !== snapshot.idea || latest.category !== snapshot.category) {
        throw new HttpError(409, '灵感在 AI 优化期间发生了变化，请重新优化。')
      }
      return save(replaceFavorite(current, id, optimized))
    })
  }

  const expand = async (id: string): Promise<ExpandResult> => {
    const snapshot = settings.get().favorites.find(item => item.id === id)
    if (snapshot === undefined) throw new HttpError(404, '找不到这条收藏。')
    const plan = await runTextModel(`灵感：\n${snapshot.category}｜${snapshot.idea}`, expansionSystem)
    return { id, plan }
  }

  const remove = (id: string): Promise<FavoritesResult> => serializeWrite(async () => {
    const current = settings.get().favorites
    if (!current.some(item => item.id === id)) return { favorites: cloneFavorites(current) }
    return save(current.filter(item => item.id !== id))
  })

  const importItems = (text: string): Promise<ImportResult> => serializeWrite(async () => {
    const parsed = parseImportText(text)
    const merged = mergeFavorites(settings.get().favorites, parsed.items, config.maxFavorites)
    const result = await save(merged)
    return { ...result, imported: parsed.items.length, skipped: parsed.skipped }
  })

  const dispatch = async (request: IdeaJarRequest): Promise<FavoritesResult | GenerateResult | ExpandResult | ImportResult | ListResult> => {
    switch (request.action) {
      case 'list': {
        await writeQueue
        return { favorites: cloneFavorites(settings.get().favorites), features: { newSession: config.enableNewSession } }
      }
      case 'generate': return generate(request.request, request.count ?? 1)
      case 'favorite': return favorite(request.item)
      case 'update': return update(request)
      case 'optimize': return optimize(request.id)
      case 'expand': return expand(request.id)
      case 'remove': return remove(request.id)
      case 'import': return importItems(request.text)
    }
  }

  const route: WebRoute = {
    kind: 'exact',
    path: IDEA_JAR_API_PATH,
    handler: async (req, res) => {
      try {
        if (req.method !== 'POST') throw new HttpError(405, '只接受 POST 请求。')
        if (!sameOrigin(req)) throw new HttpError(403, '拒绝跨站请求。')
        const request = parseRequest(await readRequest(req), config)
        sendJson(res, 200, await dispatch(request))
      } catch (error) {
        const status = error instanceof HttpError ? error.status : 500
        const message = error instanceof Error ? error.message : '灵感罐请求失败。'
        if (status >= 500) ctx.logger.warn(error instanceof Error ? error : new Error(message))
        sendJson(res, status, { error: message })
      }
    },
  }
  ctx.effect(() => ctx.webServer.register(route), 'idea-jar: API route')
}
