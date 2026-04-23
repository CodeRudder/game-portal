# 进化文档导航

> **用途**: 纯导航索引，所有详细内容在各子目录中。
> **入口**: [进化规则](../process/evolution-rules.md) | [进化计划](./evo-plans/index.md) | [进化日志](./evo-logs/index.md) | [检查规则](./review-rules/index.md) | [进化知识库](./evo-knowledge/index.md) | [评测工具](./evo-tools/index.md)

## 复盘记录
- [Round 3复盘: P1修复](./progress/evolution-progress-r3.md) — Round 2发现的4个P1问题全部修复，0P0/0P1收官
- [Round 4复盘: ISubsystem+大文件拆分](./evolution-r4-round.md) — ISubsystem覆盖率100%(91/91)+8大文件拆分至0超限+EVO-046~048
- [Round 2全局复盘](./evolution-r11.md) — 20版本完成(14通过/6有条件)+P0:0/P1:~20+GameEventSimulator+门面精简616→138行+EVO-049~052
- [Round 7复盘: P1修复+测试增强](./progress/evolution-progress-r7.md) — EventTriggerSystem增强+calcRebirthMultiplier签名统一+data-testid补全10组件+测试修复16文件+EVO-056~058
- [Round 8复盘: 测试基础设施升级](./progress/evolution-progress-r8.md) — Jest→Vitest迁移261文件2976处替换+data-testid补全22组件+三国6158测试全通过+EVO-059~060
- [Round 9复盘: 全版本审查验证](./progress/evolution-progress-r9.md) — 20版本技术审查+EventTriggerSystem拆分(697→468行)+废弃代码清理+BattleEffectApplier ISubsystem补全
- [Round 10复盘: P2消化+质量扫描](./progress/evolution-progress-r10.md) — social命名修复+StoryEventPlayer拆分(499→331)+exports死代码删除(-202行)+全局质量扫描验证+EVO-061~062
- [Round 11复盘: data-testid全覆盖+死代码清理](./progress/evolution-progress-r11.md) — data-testid 100%覆盖(89/89)+LeaderboardSystem死代码清理(-348行)+EVO-063
- [Round 12复盘: 预防性文件拆分](./progress/evolution-progress-r12.md) — ArenaSystem拆分(499→399)+settings预防性拆分(AnimationController 476→428+AccountSystem 466→429)+EVO-064
- [Round 23复盘: 还债提质](./progress/evolution-progress-r23.md) — 3个P1修复(mail跨层/UP武将描述/每日免费招募)+TODO清零(40→0)+400+行文件拆分(5个)+jest残留清零+as any清零+四项指标全部归零
- [Round 24复盘: v3.0第二轮全局审查](./progress/evolution-progress-r24.md) — 6个测试问题修复(BattleFormationModal选择器/BattleResultModal重复标题/BattleScene防御性检查/AudioController孤儿测试/ArenaSeason断言/quest-config)+200文件5980+用例全通过+封版通过

---

## 核心文档

| 文档 | 路径 | 用途 |
|------|------|------|
| 进化规则 | [process/evolution-rules.md](../process/evolution-rules.md) | 6阶段流程+核心原则 |
| 进化计划 | [evo-plans/index.md](./evo-plans/index.md) | 方向+指标+里程碑 |
| 进化日志 | [evo-logs/index.md](./evo-logs/index.md) | 每轮一行摘要（R1~R20） |
| 检查规则 | [review-rules/index.md](./review-rules/index.md) | 5类37条检查规则 |
| 进化知识库 | [evo-knowledge/index.md](./evo-knowledge/index.md) | EVO-001~058 按类别分文件（不归档） |
| 评测工具 | [evo-tools/index.md](./evo-tools/index.md) | 测试工具/脚本/基础设施索引 |
| 完成记录模板 | [evolution-record-template.md](./evolution-record-template.md) | 每轮记录模板 |
| 用户偏好 | [evolution-user.md](./evolution-user.md) | 用户偏好记录 |

