import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, it } from "node:test"
import { setCapturedConfig } from "../src/credentials.ts"
import { parseOptions } from "../src/options.ts"
import { runEdit, runGenerate } from "../src/run.ts"

const options = parseOptions({
  default: "openai/gpt-image-2",
  models: {
    "openai/gpt-image-2": { type: "openai" },
    "xai/grok-imagine-image": { type: "grok" },
    "openrouter/openai/gpt-image-2": { type: "openrouter", id: "openai/gpt-image-2", generatePath: "images" },
  },
})

function pngB64(): string {
  return Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64")
}

describe("runGenerate mock HTTP", () => {
  it("posts openai generations JSON and writes the file", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "imagegen-"))
    setCapturedConfig({ provider: { openai: { options: { apiKey: "sk-test" } } } })
    const urls: string[] = []
    const fetch = async (url: string | URL | Request, init?: RequestInit) => {
      urls.push(String(url))
      const body = JSON.parse(String(init?.body))
      assert.equal(body.prompt, "a red cube")
      assert.equal(body.size, "1024x1024")
      return new Response(JSON.stringify({ data: [{ b64_json: pngB64() }] }), { status: 200 })
    }
    const out = await runGenerate({
      options,
      ctx: { directory: dir, abort: new AbortController().signal },
      prompt: "a red cube",
      out: "cube.png",
      size: "1024x1024",
      fetch,
    })
    assert.equal(urls[0], "https://api.openai.com/v1/images/generations")
    assert.equal(out, path.join(dir, "cube.png"))
    assert.ok((await fs.stat(out)).isFile())
  })

  it("uses custom generatePath and mapped grok size", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "imagegen-"))
    setCapturedConfig({ provider: { xai: { options: { apiKey: "xai-k" } } } })
    let posted: unknown
    const fetch = async (url: string | URL | Request, init?: RequestInit) => {
      assert.equal(String(url), "https://api.x.ai/v1/images/generations")
      posted = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({ data: [{ b64_json: pngB64() }] }), { status: 200 })
    }
    await runGenerate({
      options,
      ctx: { directory: dir, abort: new AbortController().signal },
      prompt: "star",
      out: "star.png",
      model: "xai/grok-imagine-image",
      size: "1024x1024",
      fetch,
    })
    assert.deepEqual(posted, {
      model: "grok-imagine-image",
      prompt: "star",
      n: 1,
      aspect_ratio: "1:1",
      resolution: "1k",
    })
  })
})

describe("runEdit mock HTTP", () => {
  it("posts openrouter /images with input_references", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "imagegen-"))
    const src = path.join(dir, "in.png")
    await fs.writeFile(src, Buffer.from("img"))
    setCapturedConfig({ provider: { openrouter: { options: { apiKey: "or-k" } } } })
    let posted: any
    let postedUrl = ""
    const fetch = async (url: string | URL | Request, init?: RequestInit) => {
      postedUrl = String(url)
      posted = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({ data: [{ b64_json: pngB64() }] }), { status: 200 })
    }
    const result = await runEdit({
      options,
      ctx: { directory: dir, abort: new AbortController().signal },
      prompt: "make it blue",
      out: "out.png",
      images: [src],
      model: "openrouter/openai/gpt-image-2",
      mask: src,
      fetch,
    })
    assert.equal(postedUrl, "https://openrouter.ai/api/v1/images")
    assert.equal(posted.model, "openai/gpt-image-2")
    assert.equal(posted.input_references.length, 1)
    assert.match(result, /mask is only sent for type=openai/)
  })
})
