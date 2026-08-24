import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, it } from "node:test"
import { normalizeOutPath, saveImage, uniqueOutputPath } from "../src/io.ts"

describe("uniqueOutputPath", () => {
  it("adds -v2 / -v3 when the target exists", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "imagegen-"))
    const target = path.join(dir, "cat.png")
    await fs.writeFile(target, "a")
    assert.equal(await uniqueOutputPath(target), path.join(dir, "cat-v2.png"))
    await fs.writeFile(path.join(dir, "cat-v2.png"), "b")
    assert.equal(await uniqueOutputPath(target), path.join(dir, "cat-v3.png"))
  })
})

describe("normalizeOutPath", () => {
  it("adds .png when no extension", () => {
    assert.equal(normalizeOutPath("/tmp/out", "/home"), "/tmp/out.png")
  })
  it("resolves relative paths against cwd", () => {
    assert.equal(normalizeOutPath("out/a.png", "/proj"), path.join("/proj", "out/a.png"))
  })
})

describe("saveImage", () => {
  it("decodes b64_json and does not overwrite", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "imagegen-"))
    const out = path.join(dir, "art.png")
    await fs.writeFile(out, "old")
    const png = Buffer.from([137, 80, 78, 71])
    const saved = await saveImage({
      out,
      cwd: dir,
      payload: { kind: "b64", b64: png.toString("base64"), mime: "image/png" },
    })
    assert.equal(saved.path, path.join(dir, "art-v2.png"))
    const bytes = await fs.readFile(saved.path)
    assert.deepEqual(bytes.subarray(0, 4), png)
  })

  it("downloads url payloads", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "imagegen-"))
    const fetch = async () =>
      new Response(Buffer.from("hello-img"), { status: 200, headers: { "content-type": "image/png" } })
    const saved = await saveImage({
      out: "pic.png",
      cwd: dir,
      payload: { kind: "url", url: "https://cdn.example/pic.png" },
      fetch,
    })
    assert.equal(await fs.readFile(saved.path, "utf8"), "hello-img")
  })
})
