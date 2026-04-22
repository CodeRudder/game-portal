# 进化方法 R10 — v2.0 R2 进化迭代总结

## 日期: 2026-04-23
## 基于: evolution-r9.md

---

## 一、v2.0 R2 进化方法修订

### EVO-R10-001: 引导遮罩是UI测试首要障碍
- **问题**: GuideOverlay默认开启，遮挡所有交互元素
- **方案**: 测试脚本前置步骤必须包含引导Skip和DOM移除
- **规则**: 
  1. 页面加载后先 `.tk-guide-btn--skip` 跳过引导
  2. `document.querySelectorAll('.tk-guide-overlay').forEach(el => el.remove())`
  3. 等待300ms
- **状态**: ✅ 已实施

### EVO-R10-002: CSS class选择器优于文本匹配
- **问题**: 按钮文本包含emoji前缀（如"🏛️ 招募"），文本匹配不稳定
- **方案**: 优先使用 `.tk-hero-*` 前缀的CSS class选择器
- **选择器优先级**: .class > [data-testid] > :has-text() > 精确文本
- **状态**: ✅ 已实施

### EVO-R10-003: 技术审查必须包含上轮修复验证
- **问题**: R1→R2缺乏系统化的修复验证
- **方案**: 技术审查报告模板增加"R(N-1)问题修复状态"对比表
- **状态**: ✅ 已实施

### EVO-R10-004: Play文档增加前置条件字段
- **问题**: Play文档假设已有数据，未考虑空状态路径
- **方案**: 每个流程增加"前置条件"说明（如"需先招募至少1个武将"）
- **状态**: ✅ 已实施

### EVO-R10-005: 测试结果三级分类
- **问题**: 警告项和失败项混淆
- **方案**: 测试结果严格分为 passed/failed/warning 三级
  - passed: 断言成功
  - failed: 断言失败（阻塞）
  - warning: 非阻塞观察项（需人工确认）
- **状态**: ✅ 已实施

---

## 二、v2.0 R2 执行日志

### 执行时间线
1. **步骤1** (3min): 编写v2.0 Play文档（7大模块/17个流程/6个交叉验证）
2. **步骤2** (5min): UI测试（12通过/0失败/4警告，6张截图）
3. **步骤3** (3min): 技术审查（0个P0，R1的P0已修复）
4. **步骤4** (2min): 复盘+提交

### 关键发现
- R1的1个P0问题（HeroDetailModal.css超限）已修复：513→388行
- BondSystem重复实现已合并，仅剩engine/bond/BondSystem.ts
- HeroFormation已实现ISubsystem接口
- UI测试100%通过率（12/12）
- 生产代码DDD门面合规100%

### 产出文件
| 文件 | 说明 |
|------|------|
| docs/games/three-kingdoms/play/v2-play.md | v2.0 Play文档（17个流程） |
| e2e/v2-r2-test.cjs | v2.0 R2 UI测试脚本 |
| e2e/screenshots/v2-r2/*.png | 6张测试截图 |
| e2e/e2e-v2-r2-results.json | 测试结果JSON |
| docs/games/three-kingdoms/tech-reviews/v2.0-review-r2.md | 技术审查R2 |
| docs/games/three-kingdoms/lessons/v2.0-lessons-r2.md | 复盘经验教训R2 |
| docs/games/three-kingdoms/evolution/evolution-r10.md | 进化方法R10 |
