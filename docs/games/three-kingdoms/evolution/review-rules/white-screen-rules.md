# 白屏防护检查规则

> **来源**: EVO-065~EVO-072，从 evolution-rules.md 抽取。
> **进化**: 每轮评测发现新的白屏/崩溃模式时，新增规则到此文件。

---

## P0 规则

### WS-01: 白屏零容忍
- **触发**: `<div id="root">` 无内容
- **检查**: 每次提交前必须通过白屏检查
- **要求**: 所有UI组件 try-catch 防御；ErrorBoundary 包裹主组件；禁止未防御的 `Object.values(null/undefined)`
- **来源**: EVO-065

### WS-02: ErrorBoundary 强制包裹
- **触发**: 游戏主组件无 ErrorBoundary
- **检查**: 技术审查确认覆盖
- **要求**: 引擎崩溃时显示错误信息页而非白屏
- **来源**: EVO-068

### WS-03: 引擎构造安全
- **触发**: ThreeKingdomsEngine 裸构造（无 try/catch）
- **检查**: 代码审查确认
- **要求**: 构造失败进入安全降级UI
- **来源**: EVO-069

### WS-04: getState() 返回类型安全
- **触发**: getState() 返回 unknown 或缺少字段
- **检查**: TypeScript 类型检查
- **要求**: 返回完整默认状态，默认状态能安全传入所有方法
- **来源**: EVO-066

### WS-05: UI 防御性编程
- **触发**: 引擎数据未做空值守卫导致渲染崩溃
- **检查**: 代码审查 + UI测试
- **要求**: 从引擎获取数据做空值守卫；Object.values/keys 前确保非 null/undefined；子组件渲染失败不导致父组件白屏
- **来源**: EVO-067

---

## P1 规则

### WS-06: 存档损坏容错
- **触发**: localStorage 存档损坏
- **检查**: 引擎 load() 操作时
- **要求**: try/catch 包裹读取，损坏数据自动清除并提示用户
- **来源**: EVO-070

### WS-07: 构建产物完整
- **触发**: pnpm build 后游戏不可用
- **检查**: 每次进化迭代结束
- **要求**: build 成功 + 游戏入口 JS chunk > 0 bytes
- **来源**: EVO-071

### WS-08: 基本功能可用性
- **触发**: 封版时基础功能异常
- **检查**: 每次封版测评
- **要求**: 页面加载、引擎初始化、资源栏显示、Tab切换 4项全部正常
- **来源**: EVO-072

---

## 检查命令

```bash
# WS-01 白屏检查
npx playwright test e2e/whitescreen-guard.spec.ts

# WS-04 类型安全检查
npx tsc --noEmit

# WS-07 构建产物检查
pnpm run build && ls -la dist/assets/*game*.js

# WS-08 基本功能检查
# 启动 dev-server → 手动或自动化验证4项
```

---

## 进化记录

| 日期 | 变更 | 来源 |
|------|------|------|
| 2026-04-23 | 从 evolution-rules.md 抽取 EVO-065~072 | 文档重构 |
