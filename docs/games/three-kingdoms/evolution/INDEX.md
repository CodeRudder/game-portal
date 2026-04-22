# 进化方法索引

## 进化日志
- [Round 1: v1.0评测](./evolution-r1.md) — 建立测试基础设施+技术审查流程
- [Round 2: v2.0招贤纳士](./evolution-r2.md) — 新增即导出+选择器先探后测
- [Round 3: v1.0进化迭代](./evolution-r3.md) — 大文件拆分+门面违规修复+Mixin模式+data-testid规则
- [Round 4: v4.0攻城略地(下)](./evolution-r4.md) — ISubsystem同步实现+复杂域拆分+废弃全局扫描+UI警告分类
- [Round 5: v3.0攻城略地-上](./evolution-r5.md) — 技术审查4问题修复+30/30 UI测试通过
- [Round 6: v5.0百家争鸣](./evolution-r6.md) — 0P0+0P1首次零缺陷+62/62 UI测试+四层拆分成熟
- [Round 7: v6.0天下大势](./evolution-r7.md) — P0修复(Event接入引擎+门面补全)+26/26 UI测试+exports-v6拆分策略
- [Round 3复盘: P1修复](./progress/evolution-progress-r3.md) — Round 2发现的4个P1问题全部修复，0P0/0P1收官
- [Round 19: v19.0天下一统(上)](./evolution-r19.md) — 合并冲突修复+双目录重叠治理+引擎API冒烟测试+23/23 UI通过
- [Round 20: v20.0天下一统(下)](./evolution-r20.md) — 全链路联调验证+数值平衡5维审查+性能优化三件套+17/17 UI通过+项目收官
- [v11.0 R2: 群雄逐鹿进化迭代](../tech-reviews/v11.0-review-r2.md) — Play文档7流程+技术审查P0:0/P1:6/P2:5+3条经验教训
- [Round 4复盘: ISubsystem+大文件拆分](./evolution-r4-round.md) — ISubsystem覆盖率100%(91/91)+8大文件拆分至0超限+EVO-046~048
- [Round 2全局复盘](./evolution-r11.md) — 20版本完成(14通过/6有条件)+P0:0/P1:~20+GameEventSimulator+门面精简616→138行+EVO-049~052
- [Round 7复盘: P1修复+测试增强](./progress/evolution-progress-r7.md) — GameEventSimulator修复+calcRebirthMultiplier签名统一+data-testid补全6组件+三国测试24→0失败+EVO-056~058
- [Round 8复盘: 测试基础设施升级](./progress/evolution-progress-r8.md) — Jest→Vitest迁移261文件2976处替换+data-testid补全22组件+三国6158测试全通过+EVO-059~060
- [Round 9复盘: 全版本审查验证](./progress/evolution-progress-r9.md) — 20版本技术审查+EventTriggerSystem拆分(697→468行)+废弃代码清理+BattleEffectApplier ISubsystem补全
- [Round 10复盘: P2消化+质量扫描](./progress/evolution-progress-r10.md) — social命名修复+StoryEventPlayer拆分(499→331)+exports死代码删除(-202行)+全局质量扫描验证+EVO-061~062
- [Round 11复盘: data-testid全覆盖+死代码清理](./progress/evolution-progress-r11.md) — data-testid 100%覆盖(89/89)+LeaderboardSystem死代码清理(-348行)+EVO-063

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

### EVO-024: 复杂域四层拆分模式（来自v4.0进化R1）
子系统数量>5的复杂功能域，必须按"数据管理/流程控制/效果计算/辅助功能"四层拆分。
科技系统(TechTreeSystem+TechResearchSystem+TechEffectSystem+TechOfflineSystem)是范例。

### EVO-025: ISubsystem同步实现（来自v4.0进化R1）
新增子系统时必须同步实现ISubsystem接口，不应留到进化迭代修复。
技术审查中ISubsystem实现率应作为必检项，目标100%。

### EVO-026: 废弃目录全局扫描（来自v4.0进化R1）
每次重构后执行 `find . -name "bak" -type d` 全局扫描废弃目录。
不同域可能独立存在bak/目录，仅清理当前工作域不够。

