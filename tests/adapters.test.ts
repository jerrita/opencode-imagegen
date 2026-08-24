import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { grokAdapter } from "../src/adapters/grok.ts"
import { openaiAdapter } from "../src/adapters/openai.ts"
import { openrouterAdapter } from "../src/adapters/openrouter.ts"
import { resolveAdapter } from "../src/adapters/resolve.ts"
import type { LocalImage } from "../src/io.ts"

const img = (name: string): LocalImage => ({
  filename: name,
  mime: "image/png",
  bytes: new Uint8Array([1, 2, 3]),
  source: name,
})

describe("resolveAdapter", () => {
  it("maps type to adapter paths", () => {
    assert.equal(resolveAdapter("openai").defaultGeneratePath, "images/generations")
    assert.equal(resolveAdapter("openai").defaultEditPath, "images/edits")
    assert.equal(resolveAdapter("grok").defaultGeneratePath, "images/generations")
    assert.equal(resolveAdapter("openrouter").defaultGeneratePath, "images")
    assert.equal(resolveAdapter("openrouter").defaultEditPath, "images")
  })
})

describe("openaiAdapter", () => {
  it("generate is JSON with size passed through", () => {
    const built = openaiAdapter.buildGenerate({
      model: "gpt-image-2",
      prompt: "a cat",
      size: "1024x1024",
      quality: "high",
    })
    const body = JSON.parse(String(built.body))
    assert.equal(body.model, "gpt-image-2")
    assert.equal(body.size, "1024x1024")
    assert.equal(body.n, 1)
    assert.equal(built.headers["content-type"], "application/json")
  })

  it("edit is multipart: image for one, image[] for many, optional mask", async () => {
    const one = openaiAdapter.buildEdit({
      model: "gpt-image-2",
      prompt: "edit",
      images: [img("a.png")],
    })
    assert.ok(one.body instanceof FormData)
    const form = one.body as FormData
    assert.ok(form.get("image"))
    assert.equal(form.get("image[]"), null)

    const many = openaiAdapter.buildEdit({
      model: "gpt-image-2",
      prompt: "edit",
      images: [img("a.png"), img("b.png")],
      mask: img("mask.png"),
    })
    const form2 = many.body as FormData
    assert.equal(form2.get("image"), null)
    assert.equal(form2.getAll("image[]").length, 2)
    assert.ok(form2.get("mask"))
  })
})

describe("grokAdapter", () => {
  it("maps size to aspect_ratio + resolution", () => {
    const built = grokAdapter.buildGenerate({
      model: "grok-imagine-image",
      prompt: "a cat",
      size: "1024x1024",
    })
    const body = JSON.parse(String(built.body))
    assert.equal(body.aspect_ratio, "1:1")
    assert.equal(body.resolution, "1k")
    assert.equal(body.size, undefined)
  })

  it("edit uses image { url, type: image_url } and caps at 3", () => {
    const built = grokAdapter.buildEdit({
      model: "grok-imagine-image",
      prompt: "remix",
      images: [img("a.png")],
      mask: img("m.png"),
    })
    const body = JSON.parse(String(built.body))
    assert.equal(body.image.type, "image_url")
    assert.match(body.image.url, /^data:image\/png;base64,/)
    assert.equal(body.images, undefined)
    assert.match(built.notes.join("\n"), /mask/)
    assert.throws(
      () =>
        grokAdapter.buildEdit({
          model: "grok-imagine-image",
          prompt: "x",
          images: [img("a"), img("b"), img("c"), img("d")],
        }),
      /at most 3/,
    )
  })

  it("edit uses images[] for 2–3 refs", () => {
    const built = grokAdapter.buildEdit({
      model: "grok-imagine-image",
      prompt: "compose",
      images: [img("a.png"), img("b.png")],
    })
    const body = JSON.parse(String(built.body))
    assert.equal(body.images.length, 2)
    assert.equal(body.image, undefined)
  })
})

describe("openrouterAdapter", () => {
  it("generate hits images path dialect (JSON, mapped size)", () => {
    assert.equal(openrouterAdapter.defaultGeneratePath, "images")
    const built = openrouterAdapter.buildGenerate({
      model: "openai/gpt-image-2",
      prompt: "a cat",
      size: "1024x1024",
    })
    const body = JSON.parse(String(built.body))
    assert.equal(body.aspect_ratio, "1:1")
    assert.equal(body.resolution, "1K")
  })

  it("edit uses input_references", () => {
    const built = openrouterAdapter.buildEdit({
      model: "openai/gpt-image-2",
      prompt: "edit",
      images: [img("a.png")],
      mask: img("m.png"),
    })
    const body = JSON.parse(String(built.body))
    assert.equal(body.input_references[0].type, "image_url")
    assert.match(body.input_references[0].image_url.url, /^data:image\/png;base64,/)
    assert.match(built.notes.join("\n"), /mask/)
  })
})