---

## 进化日志（历史详细记录）

- [Round 1: v1.0评测](./evo-logs/evolution-r1.md) — 建立测试基础设施+技术审查流程
- [Round 2: v2.0招贤纳士](./evo-logs/evolution-r2.md) — 新增即导出+选择器先探后测
- [Round 3: v1.0进化迭代](./evo-logs/evolution-r3.md) — 大文件拆分+门面违规修复+Mixin模式+data-testid规则
- [Round 4: v4.0攻城略地(下)](./evo-logs/evolution-r4.md) — ISubsystem同步实现+复杂域拆分+废弃全局扫描+UI警告分类
- [Round 5: v3.0攻城略地-上](./evo-logs/evolution-r5.md) — 技术审查4问题修复+30/30 UI测试通过
- [Round 6: v5.0百家争鸣](./evo-logs/evolution-r6.md) — 0P0+0P1首次零缺陷+62/62 UI测试+四层拆分成熟
- [Round 7: v6.0天下大势](./evo-logs/evolution-r7.md) — P0修复(Event接入引擎+门面补全)+26/26 UI测试+exports-v6拆分策略
- [Round 8: v8.0](./evo-logs/evolution-r8.md) — 商贸/离线评测
- [Round 9: v9.0](./evo-logs/evolution-r9.md) — 科技/策略评测
- [Round 10: v2.0](./evo-logs/evolution-r10.md) — 引导overlay障碍，CSS选择器策略
- [Round 11: 全局复盘](./evo-logs/evolution-r11.md) — 20版本完成+GES创建+EVO-049~052
- [Round 17: v17.0](./evo-logs/evolution-r17.md) — 移动端适配375-768px
- [Round 18: v18.0](./evo-logs/evolution-r18.md) — 新手引导+EVO-036~038
- [Round 19: v19.0](./evo-logs/evolution-r19.md) — 合并冲突+重叠治理+23/23 UI
- [Round 20: v20.0](./evo-logs/evolution-r20.md) — 全链路+数值5维+项目收官

---

## 测试工具

> 详见 [评测工具索引](./evo-tools/index.md) — E2E脚本/事件模拟器/UI提取器/UI审查器/测试工具库

---

*文档版本: v5.2 | 更新日期: 2026-04-24 | 新增 R24 复盘（v3.0第二轮全局审查）*

---

## 进化规则追加（EVO-059~076）

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

### EVO-064: 预防性拆分阈值（来自Round 12复盘）
引擎文件超过450行时触发预防性分析，超过480行时强制拆分。
分析时优先提取纯函数/纯逻辑，不破坏类内聚性。
拆分策略:
1. 优先提取常量、工厂函数、纯辅助函数到 .helpers.ts 文件
2. 优先提取配置/默认值到 -defaults.ts 文件
3. 优先提取独立流程到独立模块（如 account-delete-flow.ts）
检查方法: `find src/ -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -20`
范例: Round 12 拆分 ArenaSystem(499→399)+AnimationController(476→428)+AccountSystem(466→429)。

### EVO-073: 测试文件门面一致性（来自Round 22复盘）
测试文件应通过域的 `index.ts` 门面导入类型和常量，避免直接引用内部文件。
新增测试文件时 lint 检查 `from.*engine/[^i]` 模式。
检查方法: `grep -rn "from.*engine/[^i]" src/ --include="*.test.*"`
范例: R22 hero域测试中2处直接引用 hero.types 绕过门面。

### EVO-074: 域文件行数预警线（来自Round 22复盘）
单个域文件不超过480行（留20行缓冲），超过时触发拆分预警。
CSS文件同样适用此规则，动画关键帧可拆分为独立 -anim.css 文件。
检查方法: `find src/ -name "*.ts" -o -name "*.tsx" -o -name "*.css" | xargs wc -l | sort -rn | head -20`
范例: HeroLevelSystem.ts（477行）+ HeroStarUpModal.css（489行）均逼近上限。

