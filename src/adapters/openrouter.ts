import { toDataURL } from "../io.js"
import { mapSizeForOpenRouter } from "./size.js"
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

export const openrouterAdapter: ImageAdapter = {
  type: "openrouter",
  defaultGeneratePath: "images",
  defaultEditPath: "images",

  buildGenerate(params: GenerateParams): BuiltRequest {
    const mapped = mapSizeForOpenRouter(params.size)
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
    const notes: string[] = []
    if (params.mask) {
      notes.push("mask is only sent for type=openai; ignored for openrouter")
    }
    const mapped = mapSizeForOpenRouter(params.size)
    const input_references = params.images.map((img) => ({
      type: "image_url" as const,
      image_url: { url: toDataURL(img) },
    }))
    return jsonBody(
      {
        model: params.model,
        prompt: params.prompt,
        n: 1,
        aspect_ratio: mapped.aspect_ratio,
        resolution: mapped.resolution,
        quality: params.quality,
        input_references,
      },
      notes,
    )
  },
}
