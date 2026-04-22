# 进化方法索引

## 进化日志
- [Round 1: v1.0评测](./evolution-r1.md) — 建立测试基础设施+技术审查流程
- [Round 2: v2.0招贤纳士](./evolution-r2.md) — 新增即导出+选择器先探后测
- [Round 3: v1.0进化迭代](./evolution-r3.md) — 大文件拆分+门面违规修复+Mixin模式+data-testid规则

## 进化规则
### EVO-001: 提取即删除
代码提取/迁移后，必须立即删除原文件中的重复代码。

### EVO-002: 弹窗独立
所有弹窗组件必须独立为单独文件，使用SharedPanel统一容器。

### EVO-003: 技术审查先行
评测流程：技术审查→修复代码→UI测试→修复UI。

### EVO-004: 测试基础设施优先
在第一个版本评测中建立可复用测试操作库，后续版本直接复用。

### EVO-005: 废弃即清理
每次重构完成后，立即grep验证无引用并删除废弃文件。

### EVO-006: 新增即导出
每次新增引擎文件必须同步更新门面导出(engine/index.ts)。

### EVO-007: 选择器先探后测
测试脚本先做DOM探测确认class名，再编写断言。

### EVO-008: 门面违规检测
技术审查必须包含门面违规检测：`grep -rn "from.*engine/(resource|building|calendar|hero|battle)" src/components/`，发现违规立即修复。

### EVO-009: 文件行数预警
每个版本迭代后检查是否有文件接近500行边界，提前拆分而非等到严重超限。

### EVO-010: Mixin模式用于引擎扩展
引擎主类getter方法通过mixin模式外移到engine-getters.ts，新增子系统getter时添加到engine-getters.ts而非引擎主类。

### EVO-011: UI元素可测试性
新增UI元素必须添加data-testid属性，测试脚本优先使用data-testid定位元素。

### EVO-012: 子任务粒度控制
单个子任务代码变更≤500行，超过500行的拆分任务分多个子任务执行，每个子任务预估时间≤10分钟。

### EVO-013: 截图辅助测试
UI测试应结合截图分析，不能仅依赖DOM文字搜索。资源图标应有aria-label或data-testid辅助测试。

### EVO-014: data-testid强制规则
- 所有新增UI元素必须添加data-testid属性
- 测试脚本优先使用data-testid定位元素
- 技术审查时检查是否有缺少data-testid的关键元素

### EVO-015: 门面违规自动检测
- 技术审查必须包含 `grep -rn "from.*engine/(resource|building|calendar|hero|battle|campaign|tech|npc|event|map|shop|trade|mail|equipment|expedition|pvp|social|alliance|prestige|quest|activity|bond|heritage|guide|settings|responsive|currency|advisor|offline)" src/components/ src/games/three-kingdoms/ui/` 检测
- 发现违规立即修复，并在门面中补充缺失导出

### EVO-016: 子任务粒度控制
- 单个子任务代码变更≤500行
- 超过500行的拆分任务分多个子任务执行
- 每个子任务预估时间≤10分钟

### EVO-017: Mixin模式用于引擎扩展
- 引擎主类getter方法通过mixin模式外移
- 新增子系统getter时添加到engine-getters.ts而非引擎主类

### EVO-018: 子任务拆分粒度（来自v1.0进化R1复盘）
大任务（如文件拆分）必须按文件/模块拆分为多个子任务，每个≤10分钟。
不要把"拆分所有超限文件"放在一个子任务中。

### EVO-019: 测试工具预验证（来自v1.0进化R1复盘）
UI测试前先用简单脚本验证：①DOM选择器是否匹配 ②localStorage key是否正确 ③页面基本结构。
避免测试脚本因工具问题产生大量误报。

### EVO-020: 截图+人工确认（来自v1.0进化R1复盘）
Playwright自动测试结果必须配合截图人工确认。图标化UI不能仅靠文字搜索判断。

### EVO-021: CSS拆分最小成本原则（来自v2.0进化R1）
CSS文件超限时，优先识别并提取独立功能块（如chart样式、animation样式），
而非大规模重构。目标是最小改动达到行数限制要求。

## 测试工具
- game-actions.cjs: 可复用UI测试操作库（13个函数）
- e2e/v1-ui-test.cjs: v1.0 UI测试脚本
- e2e/v1-evolution-ui-test.cjs: v1.0 进化迭代UI测试脚本（30项测试）

### EVO-023: 废弃文件即时清理（来自v3.0进化R1）
技术审查发现废弃文件(bak/目录)时立即清理，不要累积到后续版本。
清理后运行 pnpm run build 确认无引用断裂。