### EVO-027: 域内子系统命名统一（来自v4.0进化R1）
同一域的子系统命名遵循 `{Domain}{Function}System` 模式。
如科技域：TechTreeSystem, TechResearchSystem, TechPointSystem, TechEffectSystem。

### EVO-028: UI测试警告分类（来自v4.0进化R1）
UI测试警告应分为两类：
- "数据依赖型"：初始状态无数据导致（如无武将、无已通关关卡），可忽略
- "功能缺失型"：功能未实现或实现有误，需修复
测试报告中应明确标注警告类型。

### EVO-029: 搜索后DOM刷新（来自v6.0进化R1）
E2E测试中搜索清空后必须重新获取DOM元素引用，旧引用会因React重渲染而失效。
不要在搜索操作后继续使用搜索前获取的元素引用。

### EVO-030: 子系统接入检查清单（来自v6.0进化R1）
新增子系统接入引擎时必须检查以下6项：
1. createXxxSystems() 在构造函数中调用
2. registerSubsystems() 中注册到 registry
3. init() 中调用 initXxxSystems()
4. reset() 中调用各子系统 reset()
5. engine-getters.ts 中添加 getter
6. exports门面导出（engine/index.ts 或拆分文件）

### EVO-031: 不能跳过迭代进化流程的任何环节，特别是UI测试。
反模式：第2轮进化v1版本功能时跳过UI测试。

### EVO-032: 主界面不必要的动画效果，如资源增加的CSS脉冲动画。

### EVO-033~035: (预留编号)

### EVO-036: 子系统注册必检清单（来自v18.0进化R18）
新增子系统代码审查时，必须逐项检查EVO-030的6项接入清单。
建议在PR模板中增加"子系统接入检查"勾选项，防止遗漏注册。

### EVO-037: 门面检测模式同步更新（来自v18.0进化R18）
每次新增engine/子目录时，同步更新EVO-015的门面检测grep模式。
新增目录后立即运行门面违规检测，确认无遗漏。

### EVO-038: 引导测试采用状态注入模式（来自v18.0进化R18）
引导系统UI测试不依赖逐步触发，而是直接通过引擎API设置引导进度到目标步骤。
测试脚本前置步骤：`engine.guide.setProgress(stepNumber)` 跳过前置步骤。

### EVO-039: 合并冲突标记CI检测（来自v19.0进化R19）
CI流程或pre-commit hook中增加 `grep -rn "<<<<<<" src/` 检测。
发现冲突标记立即阻断构建，防止合入主分支。
合并代码后必须执行 `pnpm run build` 确认编译通过。

### EVO-040: 子系统重叠迁移策略（来自v19.0进化R19）
当新旧子系统并存时，必须：
1. 在README或ARCHITECTURE文档中标注"推荐使用"的版本
2. 旧版本文件头部添加 `@deprecated` 注释
3. 设定迁移截止版本号，到期后删除旧版本
4. 不在两个版本中同时添加新功能

### EVO-041: 引擎API冒烟测试（来自v19.0进化R19）
每个版本的UI测试必须包含引擎API验证环节：
- 动态import engine/index.ts 确认模块可加载
- 逐个检查新增子系统是否正确导出
- 验证子系统类可实例化（无构造函数错误）
- 作为UI测试的"测试0"最先执行

### EVO-042: 收官版本全链路验证（来自v20.0进化R20）
项目收官版本必须实现端到端全链路验证：
- 从初始状态到终局玩法的完整游戏循环
- 跨系统数据流验证（资源→建筑→武将→战斗→转生→声望）
- 数值平衡的自动化验证（5维度：资源/战力/难度/经济/倍率）
- 全链路验证结果生成综合报告

### EVO-043: 性能监控先行原则（来自v20.0进化R20）
性能相关开发遵循"监控先行"原则：
1. 先写PerformanceMonitor（知道当前性能基线）
2. 再写ObjectPool/DirtyRectManager（针对性优化）
3. 最后验证优化效果（对比监控数据）
不要在没有监控数据的情况下盲目优化。

### EVO-044: 条件性UI测试策略（来自v20.0进化R20）
条件性UI（需解锁/需前置条件）的测试三层策略：
1. 引擎层：单元测试覆盖完整逻辑（不受UI条件限制）
2. UI层入口：测试条件显示/隐藏的切换逻辑
3. 集成层：通过状态注入（engine API直接设置状态）跳过条件验证完整流程

