import fs from "node:fs/promises"
import path from "node:path"
import { downloadURL, parseDataURL, type FetchLike, type ImagePayload } from "./http.js"

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
}

const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
}

export type LocalImage = {
  filename: string
  mime: string
  bytes: Uint8Array
  source: string
}

export function mimeFromPath(filePath: string): string {
  return MIME_BY_EXT[path.extname(filePath).toLowerCase()] ?? "image/png"
}

export function extForMime(mime: string | undefined, fallback = ".png"): string {
  if (!mime) return fallback
  const key = mime.split(";")[0]!.trim().toLowerCase()
  return EXT_BY_MIME[key] ?? fallback
}

export function resolvePath(filePath: string, cwd: string): string {
  if (path.isAbsolute(filePath)) return filePath
  return path.resolve(cwd, filePath)
}

export async function uniqueOutputPath(desired: string): Promise<string> {
  try {
    await fs.access(desired)
  } catch {
    return desired
  }
  const parsed = path.parse(desired)
  for (let n = 2; n < 10_000; n++) {
    const candidate = path.join(parsed.dir, `${parsed.name}-v${n}${parsed.ext}`)
    try {
      await fs.access(candidate)
    } catch {
      return candidate
    }
  }
  throw new Error(`Could not find a free path for ${desired}`)
}

export function normalizeOutPath(out: string, cwd: string): string {
  const resolved = resolvePath(out, cwd)
  if (path.extname(resolved)) return resolved
  return `${resolved}.png`
}

export async function loadImage(
  ref: string,
  cwd: string,
  opts?: { fetch?: FetchLike; signal?: AbortSignal },
): Promise<LocalImage> {
  if (/^https?:\/\//i.test(ref)) {
    const { bytes, mime } = await downloadURL(ref, { fetch: opts?.fetch, signal: opts?.signal })
    const url = new URL(ref)
    const filename = path.basename(url.pathname) || "image.png"
    return {
      filename,
      mime: mime && mime.startsWith("image/") ? mime : mimeFromPath(filename),
      bytes,
      source: ref,
    }
  }
  const abs = resolvePath(ref, cwd)
  const bytes = new Uint8Array(await fs.readFile(abs))
  return {
    filename: path.basename(abs),
    mime: mimeFromPath(abs),
    bytes,
    source: abs,
  }
}

export function toDataURL(image: LocalImage): string {
  return `data:${image.mime};base64,${Buffer.from(image.bytes).toString("base64")}`
}

export async function saveImage(input: {
  out: string
  cwd: string
  payload: ImagePayload
  fetch?: FetchLike
  signal?: AbortSignal
}): Promise<{ path: string; mime: string }> {
  let desired = normalizeOutPath(input.out, input.cwd)
  let bytes: Uint8Array
  let mime: string | undefined

  if (input.payload.kind === "b64") {
    const parsed = parseDataURL(input.payload.b64)
    const b64 = parsed?.b64 ?? input.payload.b64
    mime = parsed?.mime ?? input.payload.mime
    bytes = Buffer.from(b64, "base64")
  } else {
    const dl = await downloadURL(input.payload.url, { fetch: input.fetch, signal: input.signal })
    bytes = dl.bytes
    mime = dl.mime
  }

  if (!path.extname(path.parse(desired).base) && mime) {
    desired = `${desired}${extForMime(mime)}`
  }

  const dest = await uniqueOutputPath(desired)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await fs.writeFile(dest, bytes)
  return { path: dest, mime: mime ?? mimeFromPath(dest) }
}
