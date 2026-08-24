# 小红书图文全自动选题发布

一个面向 Codex 的开源 Skill，用于完成不限主题的小红书图文选题、视觉参考拆解、图片质量审查、标题正文话题创作，以及基于 Playwright + Microsoft Edge 的受控发布。

## 特点

- 主题自由：不限特定主题或垂直类。
- 先选题后创作：支持先给4个差异化候选供人工审核。
- 参考图对标：参考图与每张成图使用同一套100分量表。
- 强制返修：单张未达到参考基线时不能作为完成稿。
- 系列差异：避免简单换场景、换色或重复构图。
- 无损交付：默认3至4张9:16 PNG与简洁Markdown发布文档。
- 安全发布：明确授权后才提交；查重、单次点击、成功证据和风控停止条件齐全。
  

## 安装

将仓库克隆到 Codex Skills 目录：

```powershell
git clone https://github.com/wangshen310-hub/xiaohongshu-auto-topic-publisher.git "$env:USERPROFILE\.codex\skills\xhs-auto-topic-publisher"
```

重新启动或刷新 Codex 后，通过 `$xhs-auto-topic-publisher` 调用。

## 调用示例

```text
使用 $xhs-auto-topic-publisher 给我提供4个完全不同的小红书图文选题，先不要生成图片。
```

```text
使用 $xhs-auto-topic-publisher 基于我选择的主题完成3至4张9:16图片、标题、正文和话题。
```

```text
使用 $xhs-auto-topic-publisher 把已经审核通过的成稿准备到Edge发布页，但不要点击发布。
```

```text
使用 $xhs-auto-topic-publisher 发布这套已审核成稿，并验证笔记管理页状态。
```

## Playwright发布

发布脚本连接已经通过远程调试端口启动的 Microsoft Edge：

```powershell
node scripts/publish_xhs_edge.js --check-deps
node scripts/publish_xhs_edge.js --config C:\path\post.json --prepare
node scripts/publish_xhs_edge.js --config C:\path\post.json --publish
```

配置格式与登录态要求见 [Edge发布规程](references/edge-publishing.md)。`--publish` 会产生真实外部写入，请仅在获得账号持有者明确授权后使用。

## 设计边界

- 本项目不提供验证码、风控或实名验证绕过功能。
- 默认不抓取小红书账号、笔记或互动数据，也不伪造趋势结论。
- 请尊重参考图版权，只借鉴可描述的设计语言，不复制具体作品。
- 平台页面结构可能变化；发布前应执行 `--prepare` 并检查截图。

## 许可证

[MIT](LICENSE)
