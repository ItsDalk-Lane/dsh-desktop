'use strict';

const fs = require('fs');
const path = require('path');

// 引擎注册表:管理 userData/engines/ 下已安装的引擎,以及 current.json 指针。
// current.json 形如 {"id":"mock-dsh","dir":"/abs/path"} —— 指向当前住客。

function listInstalled(enginesRoot) {
  if (!fs.existsSync(enginesRoot)) return [];
  return fs
    .readdirSync(enginesRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(enginesRoot, e.name))
    .filter((dir) => fs.existsSync(path.join(dir, 'engine.json')))
    .map((dir) => {
      try {
        const m = JSON.parse(fs.readFileSync(path.join(dir, 'engine.json'), 'utf8'));
        return { id: m.id || path.basename(dir), name: m.name, version: m.version, dir };
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
}

function getCurrent(currentEngineFile, enginesRoot) {
  try {
    const cur = JSON.parse(fs.readFileSync(currentEngineFile, 'utf8'));
    if (cur.dir && fs.existsSync(path.join(cur.dir, 'engine.json'))) return cur.dir;
    if (cur.id) {
      const hit = listInstalled(enginesRoot).find((e) => e.id === cur.id);
      if (hit) return hit.dir;
    }
  } catch (_) { /* no current engine yet */ }
  return null;
}

// 切换引擎时把旧值存进 previous,供一键回滚(再回滚一次即切换回来)
function setCurrent(currentEngineFile, dir, id) {
  fs.mkdirSync(path.dirname(currentEngineFile), { recursive: true });
  let previous = null;
  try {
    const cur = JSON.parse(fs.readFileSync(currentEngineFile, 'utf8'));
    if (cur.dir && cur.dir !== path.resolve(dir)) {
      previous = { id: cur.id, dir: cur.dir };
    }
  } catch (_) { /* first set */ }
  fs.writeFileSync(
    currentEngineFile,
    JSON.stringify({ id, dir: path.resolve(dir), previous }, null, 2)
  );
}

function getPrevious(currentEngineFile) {
  try {
    const cur = JSON.parse(fs.readFileSync(currentEngineFile, 'utf8'));
    if (cur.previous && cur.previous.dir && fs.existsSync(path.join(cur.previous.dir, 'engine.json'))) {
      return cur.previous;
    }
  } catch (_) { /* nothing */ }
  return null;
}

module.exports = { listInstalled, getCurrent, setCurrent, getPrevious };
