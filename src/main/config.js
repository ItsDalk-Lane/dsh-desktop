'use strict';

const fs = require('fs');
const path = require('path');

// 极简用户配置(userData/config.json),存发布源等设置
let file = null;

function init(userDataRoot) {
  file = path.join(userDataRoot, 'config.json');
}

function getAll() {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return {};
  }
}

function get(key) {
  return getAll()[key];
}

function set(key, value) {
  const all = getAll();
  all[key] = value;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(all, null, 2));
}

module.exports = { init, get, set, getAll };
