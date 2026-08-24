# Playwright + Microsoft Edge 发布规程

## 配置

`scripts/publish_xhs_edge.js` 接收UTF-8 JSON：

```json
{
  "title": "不超过20字的标题",
  "body": "正文",
  "topics": ["#摄影", "#视觉设计"],
  "images": ["C:/absolute/01.png", "C:/absolute/02.png", "C:/absolute/03.png"],
  "logDir": "C:/absolute/publish_logs/2026-08-25",
  "cdpUrl": "http://127.0.0.1:9223"
}
```

图片路径必须为绝对路径，且只能是最终PNG。话题会附加到正文，已有话题自动去重。

```powershell
node scripts/publish_xhs_edge.js --config C:\path\post.json --prepare
node scripts/publish_xhs_edge.js --config C:\path\post.json --publish
```

- `--prepare`：连接已有Edge CDP会话，查重、上传、填写并截图，不提交。
- `--publish`：完成相同检查后只提交一次，再进入笔记管理页核验。
- `--check-deps`：只检查Playwright依赖。

## 登录态与安全

使用任务专用Edge用户目录，以 `--remote-debugging-port=9223` 启动。不要使用日常Edge默认用户目录，不复制认证数据，不提交用户目录、日志、截图或配置中的私人路径。

首次登录、验证码、风控和实名验证必须由用户完成。自动化不得绕过平台验证。

## 发布控件

当前图文页底部可能由 `<xhs-publish-btn>` 闭合组件渲染，普通文本定位可能失败：

1. 滚动 `.publish-page` 到底部。
2. 定位 `xhs-publish-btn[is-publish="true"][submit-text="发布"]`。
3. 核对 `submit-disabled="false"` 与 `submit-loading="false"`。
4. 根据宿主元素尺寸点击提交区域，不使用屏幕绝对坐标。

页面结构变化时先截图并重新确认组件属性或可访问结构，禁止盲点。

## 成功证据

- 页面显示发布或提交成功；
- 地址包含 `published=true`；
- 笔记管理页出现精确标题及正确首图；
- 获得有效作品ID或链接。

显示“审核中”表示提交成功但尚未公开。日志至少保存发布前截图、提交后截图、管理页截图和不含凭据的 `publish_result.json`。
