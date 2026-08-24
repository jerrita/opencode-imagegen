# opencode-imagegen

npm 插件。给 agent 两个 tool：`image_gen` / `image_edit`。按配置把 `provider/model` 路由到对应图像 API。凭证复用 opencode 已有 `provider.*.options`（apiKey / baseURL），不另开一套 key。

第一版不做：ChatGPT OAuth、流式、Gemini 原生、视频。

## 配置

`opencode.json` 用 plugin tuple：

```json
{
  "plugin": [
    [
      "opencode-imagegen",
      {
        "default": "openai/gpt-image-2",
        "models": {
          "openai/gpt-image-2": { "type": "openai" },
          "xai/grok-imagine-image": { "type": "grok" },
          "openrouter/openai/gpt-image-2": {
            "type": "openrouter",
            "id": "openai/gpt-image-2"
          }
        }
      }
    ]
  ]
}
```

- key = opencode 的 `providerID/modelID`（可含 `/`，按第一个 `/` 拆 provider）
- `id`：发给上游的 model 名，缺省用 key 里 provider 之后的部分
- 可选覆盖：`generatePath` / `editPath`、`baseURL`、`apiKey`（覆盖 provider 配置）
- `type` 决定默认 path 和请求体，不是再写一套原生 SDK

凭证解析顺序：模型条目覆盖 → `config.provider[id].options`（`config` hook 捕获）→ 常见环境变量。

未登记的 model 直接报错，要求写进 `models`。

## Type（端点方言）

| type | generate | edit | 体 |
|------|----------|------|-----|
| `openai` | `{base}/images/generations` | `{base}/images/edits` | gen JSON；edit multipart（`image`/`image[]` + 可选 `mask`） |
| `grok` | 同上 | 同上 | 都是 JSON；edit 为 `{ image: { url, type: "image_url" } }`（最多 3 张）；`size` 映射到 `aspect_ratio` + `resolution` |
| `openrouter` | `{base}/images` | 同一端点 | JSON；edit 用 `input_references`（这就是「改后缀」：不是 `/images/generations`） |

`type: "openai"` 也可配自定义 path，用来接 OpenAI 兼容网关。

`baseURL` 按 opencode 惯例带 `/v1`（如 `https://api.openai.com/v1`）。path 只拼相对后缀。

## Tools

**`image_gen`**：文生图。参数：`prompt`、`out`、可选 `model` / `size` / `quality`。一次一张，落到磁盘。

**`image_edit`**：已有图 + prompt。参数：`prompt`、`images[]`、`out`、可选 `model` / `size` / `quality` / `mask`。`mask` 只发给 `openai`；grok/openrouter 忽略并说明。

场景划分：没参考图用 gen；改图/参考合成用 edit。不把「有图就 edit」藏进一个 tool。

输出：写文件，返回绝对路径。响应是 `url` 则下载；是 `b64_json` 则解码。目标已存在则 `-v2`/`-v3`，不覆盖。

`size` 作为统一尺寸参数：openai 原样传（`1024x1024` / `auto` / `WIDTHxHEIGHT`）；grok/openrouter 在 adapter 里映射。

## 结构

```
src/
  index.ts              # PluginModule：config hook + 两个 tool
  options.ts            # 解析 plugin options
  credentials.ts        # provider → apiKey/baseURL
  http.ts               # fetch、拼 URL、错误体
  io.ts                 # 读参考图、存结果
  adapters/
    types.ts            # ImageAdapter 接口
    openai.ts
    grok.ts
    openrouter.ts
    resolve.ts          # type → adapter
tests/                  # URL 拼接、size 映射、options、mock HTTP
```

导出：

```ts
export default { id: "opencode-imagegen", server: plugin } satisfies PluginModule
```

栈：TypeScript、pnpm、tsc。peer：`@opencode-ai/plugin`。

## 实现要点

1. `config` hook 存一份 merged config（`PluginInput` 本身没有 config）。
2. tool 的 `model` 缺省用 `options.default`。
3. openai edit 用 multipart，兼容多数网关；gpt-image 官方也接受 JSON，第一版不双栈。
4. 不流式；超时拉长（图像常 >60s）。
5. README：三种 type 的配置示例、path 覆盖、重启 opencode。