### EVO-045: 交互规范代码化（来自v20.0进化R20）
交互规范不应只停留在文档中，应转化为可执行的审查器：
- InteractionAuditor 检查按钮/面板/弹窗/列表的交互一致性
- VisualConsistencyChecker 检查配色/字体/间距的视觉一致性
- AnimationAuditor 检查动画时长/缓动函数的规范合规性
每个新增UI组件都应通过三类审查器的规则检查。

### EVO-046: ISubsystem同步实现（来自Round 4复盘）
ISubsystem接口必须在新System类创建时同步实现，覆盖率目标100%。
技术审查中ISubsystem实现率应作为必检项。
检查方法: `grep -rn "implements ISubsystem" src/games/three-kingdoms/engine/`

### EVO-047: 文件行数400行预警（来自Round 4复盘）
文件行数预警线设为400行，超过400行时主动拆分，不再等到500行才被动处理。
预警阈值: 400行 | 硬限制: 500行
检查方法: `find src/ -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -20`

### EVO-048: core层聚合导出模式（来自Round 4复盘）
core层配置/模板文件按功能域拆分，主文件作为聚合导出(re-export)。
范例: encounter-templates.ts按章节拆分4个子文件，主文件仅做聚合导出(139行)。

### EVO-049: 按DDD业务域导出，禁止按版本号（来自Round 2全局复盘）
门面导出文件按业务域命名(如 `exports-pvp.ts`, `exports-social.ts`)。
禁止使用 `exports-vN` 按版本号导出。
残留文件(exports-v9.ts, exports-v12.ts)需清理。
检查方法: `find src/ -name "exports-v*" -type f`

### EVO-050: GameEventSimulator用于模拟游戏事件（来自Round 2全局复盘）
使用 `test-utils/GameEventSimulator.ts`(411行)模拟触发游戏事件。
配套测试357行，覆盖核心事件场景。
后续版本UI测试可复用此工具，避免手动触发复杂事件链。

### EVO-051: 每版本4步流水线（来自Round 2全局复盘）
标准进化流程: Play文档 → UI测试 → 技术审查 → 复盘。
- Play文档: 5~7章节覆盖核心功能流程
- 技术审查: P0/P1/P2分级 + ISubsystem合规 + DDD违规检测
- 复盘: 经验教训提取 + 进化规则沉淀
不得跳过任何环节(EVO-031强化)。

### EVO-052: 双系统重叠治理清单（来自Round 2全局复盘）
Round 2发现6对重叠系统，Round 3必须逐一治理：
1. TouchInputSystem / TouchInteractionSystem → 合并统一触控
2. EventTriggerSystem / EventTriggerEngine → 合并触发逻辑
3. ChainEventSystem / ChainEventSystemV15 → 保留V15删除旧版
4. RankingSystem / LeaderboardSystem → 统一排行榜接口
5. EquipmentGenerator / EquipmentGenHelper → 合并单一生成器
6. RebirthSystem / RebirthSystemV16 → 保留V16删除旧版
治理时遵循EVO-040重叠迁移策略。

### EVO-053: 死代码清理规则（来自Round 6复盘）
当新旧实现并存时，@deprecated标记后必须在下一轮完成删除。
不得长期保留已废弃的Engine/Manager/Service文件。
删除前必须确认零外部引用（grep验证），确保破坏性为零。
范例: Round 6删除6个EventEngine文件(~2550行)，零破坏性。

### EVO-054: as any 零容忍（来自Round 6复盘）
引擎层(engine/)不允许新增 `as any` 类型断言。
已有的 `as any` 必须在发现后2轮内消除，修复方式优先级：
1. 扩展接口定义（如添加缺失字段）
2. 利用已有泛型/联合类型（如IEventBus.emit的payload参数）
3. 精确类型断言（如 `as SetId` 替代 `as any`）
4. 全局类型扩展（如 navigator.d.ts）
检查方法: `grep -rn "as any" src/engine/`

