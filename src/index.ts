import type { Plugin, PluginModule } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { setCapturedConfig } from "./credentials.js"
import { parseOptions } from "./options.js"
import { runEdit, runGenerate } from "./run.js"

export const plugin: Plugin = async (_input, rawOptions) => {
  const options = parseOptions(rawOptions)
  return {
    config: async (config) => {
      setCapturedConfig(config)
    },
    tool: {
      image_gen: tool({
        description:
          "Generate a new image from a text prompt (no reference images). Writes one file to disk and returns the absolute path. Use image_edit when you have reference images.",
        args: {
          prompt: tool.schema.string().describe("Text prompt for the image"),
          out: tool.schema.string().describe("Output file path (relative to the project or absolute)"),
          model: tool.schema
            .string()
            .optional()
            .describe("Registered model key (providerID/modelID). Defaults to plugin option `default`."),
          size: tool.schema
            .string()
            .optional()
            .describe("Unified size: openai as-is (1024x1024 / auto / WIDTHxHEIGHT); grok/openrouter mapped to aspect_ratio + resolution"),
          quality: tool.schema.string().optional().describe("Quality hint (provider-specific, e.g. low/medium/high/auto)"),
        },
        async execute(args, ctx) {
          return runGenerate({
            options,
            ctx,
            prompt: args.prompt,
            out: args.out,
            model: args.model,
            size: args.size,
            quality: args.quality,
          })
        },
      }),
      image_edit: tool({
        description:
          "Edit or compose from existing images plus a prompt. Use image_gen when there are no reference images. Writes one file to disk and returns the absolute path. mask is sent only for type=openai.",
        args: {
          prompt: tool.schema.string().describe("Edit / composition prompt"),
          images: tool.schema
            .array(tool.schema.string())
            .describe("Reference image paths or http(s) URLs"),
          out: tool.schema.string().describe("Output file path (relative to the project or absolute)"),
          model: tool.schema
            .string()
            .optional()
            .describe("Registered model key (providerID/modelID). Defaults to plugin option `default`."),
          size: tool.schema.string().optional().describe("Unified size parameter (see image_gen)"),
          quality: tool.schema.string().optional().describe("Quality hint (provider-specific)"),
          mask: tool.schema
            .string()
            .optional()
            .describe("Mask image path (openai only; ignored for grok/openrouter)"),
        },
        async execute(args, ctx) {
          return runEdit({
            options,
            ctx,
            prompt: args.prompt,
            out: args.out,
            images: args.images,
            mask: args.mask,
            model: args.model,
            size: args.size,
            quality: args.quality,
          })
        },
      }),
    },
  }
}

export default { id: "opencode-imagegen", server: plugin } satisfies PluginModule
