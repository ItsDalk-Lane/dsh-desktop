'use strict';

const fs = require('fs');

// tar 命令选择:
// Windows 上必须显式用系统自带的 bsdtar(System32\tar.exe,Win10 1803+ 必带)。
// 否则可能命中 Git 自带的 GNU tar —— 它把 "D:\path" 的冒号解析成远程主机语法,
// 直接报 "Cannot connect to D: resolve failed"(2026-08-22 CI 实测踩坑)。
function tarCommand() {
  if (process.platform !== 'win32') return 'tar';
  const systemTar = 'C:\\Windows\\System32\\tar.exe';
  return fs.existsSync(systemTar) ? systemTar : 'tar';
}

module.exports = { tarCommand };
