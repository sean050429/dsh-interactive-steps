# dsh-interactive-steps

[English](README.md) | 中文

一个渲染在**对话流内部**的可交互步骤卡片。

这个 bundle 注册一个工具 `interactive_steps`,并为该工具的调用卡片注册一个客户端视图。
工具被调用时,它的卡片不是通用的工具行,而是一个**可点击的 stepper** ——
用户在对话正文里直接切换步骤,**不需要打开任何文件,也不产生额外的工具调用**。

## 安装

把包写到工作区目录,然后用 Harness 的 Plugin Manager 装进当前 profile:

```
plugin_manager({ action: "install_bundle", target: "<这个包的绝对路径>" })
```

安装会把 bundle 注册进 profile 并立即生效。
**Host 侧改动需要重启 App**;`client.js` 的改动刷新页面即可生效。

## 工作原理

| 半边 | 文件 | 贡献 |
|---|---|---|
| Host | `index.js` | 通过 `ctx.tools.register` 注册 `interactive_steps` 工具,并注册一段系统提示告诉模型何时使用它。两者都由 `ctx.effect` 持有,卸载即移除。 |
| Client | `client.js` | 以 `interactive_steps` 为 key 注册 `tool.call.toolview`,让这个工具的行渲染成 stepper。 |

工具在 Host 侧是**惰性**的:它唯一的职责是把步骤写进对话日志。
步骤数据走工具的**参数**,客户端从工具 block 的调用头读取 ——
所以卡片在调用进行中和结果落定后渲染一致,重放会话也是同一张卡片。

点击是组件内的 React state,**不回传 Host**。

## 自动调用

注册好一个工具,只意味着它**可用**,并不强制模型去用它;而默认倾向是输出 markdown 列表。
所以 Host 半边还注册了一段系统提示(`interactive-steps:guidance`,order 1900,夹在官方各工具段之间):
三步以上、真正递进的内容用卡片呈现,并**明确排除**互不相关的并列要点、单一结论,
以及用户明确要求纯文本的情况。

这是全局 profile 贡献,会影响该 profile 下的**所有会话**。可在启动时关闭:

```
DSH_INTERACTIVE_STEPS_GUIDANCE=0      # 保留工具,去掉"自动用"的提示
DSH_INTERACTIVE_STEPS_MAX=12          # 限制单卡片步骤数(默认 24)
```

**刻意不导出 `Config`**:Loader 只接受原生 schemastery schema 来校验行的 `config`,
而 `@deepseek-ai/schemastery` 在这个工作区 bundle 里解析不了,
硬写 import 会导致插件**激活失败**。

## 可见性(重要)

卡片渲染在工具调用行内部,而 Chat 默认会把已完成回合的过程行**折叠**进一个收起的过程组。
把 **设置 → 通用 → 工作步骤展示** 设为 **完全展开**,过程行才会直接平铺显示;
在 简洁 / 标准 / 详细 档位下,**卡片依然存在,只是被折叠了**。

如果觉得功能"不见了",这是第一个要查的地方:
**「轨迹」视图**会把所有工具调用平铺列出 —— 轨迹里有、对话里没有,说明是被折叠,而不是不存在。

## 工具形态

```
interactive_steps({ title?, steps: [{ title, detail?, code?, note? }] })
```

- `title` —— 卡片标题;默认 `Steps`。
- `steps[].title` —— 必填;没有标题的步骤会被丢弃。
- `detail` / `code` / `note` —— 可选的正文段落、等宽代码块、警示标注。
- 单张卡片最多呈现 24 步。

## 样式

只引用 `--dsw-alias-*` 主题 token(`brand-primary`、`label-*`、`bg-layer-*`、
`border-l*`、`state-success-primary`、`state-warn-primary`),
因此卡片会跟随浅色/深色主题,不硬编码任何配色。

卡片外层包了一个**错误边界**:渲染抛错时退化成纯文字步骤列表,
而不是塌成一片空白 —— 否则抛错的 slot entry 会**静默消失**。

## 验证

没有浏览器的情况下,用 hook 忠实还原的 React 桩执行了**真实导出的组件**:
挂载、点击 rail、下一步/上一步、两端边界、结果落定后的卡片、
畸形/空参数、以及 keydown 监听器的释放。活体注册通过 `cordis_inspect_query` 确认。

## 仓库

https://github.com/sean050429/dsh-interactive-steps

## 许可

[MIT](LICENSE)
