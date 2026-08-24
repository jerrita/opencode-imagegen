import { resolveAdapter } from "./adapters/resolve.js"
import { getCapturedConfig, resolveCredentials } from "./credentials.js"
import { extractImage, joinURL, postJSON, type FetchLike } from "./http.js"
import { loadImage, saveImage } from "./io.js"
import { resolveModel, type PluginOptions } from "./options.js"

export type ToolContextLike = {
  directory: string
  abort: AbortSignal
}

export async function runGenerate(input: {
  options: PluginOptions
  ctx: ToolContextLike
  prompt: string
  out: string
  model?: string
  size?: string
  quality?: string
  fetch?: FetchLike
}): Promise<string> {
  const resolved = resolveModel(input.options, input.model)
  const adapter = resolveAdapter(resolved.config.type)
  const creds = resolveCredentials({
    providerID: resolved.providerID,
    type: resolved.config.type,
    model: resolved.config,
    config: getCapturedConfig(),
  })
  const built = adapter.buildGenerate({
    model: resolved.upstreamID,
    prompt: input.prompt,
    size: input.size,
    quality: input.quality,
  })
  const url = joinURL(creds.baseURL, resolved.config.generatePath || adapter.defaultGeneratePath)
  const json = await postJSON({
    url,
    apiKey: creds.apiKey,
    body: built.body,
    headers: built.headers,
    signal: input.ctx.abort,
    fetch: input.fetch,
  })
  const saved = await saveImage({
    out: input.out,
    cwd: input.ctx.directory,
    payload: extractImage(json),
    fetch: input.fetch,
    signal: input.ctx.abort,
  })
  return formatResult(saved.path, built.notes)
}

export async function runEdit(input: {
  options: PluginOptions
  ctx: ToolContextLike
  prompt: string
  out: string
  images: string[]
  mask?: string
  model?: string
  size?: string
  quality?: string
  fetch?: FetchLike
}): Promise<string> {
  if (!input.images.length) {
    throw new Error("image_edit requires `images` (one or more reference image paths or URLs)")
  }
  const resolved = resolveModel(input.options, input.model)
  const adapter = resolveAdapter(resolved.config.type)
  const creds = resolveCredentials({
    providerID: resolved.providerID,
    type: resolved.config.type,
    model: resolved.config,
    config: getCapturedConfig(),
  })
  const loaded = await Promise.all(
    input.images.map((ref) => loadImage(ref, input.ctx.directory, { fetch: input.fetch, signal: input.ctx.abort })),
  )
  const mask = input.mask
    ? await loadImage(input.mask, input.ctx.directory, { fetch: input.fetch, signal: input.ctx.abort })
    : undefined
  const built = adapter.buildEdit({
    model: resolved.upstreamID,
    prompt: input.prompt,
    size: input.size,
    quality: input.quality,
    images: loaded,
    mask,
  })
  const url = joinURL(creds.baseURL, resolved.config.editPath || adapter.defaultEditPath)
  const json = await postJSON({
    url,
    apiKey: creds.apiKey,
    body: built.body,
    headers: built.headers,
    signal: input.ctx.abort,
    fetch: input.fetch,
  })
  const saved = await saveImage({
    out: input.out,
    cwd: input.ctx.directory,
    payload: extractImage(json),
    fetch: input.fetch,
    signal: input.ctx.abort,
  })
  return formatResult(saved.path, built.notes)
}

function formatResult(absPath: string, notes: string[]): string {
  if (!notes.length) return absPath
  return `${absPath}\n${notes.join("\n")}`
}
