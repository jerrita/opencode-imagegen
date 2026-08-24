import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { plugin } from "../src/index.ts"
import type { PluginInput } from "@opencode-ai/plugin"
import { getCapturedConfig, setCapturedConfig } from "../src/credentials.ts"

const input = { directory: "/tmp", worktree: "/tmp" } as PluginInput

describe("plugin", () => {
  it("exports image_gen and image_edit and captures config", async () => {
    setCapturedConfig(undefined)
    const hooks = await plugin(input, {
      default: "openai/gpt-image-2",
      models: { "openai/gpt-image-2": { type: "openai" } },
    })
    assert.ok(hooks.tool && "image_gen" in hooks.tool && "image_edit" in hooks.tool)
    await hooks.config?.({ provider: { openai: { options: { apiKey: "sk" } } } } as never)
    assert.equal(getCapturedConfig()?.provider?.openai?.options?.apiKey, "sk")
  })
})
