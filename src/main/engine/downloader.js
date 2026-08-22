'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UA = 'dsh-desktop/0.1';

function getStream(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    if (redirectsLeft < 0) return reject(new Error('too many redirects'));
    const mod = url.startsWith('https:') ? https : http;
    const req = mod.get(url, { headers: { 'user-agent': UA } }, (res) => {
      const loc = res.headers.location;
      if (res.statusCode >= 300 && res.statusCode < 400 && loc) {
        res.resume();
        return resolve(getStream(new URL(loc, url).href, redirectsLeft - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`download failed: HTTP ${res.statusCode} for ${url}`));
      }
      resolve(res);
    });
    req.on('error', reject);
  });
}

async function fetchJson(url) {
  const res = await getStream(url);
  const body = await new Promise((resolve, reject) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => resolve(Buffer.concat(chunks)));
    res.on('error', reject);
  });
  try {
    return JSON.parse(body.toString('utf8'));
  } catch (e) {
    throw new Error(`invalid JSON from ${url}: ${e.message}`);
  }
}

// 流式下载:边下边算 sha256,带停滞超时(120s 无数据即中止,防止挂死)
function downloadFile(url, destPath, { expectedSha256, expectedSize, onProgress } = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await getStream(url);
      const hash = crypto.createHash('sha256');
      let received = 0;
      let idleTimer = setTimeout(() => {
        reqAbort(new Error('download stalled: no data for 120s'));
      }, 120000);
      const reqAbort = (err) => {
        clearTimeout(idleTimer);
        res.destroy();
        try { fs.unlinkSync(destPath); } catch (_) { /* nothing */ }
        reject(err);
      };
      res.on('data', (chunk) => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => reqAbort(new Error('download stalled: no data for 120s')), 120000);
        hash.update(chunk);
        received += chunk.length;
        if (onProgress) onProgress(received);
      });
      const out = fs.createWriteStream(destPath);
      res.pipe(out);
      out.on('error', reqAbort);
      out.on('finish', () => {
        clearTimeout(idleTimer);
        if (expectedSize && received !== expectedSize) {
          return reqAbort(new Error(`size mismatch: expected ${expectedSize}, got ${received}`));
        }
        const sha = hash.digest('hex');
        if (expectedSha256 && sha !== expectedSha256) {
          return reqAbort(new Error(`sha256 mismatch: expected ${expectedSha256}, got ${sha}`));
        }
        resolve({ path: destPath, size: received, sha256: sha });
      });
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { fetchJson, downloadFile };