### EVO-075: 新域测试覆盖密度（来自Round 22复盘）
新增域的测试用例数应 ≥ 源码行数 × 0.15。
测试文件与源码文件比应 ≥ 1.5:1。
范例: hero域 3,362行 × 0.15 = 504，实际474，覆盖率 94%。

### EVO-076: P0降级双人确认（来自Round 22复盘）
P0降级为P1需要架构师+产品经理双人确认。
确认内容：影响范围评估 + 替代方案 + 修复时间线。
范例: R22 中2个P0降级为P1，缺乏量化标准，后续建立三门槛：影响<5%用户+有替代路径+下轮可修复。

### EVO-077: 跨层引用检测（来自Round 23复盘）
核心层(core/)不得引用引擎层(engine/)，共享定义提取到shared/层。
跨层引用的共享类型必须在shared/目录中定义唯一来源，消除反向依赖。
检查方法: `grep -rn "from.*engine/" src/games/three-kingdoms/core/ --include="*.ts"`
范例: R23 中 mail.types.ts 被渲染层和引擎层同时引用，提取到 shared/mail-types.ts 解决。

### EVO-078: TODO零容忍（来自Round 23复盘）
生产代码TODO上限为0，必须标注版本号或直接实现。
发现TODO时：要么标注计划版本号（如 `// TODO(R25): ...`），要么立即实现。
检查方法: `grep -rn "TODO" src/games/three-kingdoms/ --include="*.ts" --include="*.tsx" | grep -v ".test." | grep -v ".spec."`
范例: R23 一次性清零40个TODO，渲染层+生产代码全部归零。

### EVO-079: as any精确类型替代（来自Round 23复盘）
禁止使用 `as any`，应定义 interface 或使用 `unknown` + 类型守卫。
每个 `as any` 的成因不同，需要理解上下文后设计正确的类型方案，无法批量处理。
检查方法: `grep -rn "as any" src/games/three-kingdoms/ --include="*.ts" | grep -v ".test." | grep -v ".spec."`
范例: R23 中 NPCPatrolSystem 和 GameEventSimulator 的 as any 通过定义 INPCSystemFacade 等精确接口替代。

### R24 — v3.0 攻城略地(上) 第二轮全局审查
- 日期: 2026-04-24
- 修复: 6个问题(BattleFormationModal×5+BattleResultModal×3+BattleScene×4+AudioController删除+ArenaSeason断言+quest-config)
- 封版: ✅ 通过 (P0=0, P1=0)

### R25 — v4.0 攻城略地(下) 第二轮全局审查
- 日期: 2026-04-24
- 修复: P0×2(升星战力系数+战斗碎片产出) + UI组件×3(SweepModal/SweepPanel/BattleSpeedControl CSS)
- 测试: 222文件/6579用例全通过 + UI面板21文件/357用例全通过
- 质量: as any=0, 超500行=0, jest残留=0, TODO=0, deprecated=0
- 覆盖率: 74.5% (38/51功能点)
- 遗留: P1×3(领土techPoint/离线推图/离线挂机) + P2×6(地图系统) + Expedition面板无测试
- 封版: ✅ 有条件通过
- 经验: LL-R25-01~04(战力公式全维度/引擎基础奖励/跨系统串联必做/UI测试同步创建)

### R26 — v5.0 世界探索(上) 第二轮全局审查
- 日期: 2026-04-24
- 修复: 8个测试修复 + 1个ISubsystem补全 + 11个日志/断言统一
- 测试: 266文件/7957用例, 7884通过(99.1%), 9失败(已有遗留)
- 质量: as any=0, 超500行=1, jest=31(仅测试), TODO=0, deprecated=0, ISubsystem=123
- 封版: ✅ 通过 (P0=0, P1=0)
- 经验: LL-R26-01~05(枚举同步/ISubsystem覆盖/便捷属性/日志统一/排序稳定性)
