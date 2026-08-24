import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { extractImage, formatHttpError, joinURL, postJSON } from "../src/http.ts"

describe("joinURL", () => {
  it("joins base with /v1 and a relative path", () => {
    assert.equal(joinURL("https://api.openai.com/v1", "images/generations"), "https://api.openai.com/v1/images/generations")
  })
  it("strips extra slashes", () => {
    assert.equal(joinURL("https://api.openai.com/v1/", "/images/edits"), "https://api.openai.com/v1/images/edits")
  })
  it("keeps openrouter /images (not /images/generations)", () => {
    assert.equal(joinURL("https://openrouter.ai/api/v1", "images"), "https://openrouter.ai/api/v1/images")
  })
})

describe("extractImage", () => {
  it("reads url", () => {
    assert.deepEqual(extractImage({ data: [{ url: "https://cdn.example/a.png" }] }), {
      kind: "url",
      url: "https://cdn.example/a.png",
    })
  })
  it("reads b64_json", () => {
    assert.deepEqual(extractImage({ data: [{ b64_json: "aaaa" }] }), { kind: "b64", b64: "aaaa", mime: undefined })
  })
  it("reads data URL in url field", () => {
    assert.deepEqual(extractImage({ data: [{ url: "data:image/png;base64,abcd" }] }), {
      kind: "b64",
      b64: "abcd",
      mime: "image/png",
    })
  })
  it("reads images[0]", () => {
    assert.equal(extractImage({ images: [{ b64_json: "zz" }] }).kind, "b64")
  })
})

describe("formatHttpError", () => {
  it("prefers nested error.message", () => {
    assert.match(formatHttpError(401, JSON.stringify({ error: { message: "invalid api key" } })), /invalid api key/)
  })
})

describe("postJSON", () => {
  it("sends bearer token and JSON content-type", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const fetch = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} })
      return new Response(JSON.stringify({ data: [{ b64_json: "xx" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }
    await postJSON({
      url: "https://api.openai.com/v1/images/generations",
      apiKey: "sk-test",
      body: JSON.stringify({ prompt: "hi" }),
      fetch,
    })
    const headers = new Headers(calls[0]!.init.headers)
    assert.equal(headers.get("authorization"), "Bearer sk-test")
    assert.equal(headers.get("content-type"), "application/json")
  })

  it("does not override FormData content-type", async () => {
    const calls: Array<RequestInit> = []
    const fetch = async (_url: string | URL | Request, init?: RequestInit) => {
      calls.push(init ?? {})
      return new Response(JSON.stringify({ data: [{ url: "https://x" }] }), { status: 200 })
    }
    const form = new FormData()
    form.set("prompt", "hi")
    await postJSON({ url: "https://example/edits", apiKey: "k", body: form, fetch })
    const headers = new Headers(calls[0]!.headers)
    assert.equal(headers.get("content-type"), null)
  })

  it("includes error body on failure", async () => {
    const fetch = async () =>
      new Response(JSON.stringify({ error: { message: "moderation" } }), { status: 400 })
    await assert.rejects(
      () => postJSON({ url: "https://example", apiKey: "k", body: "{}", fetch }),
      /HTTP 400: moderation/,
    )
  })
})
