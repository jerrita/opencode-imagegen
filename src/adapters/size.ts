export type SizeMapping = {
  aspect_ratio?: string
  resolution?: string
}

const GROK_RATIOS: Array<[number, number, string]> = [
  [1, 1, "1:1"],
  [3, 4, "3:4"],
  [4, 3, "4:3"],
  [9, 16, "9:16"],
  [16, 9, "16:9"],
  [2, 3, "2:3"],
  [3, 2, "3:2"],
  [9, 19.5, "9:19.5"],
  [19.5, 9, "19.5:9"],
  [9, 20, "9:20"],
  [20, 9, "20:9"],
  [1, 2, "1:2"],
  [2, 1, "2:1"],
  [21, 9, "21:9"],
  [5, 2, "5:2"],
]

const OPENROUTER_RATIOS: Array<[number, number, string]> = [
  [1, 1, "1:1"],
  [2, 3, "2:3"],
  [3, 2, "3:2"],
  [3, 4, "3:4"],
  [4, 3, "4:3"],
  [4, 5, "4:5"],
  [5, 4, "5:4"],
  [9, 16, "9:16"],
  [16, 9, "16:9"],
  [9, 19, "9:19"],
  [19, 9, "19:9"],
  [9, 21, "9:21"],
  [21, 9, "21:9"],
  [1, 2, "1:2"],
  [2, 1, "2:1"],
  [1, 3, "1:3"],
  [3, 1, "3:1"],
  [1, 4, "1:4"],
  [4, 1, "4:1"],
]

export type ResolutionTier = "512" | "1k" | "2k" | "4k"

export function parseSize(size: string): {
  kind: "auto" | "pixels" | "ratio" | "tier"
  width?: number
  height?: number
  tier?: ResolutionTier
} {
  const s = size.trim()
  if (!s || /^auto$/i.test(s)) return { kind: "auto" }

  const tier = parseTier(s)
  if (tier) return { kind: "tier", tier }

  const pixels = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(s)
  if (pixels) {
    return { kind: "pixels", width: Number(pixels[1]), height: Number(pixels[2]) }
  }

  const ratio = /^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/.exec(s)
  if (ratio) {
    return { kind: "ratio", width: Number(ratio[1]), height: Number(ratio[2]) }
  }

  throw new Error(
    `Unrecognized size "${size}". Use auto, WIDTHxHEIGHT (e.g. 1024x1024), a ratio (e.g. 16:9), or 1k/2k/4k.`,
  )
}

function parseTier(s: string): ResolutionTier | undefined {
  if (/^512$/i.test(s)) return "512"
  if (/^(1k|1K)$/i.test(s)) return "1k"
  if (/^(2k|2K)$/i.test(s)) return "2k"
  if (/^(4k|4K)$/i.test(s)) return "4k"
  return undefined
}

export function nearestRatio(
  width: number,
  height: number,
  table: Array<[number, number, string]>,
): string {
  const target = width / height
  let best = table[0]![2]
  let bestDiff = Infinity
  for (const [w, h, label] of table) {
    const diff = Math.abs(w / h - target)
    if (diff < bestDiff - 1e-12) {
      bestDiff = diff
      best = label
    }
  }
  return best
}

export function tierFromPixels(width: number, height: number): ResolutionTier {
  const edge = Math.max(width, height)
  if (edge >= 3000) return "4k"
  if (edge >= 1536) return "2k"
  if (edge >= 768) return "1k"
  return "512"
}

function formatRatio(width: number, height: number): string {
  const wr = Number.isInteger(width) ? String(width) : String(width)
  const hr = Number.isInteger(height) ? String(height) : String(height)
  return `${trimNum(wr)}:${trimNum(hr)}`
}

function trimNum(s: string): string {
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")
}

export function mapSizeForGrok(size?: string): SizeMapping {
  if (!size?.trim()) return {}
  const parsed = parseSize(size)
  if (parsed.kind === "auto") return { aspect_ratio: "auto" }
  if (parsed.kind === "tier") {
    return { resolution: grokResolution(parsed.tier!) }
  }
  if (parsed.kind === "pixels") {
    return {
      aspect_ratio: nearestRatio(parsed.width!, parsed.height!, GROK_RATIOS),
      resolution: grokResolution(tierFromPixels(parsed.width!, parsed.height!)),
    }
  }
  const label = formatRatio(parsed.width!, parsed.height!)
  const exact = GROK_RATIOS.find((r) => r[2] === label)
  return { aspect_ratio: exact ? exact[2] : nearestRatio(parsed.width!, parsed.height!, GROK_RATIOS) }
}

export function mapSizeForOpenRouter(size?: string): SizeMapping {
  if (!size?.trim()) return {}
  const parsed = parseSize(size)
  if (parsed.kind === "auto") return { aspect_ratio: "auto" }
  if (parsed.kind === "tier") {
    return { resolution: openrouterResolution(parsed.tier!) }
  }
  if (parsed.kind === "pixels") {
    return {
      aspect_ratio: nearestRatio(parsed.width!, parsed.height!, OPENROUTER_RATIOS),
      resolution: openrouterResolution(tierFromPixels(parsed.width!, parsed.height!)),
    }
  }
  const label = formatRatio(parsed.width!, parsed.height!)
  const exact = OPENROUTER_RATIOS.find((r) => r[2] === label)
  return {
    aspect_ratio: exact ? exact[2] : nearestRatio(parsed.width!, parsed.height!, OPENROUTER_RATIOS),
  }
}

function grokResolution(tier: ResolutionTier): "1k" | "2k" {
  if (tier === "2k" || tier === "4k") return "2k"
  return "1k"
}

function openrouterResolution(tier: ResolutionTier): "512" | "1K" | "2K" | "4K" {
  if (tier === "512") return "512"
  if (tier === "1k") return "1K"
  if (tier === "2k") return "2K"
  return "4K"
}
