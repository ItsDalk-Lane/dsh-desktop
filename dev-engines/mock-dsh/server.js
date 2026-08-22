'use strict';

// Mock 住客:模拟一个自带 Web UI 的引擎,用于端到端验证"房子"的完整链路
// (拉起 -> 端口注入 -> 数据目录注入 -> 就绪探测 -> 窗口加载)。
// 换成真 dsh 后,窗口里显示的就是 dsh 原版 Web UI,房子代码零改动。
const http = require('http');
const fs = require('fs');

const PORT = Number(process.env.DSH_DESKTOP_PORT || 3999);
const DATA_DIR = process.env.DSH_DESKTOP_DATA_DIR || '';

let entries = [];
try { entries = fs.readdirSync(DATA_DIR); } catch (_) { /* empty */ }

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>Mock DSH Engine</title>
<style>
  body{margin:0;height:100vh;background:#10141d;color:#e6e9ef;font-family:-apple-system,"PingFang SC",sans-serif;display:flex;align-items:center;justify-content:center}
  .card{max-width:560px;padding:40px;border-radius:16px;background:#161c29;border:1px solid #232b3d}
  h1{font-size:20px;margin:0 0 6px} p{color:#9aa3b5;font-size:13px;line-height:1.8;margin:4px 0}
  code{background:#0b0e14;padding:2px 8px;border-radius:6px;font-size:12px;color:#8ab4ff}
  .ok{color:#5dd39e}
</style></head><body><div class="card">
  <h1>Mock DSH Engine <span class="ok">●</span></h1>
  <p>你看到的是"住客自带的 Web UI"。这一页由引擎子进程渲染,不是桌面的代码。</p>
  <p>监听端口:<code>${PORT}</code>(由房子随机分配并通过环境变量注入)</p>
  <p>数据目录:<code>${DATA_DIR || '(未注入)'}</code></p>
  <p>数据目录内容:<code>${entries.length ? entries.join(', ') : '(空)'}</code></p>
  <p>把真 dsh 作为引擎导入后,这里会原样显示 dsh 的官方 Web UI。</p>
</div></body></html>`);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock engine listening on 127.0.0.1:${PORT}, dataDir=${DATA_DIR}`);
});
