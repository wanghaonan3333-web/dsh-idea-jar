# 灵感罐（Idea Jar）

[English](README.md) | 中文

灵感罐是 DeepSeek Harness Web 的悬浮创意工具。点击透明罐子生成一条灵感，再把值得保留的内容收藏为罐中的纸条。

## 功能

- 使用当前 DSH 默认模型生成通用创作灵感。
- 在第一次生成后输入额外要求，按 Enter 继续生成。
- 可一次生成最多三条候选；「换一个」按同一要求重新生成。
- 收藏内容以不同颜色的折叠纸条显示在透明罐中。
- 收藏支持展开、编辑、复制、AI 优化、删除、状态筛选，以及删除/优化的撤销。
- 支持导出为 JSON 或 Markdown，并导入 JSON 或旧动态版的备份文件。
- 状态包括计划中、进行中、已实现和暂不做。
- 收藏通过 DSH Settings 的 `idea-jar` 命名空间持久保存，页面刷新、插件更新和 DSH 重启不会清空数据。

## 安装

### npm（推荐）

发布到 npm 后运行：

```sh
dsh plugin --profile web add dsh-idea-jar
```

重启 `dsh web`，然后刷新浏览器页面。

### GitHub 源码

```sh
dsh plugin --profile web add github:wanghaonan3333-web/dsh-idea-jar
```

GitHub 安装会运行项目的 `prepare` 构建脚本。pnpm 10 及以上版本默认阻止依赖构建；请仅在确认源码可信后，按照 CLI 输出把准确的包键加入该 profile 的 `pnpm-workspace.yaml` `allowBuilds`，再重新安装。

### GitHub Release 预构建包

预构建包不需要依赖构建授权：

```sh
dsh plugin --profile web add "https://github.com/wanghaonan3333-web/dsh-idea-jar/releases/latest/download/dsh-idea-jar-0.2.0.tgz"
```

## 使用

1. 点击右下角透明罐子生成灵感。
2. 点击灵感气泡中的星标收藏。
3. 用「换一个」重新生成，或用「来三条」一次生成三条候选。
4. 点击罐子旁的星形按钮打开收藏库。
5. 使用纸卡底部操作编辑、复制、AI 优化或删除内容。
6. 在收藏库顶部工具栏导出或导入。

复制按钮写入系统剪贴板，格式为 `分类｜灵感内容`。浏览器拒绝剪贴板权限时，卡片会显示错误。

## 导入与导出

- **导出 JSON** 生成规范备份：保留完整状态，可在任意机器重新导入。
- **导出 Markdown** 生成便于阅读分享的列表；仅供阅读，不会反向导入。
- **导入** 支持插件自己的 JSON 备份（裸数组或 `{ "favorites": [...] }`）和旧动态版的 `.idea-jar-favorites.txt`（制表符分隔，分类与内容为 base64 编码）。
- 删除或优化收藏后会短暂显示「撤销」提示，可恢复之前的状态。

## 配置

在 profile 的 `cordis.patch.yml` 中按同一个行 ID 覆盖完整配置：

```yaml
- id: idea-jar
  config:
    maxFavorites: 200
    maxRequestChars: 2000
    maxIdeaChars: 1000
    maxTokens: 320
    maxBatch: 3
```

| 字段 | 默认值 | 说明 |
|---|---:|---|
| `maxFavorites` | `200` | 最多保存的收藏数量。 |
| `maxRequestChars` | `2000` | 额外需求的最大字符数。 |
| `maxIdeaChars` | `1000` | 单条收藏内容的最大字符数。 |
| `maxTokens` | `320` | 每次生成或优化的模型输出上限。 |
| `maxBatch` | `3` | 单次生成请求的最大候选条数。 |

## 数据与权限

- 收藏由 DSH Settings Provider 写入 `$DSH_HOME/settings.yaml` 的 `idea-jar` 段；插件不在项目目录中创建数据文件。
- 生成和 AI 优化使用当前配置的 DSH 默认模型及其凭据。
- Host 注册同源 POST API `/idea-jar/api`；跨站请求会被拒绝，请求体限制为 2 MiB。
- Client 仅在用户点击复制时调用浏览器 Clipboard API。
- 插件不包含遥测、广告或第三方分析。

## 本地开发

要求 Node.js 22.19 或更高版本。

```sh
npm install
npm run check
```

本地安装到 Web profile：

```sh
dsh plugin --profile web add ./dsh-idea-jar
```

验证组合层：

```sh
dsh --profile web --dump-config
```

输出应包含 `idea-jar` 行。

## 发布

1. 将项目中所有 `wanghaonan3333-web` 占位符替换为真实 GitHub 用户名。
2. 创建公开 GitHub 仓库，并添加 `dsh-plugin` Topic。
3. 运行 `npm run check` 和 `npm pack --dry-run`。
4. 推荐运行 `npm publish --access public`，让用户安装预构建产物。
5. 仓库创建满一天且至少有 10 次提交后，向 `awesome-dsh-plugin/awesome-dsh-plugin` 提交 `community/awesome-entry.yml` 对应的条目。

## 模型体验

生成和 AI 优化是独立的辅助模型请求，不写入当前聊天会话。插件把一条用户需求或已有灵感发送给当前默认模型，要求模型只返回 `分类｜灵感内容`。每次调用最多请求 `maxTokens` 个输出 token；更改额外需求、已有灵感、默认模型或系统提示会改变该独立请求的缓存前缀。

## 已知限制

- 当前收藏保存在一台 DSH 安装的 Settings 文件中，不会自动跨设备同步。
- Clipboard API 需要浏览器授权或受信任的本地上下文。
- 插件面向 `web` profile，不提供 headless UI。

## 许可证

[MIT](LICENSE)
