import type { AdapterType, ModelConfig } from "./options.js"

export type ProviderOptions = {
  apiKey?: string
  baseURL?: string
}

export type OpenCodeConfig = {
  provider?: Record<string, { options?: ProviderOptions } | undefined>
}

const DEFAULT_BASE: Record<AdapterType, string> = {
  openai: "https://api.openai.com/v1",
  grok: "https://api.x.ai/v1",
  openrouter: "https://openrouter.ai/api/v1",
}

const TYPE_ENV: Record<AdapterType, { key: string; base: string }> = {
  openai: { key: "OPENAI_API_KEY", base: "OPENAI_BASE_URL" },
  grok: { key: "XAI_API_KEY", base: "XAI_BASE_URL" },
  openrouter: { key: "OPENROUTER_API_KEY", base: "OPENROUTER_BASE_URL" },
}

let capturedConfig: OpenCodeConfig | undefined

export function setCapturedConfig(config: unknown): void {
  capturedConfig = (config ?? undefined) as OpenCodeConfig | undefined
}

export function getCapturedConfig(): OpenCodeConfig | undefined {
  return capturedConfig
}

export function resolveTemplate(
  value: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (value == null) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const m = /^\{env:([A-Za-z0-9_]+)\}$/.exec(trimmed)
  if (m) {
    const resolved = env[m[1]]
    return resolved && resolved.trim() ? resolved.trim() : undefined
  }
  return trimmed
}

function providerEnvPrefix(providerID: string): string {
  return providerID.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()
}

export function providerOptionsFromConfig(
  config: OpenCodeConfig | undefined,
  providerID: string,
  env: NodeJS.ProcessEnv = process.env,
): ProviderOptions {
  const opts = config?.provider?.[providerID]?.options
  return {
    apiKey: resolveTemplate(opts?.apiKey, env),
    baseURL: resolveTemplate(opts?.baseURL, env),
  }
}

export type Credentials = {
  apiKey: string
  baseURL: string
}

export function resolveCredentials(input: {
  providerID: string
  type: AdapterType
  model: ModelConfig
  config?: OpenCodeConfig
  env?: NodeJS.ProcessEnv
}): Credentials {
  const env = input.env ?? process.env
  const fromProvider = providerOptionsFromConfig(input.config ?? capturedConfig, input.providerID, env)
  const prefix = providerEnvPrefix(input.providerID)
  const typeEnv = TYPE_ENV[input.type]

  const apiKey =
    resolveTemplate(input.model.apiKey, env) ||
    fromProvider.apiKey ||
    trim(env[`${prefix}_API_KEY`]) ||
    trim(env[typeEnv.key])

  const baseURL =
    resolveTemplate(input.model.baseURL, env) ||
    fromProvider.baseURL ||
    trim(env[`${prefix}_BASE_URL`]) ||
    trim(env[typeEnv.base]) ||
    DEFAULT_BASE[input.type]

  if (!apiKey) {
    throw new Error(
      `No API key for provider "${input.providerID}". Set models["..."].apiKey, ` +
        `provider.${input.providerID}.options.apiKey, or ${prefix}_API_KEY / ${typeEnv.key}.`,
    )
  }

  return { apiKey, baseURL: baseURL.replace(/\/+$/, "") }
}

function trim(v: string | undefined): string | undefined {
  if (v == null) return undefined
  const t = v.trim()
  return t ? t : undefined
}
