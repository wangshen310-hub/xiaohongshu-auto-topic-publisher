#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function fail(message) { throw new Error(message); }

function loadPlaywright() {
  try { return require('playwright'); }
  catch {}
  const npxRoot = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
  if (npxRoot && fs.existsSync(npxRoot)) {
    for (const entry of fs.readdirSync(npxRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(npxRoot, entry.name, 'node_modules', 'playwright');
      if (!fs.existsSync(candidate)) continue;
      try { return require(candidate); }
      catch {}
    }
  }
  fail('未找到 Playwright 模块，请先安装 Playwright');
}

function parseArgs(argv) {
  const result = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--config') result.config = argv[++i];
    else if (argv[i] === '--prepare') result.mode = 'prepare';
    else if (argv[i] === '--publish') result.mode = 'publish';
    else if (argv[i] === '--check-deps') result.checkDeps = true;
    else if (argv[i] === '--help') result.help = true;
    else fail(`未知参数：${argv[i]}`);
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('用法：node publish_xhs_edge.js --config <配置文件> (--prepare|--publish)');
    return;
  }
  if (args.checkDeps) {
    const { chromium } = loadPlaywright();
    if (!chromium) fail('Playwright 的 Chromium 驱动不可用');
    console.log('Playwright 依赖检查通过');
    return;
  }
  if (!args.config || !args.mode) fail('必须提供 --config 和 --prepare/--publish 之一');

  const configPath = path.resolve(args.config);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const title = String(config.title || '').trim();
  const body = String(config.body || '').trim();
  const topics = Array.isArray(config.topics) ? config.topics.map(String).filter(Boolean) : [];
  const images = Array.isArray(config.images) ? config.images.map(item => path.resolve(item)) : [];
  const logDir = path.resolve(config.logDir || path.join(path.dirname(configPath), 'publish_logs'));
  const cdpUrl = config.cdpUrl || 'http://127.0.0.1:9223';

  if (!title || title.length > 20) fail('标题为空或超过20字');
  if (!body) fail('正文为空');
  if (images.length < 3 || images.length > 4) fail('必须提供3至4张最终图片');
  for (const image of images) {
    if (path.extname(image).toLowerCase() !== '.png' || !fs.existsSync(image)) fail(`图片必须是存在的 PNG：${image}`);
  }
  fs.mkdirSync(logDir, { recursive: true });
  const fullBody = [body, ...topics.filter(topic => !body.includes(topic))].join(' ').trim();

  const { chromium } = loadPlaywright();
  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0];
  if (!context) fail('Edge 没有可用浏览上下文');

  const manager = await context.newPage();
  await manager.goto('https://creator.xiaohongshu.com/new/note-manager', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await manager.waitForTimeout(3000);
  if (await manager.getByText(title, { exact: true }).count()) fail(`笔记管理页已存在同标题，停止重复提交：${title}`);
  await manager.close();

  let page = context.pages().find(item => item.url().includes('creator.xiaohongshu.com/publish'));
  if (!page) {
    page = await context.newPage();
    await page.goto('https://creator.xiaohongshu.com/publish/publish', { waitUntil: 'domcontentloaded', timeout: 120000 });
  }
  if (/login|signin/.test(page.url())) fail('Edge 登录态无效，需要用户登录');
  await page.bringToFront();

  const fileInput = page.locator('input[type="file"]').first();
  if (!(await fileInput.count())) fail('未找到图片上传控件');
  await fileInput.setInputFiles(images);
  await page.waitForTimeout(5000);

  const titleInput = page.locator('input[placeholder="填写标题会有更多赞哦"]');
  const editor = page.locator('[contenteditable="true"]').first();
  await titleInput.fill(title);
  await editor.fill(fullBody);
  await page.waitForTimeout(1200);

  const pageText = await page.locator('body').innerText();
  const checks = {
    titleExact: (await titleInput.inputValue()) === title,
    bodyComplete: (await editor.innerText()).includes(body),
    topicsComplete: topics.every(topic => pageText.includes(topic)),
    imageCount: pageText.includes(`${images.length}/18`),
    publicVisible: pageText.includes('公开可见'),
    noVisibleError: !/上传失败|发布失败|格式错误|内容违规/.test(pageText),
  };
  if (!Object.values(checks).every(Boolean)) fail(`发布前校验失败：${JSON.stringify(checks)}`);

  await page.locator('.publish-page').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(logDir, 'pre_publish.png'), fullPage: true });

  if (args.mode === 'prepare') {
    fs.writeFileSync(path.join(logDir, 'prepare_result.json'), JSON.stringify({ status: 'prepared', title, checks, images }, null, 2));
    console.log(JSON.stringify({ status: 'prepared', title, checks }, null, 2));
    return;
  }

  const host = page.locator('xhs-publish-btn[is-publish="true"][submit-text="发布"]').first();
  if (!(await host.count()) || !(await host.isVisible())) fail('未找到可见的发布控件');
  if ((await host.getAttribute('submit-disabled')) !== 'false' || (await host.getAttribute('submit-loading')) !== 'false') fail('发布控件不可用');
  const box = await host.boundingBox();
  if (!box || box.width < 600 || box.height < 60) fail('发布控件尺寸异常');
  await host.click({ position: { x: box.width * 0.588, y: box.height * 0.52 } });
  await page.waitForTimeout(12000);
  await page.screenshot({ path: path.join(logDir, 'after_submit.png'), fullPage: true });

  const resultUrl = page.url();
  const explicitSuccess = /published=true/.test(resultUrl) || /发布成功|提交成功/.test(await page.locator('body').innerText());
  const verify = await context.newPage();
  await verify.goto('https://creator.xiaohongshu.com/new/note-manager', { waitUntil: 'domcontentloaded', timeout: 120000 });
  let found = false;
  for (let attempt = 0; attempt < 4 && !found; attempt++) {
    await verify.waitForTimeout(3500);
    found = Boolean(await verify.getByText(title, { exact: true }).count());
    if (!found) await verify.reload({ waitUntil: 'domcontentloaded' });
  }
  await verify.screenshot({ path: path.join(logDir, 'note_manager_verification.png'), fullPage: true });
  const status = explicitSuccess || found ? 'submitted' : 'unverified';
  const record = { status, title, submittedAt: new Date().toISOString(), resultUrl, foundInNoteManager: found, checks, images };
  fs.writeFileSync(path.join(logDir, 'publish_result.json'), JSON.stringify(record, null, 2));
  await verify.close();
  console.log(JSON.stringify(record, null, 2));
  if (status !== 'submitted') process.exitCode = 2;
}

main().catch(error => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
