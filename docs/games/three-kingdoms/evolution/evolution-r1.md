# 进化日志 R1 — v1.0基业初立

## 日期
2026-04-22

## 进化内容

### 1. 建立测试基础设施
- 创建 game-actions.cjs 可复用操作库（13个函数）
- 支持：initBrowser, enterGame, switchTab, openBuildingModal, closeAllModals, takeScreenshot, checkDataIntegrity, checkLayout, switchToMobile, switchToPC, getConsoleErrors, clearConsoleErrors

### 2. 确立技术审查流程
- 按DDD四层架构审查代码
- 检查项：行数限制、单一职责、DRY原则、跨域引用
- 生成结构化审查报告（tech-reviews/目录）

### 3. 发现的流程改进机会
- 编译验证应使用 pnpm run build（而非仅 tsc --noEmit）
- 废弃文件清理应纳入标准流程
- 弹窗独立应作为代码规范

### 4. 进化规则新增
- EVO-001: 提取即删除
- EVO-002: 弹窗独立
- EVO-003: 技术审查先行
- EVO-004: 测试基础设施优先
- EVO-005: 废弃即清理

## 下一步进化方向
- v2.0评测时需要扩展game-actions支持武将相关操作
- 考虑引入UITreeExtractor进行更深入的DOM分析
- 考虑非无头模式支持调试
