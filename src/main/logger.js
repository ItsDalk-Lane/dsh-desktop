'use strict';

const fs = require('fs');

// 极简文件日志:追加写 + 同步到控制台,便于冒烟测试时直接观察
function createLogger(file) {
  const stream = fs.createWriteStream(file, { flags: 'a' });
  const write = (level, args) => {
    const line = [new Date().toISOString(), level, ...args].join(' ');
    stream.write(line + '\n');
    console.log(line);
  };
  return {
    info: (...a) => write('INFO', a),
    warn: (...a) => write('WARN', a),
    error: (...a) => write('ERROR', a),
  };
}

module.exports = { createLogger };
