# Agent Note: Desktop session grants clipboard writes to the Web GUI origin

Status: implemented

[English](2026-08-29-desktop-clipboard-write-permission.md) | 中文

## Problem

桌面壳的 session 策略曾对所有 Web API 权限请求与检查一律拒绝。Chromium 将 `navigator.clipboard.writeText` 交由 `clipboard-sanitized-write` 权限把关，因此在桌面窗口里，聊天界面的全部复制控件——消息气泡、助手轮次尾部、代码块——都静默失败：共享的 `writeClipboard` 助手只上报拒绝，既无反馈也不回退，剪贴板保持不变。同一批控件在普通浏览器标签页中工作正常，因为 localhost 是安全上下文，剪贴板写入带有隐式授权。

## Decision

`hardenSession` 保持默认拒绝策略，只开一个口子：仅当请求方 origin 与当前 Web Host origin 相等时允许 `clipboard-sanitized-write`。纯判定逻辑位于 `apps/desktop/src/session-permissions.ts`（`grantsDesktopPermission`、`originOfUrl`），`main.ts` 中的 Electron 处理器把 Host supervisor 的实时 origin 传给它，因此授权会跟随 Host 替换迁移到新端口。Host 尚未上报 origin 时，以及对任何其他 origin 或权限——包括剪贴板读取——答案仍是否决。

剪贴板写入只是在用户手势背后把页面已持有的文本放到系统剪贴板上，不暴露渲染进程本来读不到的任何宿主数据。

## Alternatives considered

**保持一刀切拒绝，让复制经由 preload `dshDesktop` 面上的 IPC 桥。** 不予采纳，因为 Web UI 在浏览器和桌面壳中不做区分地运行；为单一调用点引入桥接会按宿主分裂复制路径，并扩大 preload 面。

**在 `writeClipboard` 里当异步 API 拒绝时回退到 `document.execCommand('copy')`。** 不予采纳，因为拒绝是宿主策略信号，该助手刻意如实上报而非掩盖；一个已废弃的回退会在所有宿主上掩盖未来的权限回归，而不只是桌面。

**不带 origin 比较直接授予 `clipboard-sanitized-write`。** 不予采纳，因为该 session 还会渲染恢复页；只有环回 Web GUI origin 拥有这项授权。

## Verification

`apps/desktop/tests/session-permissions.spec.ts` 覆盖：对当前 Host origin 的授予、对其他 origin 与 Host 尚未上报 origin 的拒绝、对来自 Web GUI origin 的剪贴板读取及其他一切权限的拒绝，以及 URL 到 origin 的归约（含不可解析 URL）。

## Consequences

复制控件在桌面窗口中直接可用，Web 客户端无需任何改动。桌面 session 从此会对一种权限作出肯定回答，后续新增权限必须对照默认拒绝立场逐一权衡，而不能再免费继承它。剪贴板读取保持拒绝；产品中没有任何编程式读取剪贴板的路径。
