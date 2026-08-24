import { grokAdapter } from "./grok.js"
import { openaiAdapter } from "./openai.js"
import { openrouterAdapter } from "./openrouter.js"
import type { ImageAdapter } from "./types.js"
import type { AdapterType } from "../options.js"

const ADAPTERS: Record<AdapterType, ImageAdapter> = {
  openai: openaiAdapter,
  grok: grokAdapter,
  openrouter: openrouterAdapter,
}

export function resolveAdapter(type: AdapterType): ImageAdapter {
  const adapter = ADAPTERS[type]
  if (!adapter) {
    throw new Error(`Unknown adapter type "${type}"`)
  }
  return adapter
}
