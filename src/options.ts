export type AdapterType = "openai" | "grok" | "openrouter"

export type ModelConfig = {
  type: AdapterType
  /** Upstream model id. Defaults to the part of the key after the first `/`. */
  id?: string
  generatePath?: string
  editPath?: string
  baseURL?: string
  apiKey?: string
}

export type PluginOptions = {
  default?: string
  models: Record<string, ModelConfig>
}

const TYPES = new Set<AdapterType>(["openai", "grok", "openrouter"])

export function splitModelKey(key: string): { providerID: string; modelID: string } {
  const i = key.indexOf("/")
  if (i <= 0 || i === key.length - 1) {
    throw new Error(`Invalid model key "${key}": expected providerID/modelID (split on the first /)`)
  }
  return { providerID: key.slice(0, i), modelID: key.slice(i + 1) }
}

export function parseOptions(raw: unknown): PluginOptions {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { models: {} }
  }
  const o = raw as Record<string, unknown>
  const modelsIn = o.models
  const models: Record<string, ModelConfig> = {}
  if (modelsIn != null) {
    if (typeof modelsIn !== "object" || Array.isArray(modelsIn)) {
      throw new Error("plugin option `models` must be an object keyed by providerID/modelID")
    }
    for (const [key, value] of Object.entries(modelsIn as Record<string, unknown>)) {
      splitModelKey(key)
      if (value == null || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`models["${key}"] must be an object`)
      }
      const m = value as Record<string, unknown>
      if (typeof m.type !== "string" || !TYPES.has(m.type as AdapterType)) {
        throw new Error(
          `models["${key}"].type must be one of: openai, grok, openrouter (got ${JSON.stringify(m.type)})`,
        )
      }
      const cfg: ModelConfig = { type: m.type as AdapterType }
      for (const field of ["id", "generatePath", "editPath", "baseURL", "apiKey"] as const) {
        if (m[field] != null) {
          if (typeof m[field] !== "string") {
            throw new Error(`models["${key}"].${field} must be a string`)
          }
          cfg[field] = m[field] as string
        }
      }
      models[key] = cfg
    }
  }
  let defaultKey: string | undefined
  if (o.default != null) {
    if (typeof o.default !== "string" || !o.default.trim()) {
      throw new Error("plugin option `default` must be a non-empty string")
    }
    defaultKey = o.default.trim()
  }
  return { default: defaultKey, models }
}

export type ResolvedModel = {
  key: string
  providerID: string
  modelID: string
  upstreamID: string
  config: ModelConfig
}

export function resolveModel(options: PluginOptions, requested?: string): ResolvedModel {
  const key = requested?.trim() || options.default
  if (!key) {
    throw new Error("No model specified. Pass `model` or set plugin option `default`.")
  }
  const config = options.models[key]
  if (!config) {
    const known = Object.keys(options.models)
    const list = known.length ? known.join(", ") : "(none registered)"
    throw new Error(
      `Model "${key}" is not registered. Add it under plugin options.models. Known: ${list}`,
    )
  }
  const { providerID, modelID } = splitModelKey(key)
  return {
    key,
    providerID,
    modelID,
    upstreamID: config.id?.trim() || modelID,
    config,
  }
}