### EVO-055: 模块命名一致性（来自Round 6复盘）
版本功能模块命名必须与实际目录一致：
- v5.0 policy → 实际在 engine/tech/（策略/科技）
- v10.0 military → 实际在 engine/equipment/（装备）
审查报告需注明实际目录路径，避免按版本号臆测功能位置。
发现命名不一致时，以实际目录为准更新文档。

### EVO-056: 测试资源预置规则（来自Round 7复盘）
测试工具方法（如 upgradeBuildingToWithHighCaps）在每次迭代操作前必须确保资源充足，不能假设前一次操作后资源仍有余量。
范例: GameEventSimulator.upgradeBuildingToWithHighCaps 每次升级前补充资源（grain:10M + gold:20M + troops:5M）。
违反后果: 连续升级操作因资源耗尽而失败，产生误报。

### EVO-057: 签名冲突优先级（来自Round 7复盘）
当同一功能在多个模块有不同签名时，以参数更完整、更可测试的版本为权威，其他版本改为薄封装器。
权威版本: unification/BalanceCalculator.calcRebirthMultiplier（接受 config 参数）
委托版本: prestige/RebirthSystem（单参数，委托权威版本）
禁止两个模块各自独立实现相同逻辑（逻辑分叉风险）。

### EVO-058: 空壳验证规则（来自Round 7复盘）
标记为"空壳"的方法必须在修复前验证是否已有实现，避免基于过时文档做无效修改。
验证方法: 直接阅读源码确认方法体是否为空。
范例: EventTriggerSystem.calculateProbability 和 evaluateCondition 在 R6 重构方案中被标记为空壳，实际已有完整实现。

### EVO-059: 测试框架统一（来自Round 8复盘）
所有测试文件必须使用 vitest API（vi.fn / vi.mock / vi.spyOn / vi.advanceTimersByTime），禁止使用 jest API。
批量迁移时使用 `sed -i 's/jest\.fn/vi.fn/g'` 等模式替换，替换后必须添加 `import { vi } from 'vitest'`。
检查方法: `grep -rn "jest\.\(fn\|mock\|spyOn\|advanceTimersByTime\)" src/ --include="*.test.*"`
发现残留 jest API 时立即替换为对应 vitest API。

### EVO-060: 批量替换安全模式（来自Round 8复盘）
批量 sed 替换后必须执行三步验证：
1. 编译验证: `pnpm run build` 确认无构建错误
2. 目标模块测试: `pnpm vitest run src/games/three-kingdoms/` 确认核心测试全通过
3. 全局回归: `pnpm vitest run` 确认无连锁破坏
替换前建议在单个文件上试跑，确认替换模式无误后再批量执行。
范例: Round 8 迁移 261 文件 2976 处替换，三国 6158 测试全部通过。

### EVO-061: 命名一致性（来自Round 10复盘）
以 Subsystem 结尾的类必须实现 ISubsystem 接口（含 init/reset 生命周期方法）。
纯工具类（无状态、无生命周期）应使用 Helper 后缀，不得使用 Subsystem 命名。
检查方法: `grep -rn "class.*Subsystem" src/ --include="*.ts" | grep -v "implements ISubsystem"`
发现违规时立即重命名（Subsystem→Helper）并更新所有引用。
范例: Round 10 将 FriendInteractionSubsystem/BorrowHeroSubsystem 重命名为 Helper。

### EVO-062: 孤立文件定期清理（来自Round 10复盘）
每轮进化末尾执行孤立文件扫描，识别并删除无引用文件：
1. 扫描方法: 对非 index.ts 文件执行 `grep -rn "import.*{filename}" src/` 检查引用
2. 零引用文件确认后删除，删除前运行 `pnpm run build` 验证
3. 重点关注: exports-v*.ts 残留、bak/ 目录、废弃版本文件
范例: Round 10 删除 exports-v9.ts(88行) + exports-v12.ts(114行) = 202行死代码。

### EVO-063: data-testid 完备性要求（来自Round 11复盘）
所有 UI 组件(.tsx)必须有 data-testid 属性，新建组件必须同步添加。
命名规范: kebab-case（如 `data-testid="hero-panel"`）。
覆盖率目标: 100%。
检查方法: `grep -rL "data-testid" src/ --include="*.tsx" | grep -v node_modules`
范例: Round 11 补全21个组件，覆盖率从76.4%提升至100%(89/89)。

