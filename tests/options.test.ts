import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseOptions, resolveModel, splitModelKey } from "../src/options.ts"

describe("splitModelKey", () => {
  it("splits on the first slash", () => {
    assert.deepEqual(splitModelKey("openai/gpt-image-2"), { providerID: "openai", modelID: "gpt-image-2" })
    assert.deepEqual(splitModelKey("openrouter/openai/gpt-image-2"), {
      providerID: "openrouter",
      modelID: "openai/gpt-image-2",
    })
  })
  it("rejects keys without a model id", () => {
    assert.throws(() => splitModelKey("openai"), /providerID\/modelID/)
  })
})

describe("parseOptions", () => {
  it("parses the plan example", () => {
    const opts = parseOptions({
      default: "openai/gpt-image-2",
      models: {
        "openai/gpt-image-2": { type: "openai" },
        "xai/grok-imagine-image": { type: "grok" },
        "openrouter/openai/gpt-image-2": { type: "openrouter", id: "openai/gpt-image-2" },
      },
    })
    assert.equal(opts.default, "openai/gpt-image-2")
    assert.equal(opts.models["openrouter/openai/gpt-image-2"]?.id, "openai/gpt-image-2")
  })
  it("rejects unknown types", () => {
    assert.throws(
      () => parseOptions({ models: { "openai/x": { type: "gemini" } } }),
      /openai, grok, openrouter/,
    )
  })
  it("treats missing options as empty models", () => {
    assert.deepEqual(parseOptions(undefined), { models: {} })
  })
})

describe("resolveModel", () => {
  const opts = parseOptions({
    default: "openai/gpt-image-2",
    models: {
      "openai/gpt-image-2": { type: "openai" },
      "openrouter/openai/gpt-image-2": { type: "openrouter", id: "openai/gpt-image-2" },
    },
  })
  it("uses default and modelID as upstream id", () => {
    const r = resolveModel(opts)
    assert.equal(r.key, "openai/gpt-image-2")
    assert.equal(r.upstreamID, "gpt-image-2")
  })
  it("uses explicit id override", () => {
    const r = resolveModel(opts, "openrouter/openai/gpt-image-2")
    assert.equal(r.providerID, "openrouter")
    assert.equal(r.upstreamID, "openai/gpt-image-2")
  })
  it("errors on unregistered models", () => {
    assert.throws(() => resolveModel(opts, "xai/grok-imagine-image"), /not registered/)
  })
})
