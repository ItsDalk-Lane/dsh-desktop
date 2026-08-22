'use strict';

const path = require('path');
const fs = require('fs');

// 所有用户态数据都在 userData 下,与安装目录分离:
// 升级房子、更换引擎都不会动这些目录。
let root = null;

function init(userDataPath) {
  root = userDataPath;
  ensureDirs();
}

function ensureDirs() {
  for (const dir of [enginesRoot(), engineDataDir(), logsDir()]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function enginesRoot() {
  return path.join(root, 'engines');
}

// 引擎的用户数据(API Key、会话等)统一放这里,通过 dataDirEnv 注入给引擎,
// 这样换住客时用户数据不丢。
function engineDataDir() {
  return path.join(root, 'engine-data');
}

function logsDir() {
  return path.join(root, 'logs');
}

function houseLogFile() {
  return path.join(logsDir(), 'house.log');
}

function engineLogFile() {
  return path.join(logsDir(), 'engine.log');
}

function currentEngineFile() {
  return path.join(enginesRoot(), 'current.json');
}

// 仓库自带的开发用引擎(mock),仅未打包的 dev 模式自动使用
function devEnginesDir() {
  return path.join(__dirname, '..', '..', 'dev-engines');
}

module.exports = {
  init,
  ensureDirs,
  enginesRoot,
  engineDataDir,
  logsDir,
  houseLogFile,
  engineLogFile,
  currentEngineFile,
  devEnginesDir,
};
