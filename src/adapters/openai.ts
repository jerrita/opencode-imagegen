import type { BuiltRequest, EditParams, GenerateParams, ImageAdapter } from "./types.js"
import type { LocalImage } from "../io.js"

function jsonBody(obj: Record<string, unknown>): BuiltRequest {
  const body: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) body[k] = v
  }
  return {
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    notes: [],
  }
}

function blobFor(image: LocalImage): Blob {
  return new Blob([image.bytes], { type: image.mime })
}

export const openaiAdapter: ImageAdapter = {
  type: "openai",
  defaultGeneratePath: "images/generations",
  defaultEditPath: "images/edits",

  buildGenerate(params: GenerateParams): BuiltRequest {
    return jsonBody({
      model: params.model,
      prompt: params.prompt,
      n: 1,
      size: params.size,
      quality: params.quality,
    })
  },

  buildEdit(params: EditParams): BuiltRequest {
    if (params.images.length < 1) {
      throw new Error("image_edit requires at least one image")
    }
    const form = new FormData()
    form.set("model", params.model)
    form.set("prompt", params.prompt)
    form.set("n", "1")
    if (params.size) form.set("size", params.size)
    if (params.quality) form.set("quality", params.quality)

    if (params.images.length === 1) {
      form.set("image", blobFor(params.images[0]!), params.images[0]!.filename)
    } else {
      for (const image of params.images) {
        form.append("image[]", blobFor(image), image.filename)
      }
    }
    if (params.mask) {
      form.set("mask", blobFor(params.mask), params.mask.filename)
    }
    return { headers: {}, body: form, notes: [] }
  },
}
