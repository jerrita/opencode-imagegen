export const DEFAULT_TIMEOUT_MS = 300_000

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export function joinURL(base: string, path: string): string {
  const b = base.replace(/\/+$/, "")
  const p = path.replace(/^\/+/, "")
  if (!p) return b
  return `${b}/${p}`
}

export function combineSignals(user?: AbortSignal, timeoutMs: number = DEFAULT_TIMEOUT_MS): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs)
  if (!user) return timeout
  if (typeof AbortSignal.any === "function") return AbortSignal.any([user, timeout])
  const ctrl = new AbortController()
  const onAbort = () => {
    ctrl.abort(user.aborted ? user.reason : timeout.reason)
  }
  if (user.aborted || timeout.aborted) {
    onAbort()
    return ctrl.signal
  }
  user.addEventListener("abort", onAbort, { once: true })
  timeout.addEventListener("abort", onAbort, { once: true })
  return ctrl.signal
}

export function formatHttpError(status: number, body: string): string {
  const trimmed = body.trim()
  const snippet = trimmed.length > 4000 ? `${trimmed.slice(0, 4000)}…` : trimmed
  const parsed = tryParseJSON(trimmed)
  const msg = parsed ? extractErrorMessage(parsed) : undefined
  if (msg) return `HTTP ${status}: ${msg}${snippet && snippet !== msg ? `\n${snippet}` : ""}`
  return snippet ? `HTTP ${status}: ${snippet}` : `HTTP ${status}`
}

export function extractErrorMessage(json: unknown): string | undefined {
  if (!json || typeof json !== "object") return undefined
  const o = json as Record<string, unknown>
  if (typeof o.message === "string" && o.message.trim()) return o.message
  const err = o.error
  if (typeof err === "string" && err.trim()) return err
  if (err && typeof err === "object") {
    const em = (err as Record<string, unknown>).message
    if (typeof em === "string" && em.trim()) return em
  }
  return undefined
}

function tryParseJSON(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export async function postJSON(input: {
  url: string
  apiKey: string
  body: string | FormData
  headers?: Record<string, string>
  signal?: AbortSignal
  timeoutMs?: number
  fetch?: FetchLike
}): Promise<unknown> {
  const fetchFn = input.fetch ?? globalThis.fetch
  const headers = new Headers(input.headers)
  if (!headers.has("authorization")) {
    headers.set("authorization", `Bearer ${input.apiKey}`)
  }
  if (!(input.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json")
  }

  const res = await fetchFn(input.url, {
    method: "POST",
    headers,
    body: input.body,
    signal: combineSignals(input.signal, input.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(formatHttpError(res.status, text))
  }
  if (!text.trim()) {
    throw new Error(`HTTP ${res.status}: empty response`)
  }
  const json = tryParseJSON(text)
  if (json === undefined) {
    throw new Error(`HTTP ${res.status}: expected JSON, got: ${text.slice(0, 500)}`)
  }
  return json
}

export type ImagePayload =
  | { kind: "url"; url: string }
  | { kind: "b64"; b64: string; mime?: string }

export function extractImage(json: unknown): ImagePayload {
  if (!json || typeof json !== "object") {
    throw new Error("Image API returned a non-object body")
  }
  const root = json as Record<string, unknown>
  const first = firstItem(root.data) ?? firstItem(root.images) ?? root
  if (!first || typeof first !== "object") {
    throw new Error(`Image API response missing data[0]: ${JSON.stringify(json).slice(0, 500)}`)
  }
  const item = first as Record<string, unknown>
  const b64 = stringField(item.b64_json) ?? stringField(item.b64) ?? stringField(item.base64)
  if (b64) {
    const parsed = parseDataURL(b64)
    if (parsed) return { kind: "b64", b64: parsed.b64, mime: parsed.mime }
    return { kind: "b64", b64, mime: stringField(item.mime_type) ?? stringField(item.mime) }
  }
  const url = stringField(item.url) ?? stringField(item.image_url)
  if (url) {
    const parsed = parseDataURL(url)
    if (parsed) return { kind: "b64", b64: parsed.b64, mime: parsed.mime }
    return { kind: "url", url }
  }
  throw new Error(`Image API response had no url or b64_json: ${JSON.stringify(json).slice(0, 500)}`)
}

function firstItem(v: unknown): unknown {
  return Array.isArray(v) ? v[0] : undefined
}

function stringField(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined
}

export function parseDataURL(value: string): { mime: string; b64: string } | undefined {
  const m = /^data:([^;,]+);base64,([\s\S]+)$/i.exec(value.trim())
  if (!m) return undefined
  return { mime: m[1], b64: m[2] }
}

export async function downloadURL(
  url: string,
  input?: { signal?: AbortSignal; timeoutMs?: number; fetch?: FetchLike },
): Promise<{ bytes: Uint8Array; mime?: string }> {
  const fetchFn = input?.fetch ?? globalThis.fetch
  const res = await fetchFn(url, {
    signal: combineSignals(input?.signal, input?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(formatHttpError(res.status, text || `failed to download ${url}`))
  }
  const mime = res.headers.get("content-type")?.split(";")[0]?.trim()
  const buf = new Uint8Array(await res.arrayBuffer())
  return { bytes: buf, mime }
}
