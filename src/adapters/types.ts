import type { LocalImage } from "../io.js"

export type GenerateParams = {
  model: string
  prompt: string
  size?: string
  quality?: string
}

export type EditParams = GenerateParams & {
  images: LocalImage[]
  mask?: LocalImage
}

export type BuiltRequest = {
  headers: Record<string, string>
  body: string | FormData
  notes: string[]
}

export type ImageAdapter = {
  type: "openai" | "grok" | "openrouter"
  defaultGeneratePath: string
  defaultEditPath: string
  buildGenerate(params: GenerateParams): BuiltRequest
  buildEdit(params: EditParams): BuiltRequest
}
