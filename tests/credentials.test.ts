import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveCredentials, resolveTemplate } from "../src/credentials.ts"

describe("resolveTemplate", () => {
  it("expands {env:VAR}", () => {
    process.env.IMAGEGEN_TEST_KEY = "abc"
    assert.equal(resolveTemplate("{env:IMAGEGEN_TEST_KEY}"), "abc")
    delete process.env.IMAGEGEN_TEST_KEY
  })
  it("returns literal values", () => {
    assert.equal(resolveTemplate("sk-live"), "sk-live")
  })
})

describe("resolveCredentials", () => {
  const grok = { type: "grok" as const }

  it("prefers model override over provider options over env", () => {
    const creds = resolveCredentials({
      providerID: "xai",
      type: "grok",
      model: { type: "grok", apiKey: "from-model", baseURL: "https://model.example/v1" },
      config: { provider: { xai: { options: { apiKey: "from-provider", baseURL: "https://prov.example/v1" } } } },
      env: { XAI_API_KEY: "from-env", XAI_BASE_URL: "https://env.example/v1" },
    })
    assert.equal(creds.apiKey, "from-model")
    assert.equal(creds.baseURL, "https://model.example/v1")
  })

  it("uses provider.options next", () => {
    const creds = resolveCredentials({
      providerID: "openai",
      type: "openai",
      model: { type: "openai" },
      config: { provider: { openai: { options: { apiKey: "{env:OPENAI_API_KEY}" } } } },
      env: { OPENAI_API_KEY: "sk-from-env" },
    })
    assert.equal(creds.apiKey, "sk-from-env")
    assert.equal(creds.baseURL, "https://api.openai.com/v1")
  })

  it("falls back to provider-prefixed env then type env", () => {
    const creds = resolveCredentials({
      providerID: "xai",
      type: "grok",
      model: grok,
      config: {},
      env: { XAI_API_KEY: "xai-key" },
    })
    assert.equal(creds.apiKey, "xai-key")
    assert.equal(creds.baseURL, "https://api.x.ai/v1")
  })

  it("uses openrouter default base", () => {
    const creds = resolveCredentials({
      providerID: "openrouter",
      type: "openrouter",
      model: { type: "openrouter" },
      env: { OPENROUTER_API_KEY: "or-key" },
    })
    assert.equal(creds.baseURL, "https://openrouter.ai/api/v1")
  })

  it("throws when no key is found", () => {
    assert.throws(
      () =>
        resolveCredentials({
          providerID: "openai",
          type: "openai",
          model: { type: "openai" },
          config: {},
          env: {},
        }),
      /No API key/,
    )
  })
})
