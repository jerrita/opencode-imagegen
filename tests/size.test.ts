import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mapSizeForGrok, mapSizeForOpenRouter, parseSize, tierFromPixels } from "../src/adapters/size.ts"

describe("parseSize", () => {
  it("parses pixels, ratios, tiers, auto", () => {
    assert.deepEqual(parseSize("1024x1024"), { kind: "pixels", width: 1024, height: 1024 })
    assert.deepEqual(parseSize("16:9"), { kind: "ratio", width: 16, height: 9 })
    assert.deepEqual(parseSize("2k"), { kind: "tier", tier: "2k" })
    assert.equal(parseSize("auto").kind, "auto")
  })
})

describe("mapSizeForGrok", () => {
  it("maps square 1024 to 1:1 1k", () => {
    assert.deepEqual(mapSizeForGrok("1024x1024"), { aspect_ratio: "1:1", resolution: "1k" })
  })
  it("maps 1536x1024 to 3:2 2k", () => {
    assert.deepEqual(mapSizeForGrok("1536x1024"), { aspect_ratio: "3:2", resolution: "2k" })
  })
  it("maps 2048x2048 to 1:1 2k", () => {
    assert.deepEqual(mapSizeForGrok("2048x2048"), { aspect_ratio: "1:1", resolution: "2k" })
  })
  it("clamps 4k to 2k", () => {
    assert.deepEqual(mapSizeForGrok("4k"), { resolution: "2k" })
  })
  it("passes auto", () => {
    assert.deepEqual(mapSizeForGrok("auto"), { aspect_ratio: "auto" })
  })
  it("snaps ratios onto grok's list", () => {
    assert.equal(mapSizeForGrok("16:9").aspect_ratio, "16:9")
  })
  it("returns empty when size omitted", () => {
    assert.deepEqual(mapSizeForGrok(undefined), {})
  })
})

describe("mapSizeForOpenRouter", () => {
  it("uses uppercase K tiers", () => {
    assert.deepEqual(mapSizeForOpenRouter("1024x1024"), { aspect_ratio: "1:1", resolution: "1K" })
    assert.deepEqual(mapSizeForOpenRouter("2k"), { resolution: "2K" })
    assert.deepEqual(mapSizeForOpenRouter("4k"), { resolution: "4K" })
    assert.deepEqual(mapSizeForOpenRouter("512"), { resolution: "512" })
  })
})

describe("tierFromPixels", () => {
  it("classifies by max edge", () => {
    assert.equal(tierFromPixels(1024, 1024), "1k")
    assert.equal(tierFromPixels(1536, 1024), "2k")
    assert.equal(tierFromPixels(3840, 2160), "4k")
    assert.equal(tierFromPixels(512, 512), "512")
  })
})
