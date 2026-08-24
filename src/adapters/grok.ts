import { toDataURL } from "../io.js"
import { mapSizeForGrok } from "./size.js"
import type { BuiltRequest, EditParams, GenerateParams, ImageAdapter } from "./types.js"

function jsonBody(obj: Record<string, unknown>, notes: string[] = []): BuiltRequest {
  const body: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) body[k] = v
  }
  return {
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    notes,
  }
}

function imageRef(url: string): { url: string; type: "image_url" } {
  return { url, type: "image_url" }
}

export const grokAdapter: ImageAdapter = {
  type: "grok",
  defaultGeneratePath: "images/generations",
  defaultEditPath: "images/edits",

  buildGenerate(params: GenerateParams): BuiltRequest {
    const mapped = mapSizeForGrok(params.size)
    return jsonBody({
      model: params.model,
      prompt: params.prompt,
      n: 1,
      aspect_ratio: mapped.aspect_ratio,
      resolution: mapped.resolution,
      quality: params.quality,
    })
  },

  buildEdit(params: EditParams): BuiltRequest {
    if (params.images.length < 1) {
      throw new Error("image_edit requires at least one image")
    }
    if (params.images.length > 3) {
      throw new Error("grok image_edit accepts at most 3 reference images")
    }
    const notes: string[] = []
    if (params.mask) {
      notes.push("mask is only sent for type=openai; ignored for grok")
    }
    const mapped = mapSizeForGrok(params.size)
    const refs = params.images.map((img) => imageRef(toDataURL(img)))
    const extra =
      refs.length === 1 ? { image: refs[0] } : { images: refs }
    return jsonBody(
      {
        model: params.model,
        prompt: params.prompt,
        n: 1,
        aspect_ratio: mapped.aspect_ratio,
        resolution: mapped.resolution,
        quality: params.quality,
        ...extra,
      },
      notes,
    )
  },
}
