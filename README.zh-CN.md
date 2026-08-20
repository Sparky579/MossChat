<div align="center">

<img src="src/app/icon.svg" width="72" height="72" alt="MossChat 图标">

# MossChat

使用自己的模型 API Key 的浏览器聊天客户端。密钥、聊天记录、文件和设置都保存在浏览器中。

<p>
  <a href="https://chat.utilgadgets.com">立即使用</a>
  · <a href="#快速开始">文档</a>
  · <a href="CHANGELOG.md">更新记录</a>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-198754.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-198754.svg)](CHANGELOG.md)
[![Next.js](https://img.shields.io/badge/Next.js-15-111111.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org/)

<p><a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a></p>

</div>

## 为什么做这个

不少自托管聊天客户端需要 Docker、数据库和服务端密钥存储。许多界面完成度高的产品又不是开源项目。

MossChat 只做浏览器端。打开页面，填入提供商密钥，即可开始聊天。请求从浏览器直接发送到你选择的模型提供商。

项目没有 MossChat 账号服务、API 代理或服务端密钥库。

## 功能

| 分类 | 能做什么 |
| --- | --- |
| 提供商 | Google Gemini、Anthropic、OpenRouter、OpenAI 和任意 OpenAI 兼容地址 |
| 对话 | 流式输出、停止、重新生成、编辑、分支、置顶、全文搜索和会话 system prompt |
| 渲染 | Markdown、代码高亮、表格、KaTeX 公式和稳定的流式排版 |
| Thinking | 可折叠的思考过程，支持提供商预设值和 token 预算 |
| 文件 | 可拖拽、选择文件，也可从剪贴板粘贴图片。支持的提供商可直接接收图片和 PDF |
| Notebook | 对话分组、改名，以及 Notebook system prompt。内部会话可继承该提示词 |
| 本地数据 | 单条消息 IndexedDB 存储、持久化存储申请、ZIP 备份、自动文件夹备份和旧版 JSON 导入 |
| 界面 | 默认英文，可切换简体中文，支持语音输入、移动端和本地设置 |

## 快速开始

可直接使用 [chat.utilgadgets.com](https://chat.utilgadgets.com)，无需注册。

自托管需要当前版本的 Node.js。

```bash
git clone git@github.com:Sparky579/MossChat.git
cd MossChat
npm ci
npm run build
npm run start
```

打开 `http://localhost:3000`，然后在 **Settings → API & models** 中添加提供商。生产环境通过 Next.js 提供服务，请使用自己的反向代理或进程管理方式保持 Node 进程运行。

## 数据与隐私

API Key 和偏好设置保存在 `localStorage`。聊天、消息、Notebook 和附件保存在 IndexedDB。应用没有接收聊天数据或提供商密钥的 API 路由。

每条消息独立保存。助手流式输出会持续写入本地，因此关闭标签页或网络中断时，不需要等完整回复结束才保存内容。

ZIP 备份可分别选择聊天记录、设置和 API Key、附件二进制。包含 API Key 的备份应妥善保管。

## 不做什么

这些边界用于保持安全模型和维护范围清晰。

| 不包含 | 原因 |
| --- | --- |
| 服务端 API Key 存储 | 提供商密钥应保留在浏览器中 |
| 计费、额度和充值 | MossChat 是客户端，不是模型转售平台 |
| 多用户账号和角色 | 项目没有认证服务 |
| 托管向量检索或服务端 RAG | 这需要服务端、索引流程和独立的数据安全模型 |
| 自主多步骤 Agent | 工具执行需要更广的权限和安全模型 |

如果需要这些功能，Open WebUI 和 LibreChat 更合适。

## 已知限制

浏览器存储由浏览器控制。可在设置中申请持久化存储，但并非所有环境都保证成功。保存大量文件时请定期导出备份。

大附件会占用浏览器配额。用户清除网站数据或浏览器存储空间紧张时，数据可能被删除。

提供商请求由浏览器直接发送。自定义地址必须允许浏览器 CORS 请求。部分模型只接受特定的 reasoning preset。

自定义 function calling 只会把模型请求的函数参数展示在对话中。MossChat 不会执行任意代码，也不访问本地系统工具。

## 常见问题

### API Key 放在哪里？

保存在运行 MossChat 的设备浏览器 localStorage 中。它只会在请求时直接发送到你选择的模型提供商。

### 可以用自定义地址、代理或自托管网关吗？

可以。在 **Settings → API & models** 中添加 OpenAI 兼容提供商和 Base URL。

### 可以给不同项目设置不同提示词吗？

可以。右上角 Prompts 可为当前会话或 Notebook 保存 system prompt。Notebook 内的会话会继承它，除非会话有自己的提示词。

### 数据能抵抗浏览器清理吗？

MossChat 不会收到你的数据，但浏览器存储不是备份。请使用 ZIP 导出，或在设置中配置自动备份文件夹。

## 参与贡献

欢迎提交 Bug、修复、测试和翻译。开始较大的改动前请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

MossChat 使用 [MIT License](LICENSE)。
