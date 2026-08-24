# opencode-imagegen

OpenCode 插件：给 agent 两个 tool，`image_gen`（文生图）和 `image_edit`（改图 / 参考合成）。按 `provider/model` 路由到 OpenAI、xAI Grok 或 OpenRouter 的图像 API。

凭证复用 OpenCode 已有的 `provider.*.options`（`apiKey` / `baseURL`），不另开一套 key。

第一版不做：ChatGPT OAuth、流式、Gemini 原生、视频。

## 安装

发布到 npm 之后，在 `opencode.json` 里写包名即可（见下方配置）。本地开发：

```bash
pnpm install
pnpm build
```

然后把 plugin 指向本目录（`file:` URL 或绝对路径）。改完配置或重新 build 后**重启 OpenCode**，插件才会重新加载。

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

- key = OpenCode 的 `providerID/modelID`（可含 `/`，按**第一个** `/` 拆 provider）
- `id`：发给上游的 model 名，缺省用 key 里 provider 之后的部分
- 可选覆盖：`generatePath` / `editPath`、`baseURL`、`apiKey`（覆盖 provider 配置）
- `type` 决定默认 path 和请求体，不是再写一套原生 SDK
- **未登记的 model 会直接报错**，必须写进 `models`

凭证解析顺序：模型条目覆盖 → `config.provider[id].options`（插件 `config` hook 捕获）→ 常见环境变量（`OPENAI_API_KEY` / `XAI_API_KEY` / `OPENROUTER_API_KEY` 以及对应 `*_BASE_URL`）。`apiKey` 支持 `{env:VAR}`。

`baseURL` 按 OpenCode 惯例带 `/v1`（如 `https://api.openai.com/v1`）。path 只拼相对后缀。

## Type（端点方言）

| type | generate | edit | 体 |
|------|----------|------|-----|
| `openai` | `{base}/images/generations` | `{base}/images/edits` | gen JSON；edit multipart（一张用 `image`，多张用 `image[]`，可选 `mask`） |
| `grok` | 同上 | 同上 | 都是 JSON；edit 为 `{ image: { url, type: "image_url" } }`（最多 3 张时用 `images`）；`size` 映射到 `aspect_ratio` + `resolution` |
| `openrouter` | `{base}/images` | 同一端点 | JSON；edit 用 `input_references` |

`type: "openai"` 也可配自定义 path，用来接 OpenAI 兼容网关。

### path 覆盖示例

```json
{
  "plugin": [
    [
      "opencode-imagegen",
      {
        "default": "gateway/gpt-image-2",
        "models": {
          "gateway/gpt-image-2": {
            "type": "openai",
            "generatePath": "images/generations",
            "editPath": "images/edits",
            "baseURL": "https://my-gateway.example/v1"
          }
        }
      }
    ]
  ]
}
```

对应 provider 的 key 仍从 `provider.gateway.options` 或 `GATEWAY_API_KEY` 读取。

## Tools

**`image_gen`**：文生图。参数：`prompt`、`out`、可选 `model` / `size` / `quality`。一次一张，落到磁盘。

**`image_edit`**：已有图 + prompt。参数：`prompt`、`images[]`、`out`、可选 `model` / `size` / `quality` / `mask`。`mask` 只发给 `openai`；grok / openrouter 忽略并在返回里说明。

没参考图用 gen；改图 / 参考合成用 edit。输出为写入后的**绝对路径**。响应是 `url` 则下载；是 `b64_json` 则解码。目标已存在则写成 `-v2` / `-v3`，不覆盖。

`size` 是统一尺寸参数：openai 原样传（`1024x1024` / `auto` / `WIDTHxHEIGHT`）；grok / openrouter 在 adapter 里映射为 `aspect_ratio` + `resolution`。

请求超时默认 300s（图像生成经常超过 60s）。不流式。

## 开发

```bash
pnpm install
pnpm test
pnpm build
```

导出：

```ts
export default { id: "opencode-imagegen", server: plugin } satisfies PluginModule
```
