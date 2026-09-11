# dsh-darkplus-code

为 [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness)（`dsh`）代码块提供 VS Code **Dark+** 语法配色与字号控制。

DSH 只内置 `light` / `dark` 两套配色，且代码块字号被固定为 **11px** —— 所以你在「设置 → 通用 → 字号大小」里调大字号时，正文会变、代码块不变。本插件只改代码块，界面其他部分一律不动。

[English](README.md)

## 功能

**1. Dark+ 语法配色**

把内置的代码块 token 配色换成 VS Code Dark+：

| Token | 深色 | 浅色 | 对应内容 |
| --- | --- | --- | --- |
| keyword | `#c586c0` | `#af00db` | `public class`、`if`、`return` |
| constant | `#b5cea8` | `#098658` | `0f`、`10000`、`true` |
| string | `#ce9178` | `#a31515` | `"配置"` |
| comment | `#6a9955` | `#008000` | `// 注释` |
| parameter | `#9cdcfe` | `#001080` | 变量名、局部标识符 |
| punctuation | `#d4d4d4` | `#1f1f1f` | `( ) { } ;` |
| link | `#4fc1ff` | `#0563c1` | markdown 链接 |
| type / function | `#4ec9b0` | `#267f99` | `MapNpc`、`LateUpdate` |

代码块底色 `#1e1e1e`（深色）/ `#ffffff`（浅色），前景 `#9cdcfe`（深色）/ `#001080`（浅色）。

**2. 字号跟随你的字号设置**

DSH 给其他所有内容字号都用 `calc(基准 + var(--dsh-content-font-delta))` —— 标题会随字号增减，代码块不会。本插件把代码块接到同一套机制上：

| 你的 DSH 字号 | 正文 | 代码块（默认「跟随字号」） |
| --- | --- | --- |
| 12 | 12px | 10px |
| 14 | 14px | 12px |
| 17 | 17px | 15px |

**3. 独立的设置行**

**设置 → 通用 → 代码块外观**，紧邻系统自带的「字号大小」一行：

- **跟随字号**（默认）· **比例** · **固定**，以及 `13 14 15 16 17` 像素预设
- **类型/函数 青** 或 **函数 黄** —— shiki 把 `entity.name.type` 与 `entity.name.function` 归到同一个变量，二者无法分色，这里选哪个生效
- 配色总开关
- 实时读数（`正文 17px · 代码块 15px · 行内 15px`）

设置持久化在 `~/.dsh-darkplus-code/config.json`，重启与端口变化都不丢。

## 安装

```bash
dsh plugin --profile <你的profile> add dsh-darkplus-code
```

profile 名要填真实值（DSH Desktop 是 `desktop`，Web 版是 `web`）。装完重启 DSH（或等 profile patch 热重载后刷新页面），然后在 **设置 → 通用** 里配置。

卸载：

```bash
dsh plugin --profile <你的profile> remove dsh-darkplus-code
```

## 改动范围

本插件**只**写 `--shiki-*` 系列 token 变量、两个 `--dsw-font-markdown-code*` 字号 token，以及 `.md-code-block` / `pre.shiki` 下的代码块元素规则。不碰任何其他 `--dsw-alias-*` 界面 token —— 背景、边框、圆角、玻璃效果等全部维持原主题。

## 为什么要用 `!important`

DSH 通过 shiki 的 css-variables 主题渲染代码：每个 token span 带内联 `style="color:var(--shiki-token-*)"`。在真实 DSH 实例上实测发现：变量本身在 `<body>` 上取值正确，但 span 的实算颜色仍是被继承的颜色，因此"只覆盖变量"并不总能生效。带 `!important` 的作者规则是唯一能压过内联非重要声明的写法，所以本插件除了改写变量，也把颜色直接钉在 span 上。

## 兼容性

- DSH Desktop 与 `web` profile。
- 针对使用 shiki css-variables 主题、以 `.md-code-block` 呈现代码的 `dsh-web-app` 验证。
- Host 半边除可选的 `webServer` 服务外无依赖；没有该服务时仍然生效，只是无法持久化设置。

## 许可

MIT
