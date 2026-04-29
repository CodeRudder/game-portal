# R02: 引擎核心文件测试覆盖

## 📊 总览

| 指标 | 值 |
|------|-----|
| 新增测试文件 | 11 |
| 新增测试用例 | 135 |
| 全部通过 | ✅ |
| 覆盖源文件 | 11 |
| 执行时间 | ~2.4s |

## 📁 新增测试文件清单

| 测试文件 | 源文件 | 用例数 | 覆盖重点 |
|----------|--------|--------|----------|
| `engine-hero-deps.test.ts` | `engine-hero-deps.ts` | 22 | 资源安全操作、依赖注入、觉醒等级上限 |
| `engine-building-ops.test.ts` | `engine-building-ops.ts` | 10 | 升级检查、执行升级、取消升级、事件发出 |
| `engine-guide-deps.test.ts` | `engine-guide-deps.ts` | 10 | 引导子系统创建/注册/初始化/重置、setStateMachine 注入 |
| `engine-tick.test.ts` | `engine-tick.ts` | 21 | tick 流程、建筑完成、资源产出、加成体系、变化检测 |
| `engine-save-migration.test.ts` | `engine-save-migration.ts` | 15 | 格式转换、往返一致性、旧格式检测 |
| `engine-save.test.ts` | `engine-save.ts` | 14 | 序列化、反序列化、旧格式加载、蓝图修复 |
| `engine-event-deps.test.ts` | `engine-event-deps.ts` | 4 | 事件子系统创建、初始化顺序 |
| `engine-map-deps.test.ts` | `engine-map-deps.ts` | 4 | 地图子系统创建、初始化顺序 |
| `engine-offline-deps.test.ts` | `engine-offline-deps.ts` | 5 | 离线子系统创建/注册/重置 |
| `engine-tech-deps.test.ts` | `engine-tech-deps.ts` | 4 | 科技子系统创建、初始化顺序 |
| `engine-campaign-deps.test.ts` | `engine-campaign-deps.ts` | 23 | 奖励分发、阵容构建、兵种推断、HP计算 |

## 🔍 关键测试场景

### 1. engine-hero-deps.ts — 资源安全操作（P0 级别）
- ✅ `safeSpendResource`: 合法/非法资源类型、余额不足不抛异常
- ✅ `safeCanAfford`: grain 保留量 10、NaN/undefined/Infinity 防御
- ✅ `safeGetAmount`: 非法类型返回 0
- ✅ `initHeroSystems`: 资源回调注入、觉醒武将等级上限 120、突破阶段等级上限

### 2. engine-building-ops.ts — 建筑升级流程（P1 级别）
- ✅ 升级前检查 → 资源消耗 → 启动升级 → 事件发出
- ✅ 不可升级时抛出带原因的错误
- ✅ 取消升级返还 80% 资源（金额为 0 的不调用 addResource）
- ✅ 无升级可取消时返回 null

### 3. engine-guide-deps.ts — 引导系统 setStateMachine bug 回归测试（P0 级别）
- ✅ `setStateMachine` 被正确调用 4 次（StepManager/StoryPlayer/Storage/FirstLaunch）
- ✅ 注入的是 init 后的同一个 TutorialStateMachine 实例
- ✅ 所有 7 个子系统正确注册到 registry
- ✅ reset 调用所有子系统的 reset()

### 4. engine-tick.ts — Tick 循环逻辑（P0 级别）
- ✅ 日历推进 → 建筑计时 → 资源产出 → 武将更新 → 事件更新 → 变化检测
- ✅ 建筑完成时同步产出和上限到资源系统
- ✅ 主城加成 = castleMultiplier - 1
- ✅ 科技加成正确传递
- ✅ 资源/速率变化检测 → 仅在变化时发出事件
- ✅ prevResourcesJson/prevRatesJson 缓存更新

### 5. engine-save*.ts — 存档序列化/迁移（P1 级别）
- ✅ buildSaveData 包含所有核心子系统
- ✅ toIGameState → fromIGameState 往返一致性
- ✅ 可选子系统存在/不存在时的条件包含
- ✅ tryLoadLegacyFormat: 新格式/旧格式/无效JSON/缺少字段
- ✅ applyDeserialize: 反序列化后同步建筑到资源
- ✅ 缺少可选字段时不报错（v1.0→v2.0 迁移兼容）

### 6. engine-campaign-deps.ts — 战斗阵容构建（P1 级别）
- ✅ buildAllyTeam: 编队→BattleUnit 映射、null 槽位跳过、不存在武将跳过
- ✅ buildEnemyTeam: 敌方配置→BattleUnit 映射
- ✅ inferTroopType: 攻击最高→骑兵、智力最高→谋士、速度最高→弓兵
- ✅ HP 计算: 500 + level*100 + defense*10
- ✅ buildRewardDeps: addExp 平均分配、无武将安全、经验不足1跳过

### 7. 依赖注入文件 — 初始化顺序验证
- ✅ event-deps: trigger → notification → uiNotification → chain → log → offline
- ✅ map-deps: worldMap → territory → garrison → siege → siegeEnhancer → mapEvent
- ✅ tech-deps: tree → point → research → fusion → link → offline
- ✅ offline-deps: register 3 个子系统、reset 调用正确方法

## 🐛 测试过程中发现的潜在问题

### 1. (已确认非 Bug) TroopType 是字符串枚举
- `TroopType.CAVALRY = 'CAVALRY'` 而非数字
- 源码中 `inferTroopType` 正确返回字符串枚举值
- 测试已使用 `TroopType.CAVALRY` 等枚举值断言

### 2. (已确认非 Bug) SAVE_KEY = 'three-kingdoms-save'
- 注意是连字符分隔，非驼峰
- 测试已修正

## 📋 未覆盖文件说明

| 文件 | 原因 |
|------|------|
| `engine-extended-deps.ts` | 纯实例化代码（41 个 new），无业务逻辑，测试 ROI 极低 |
| `engine-getters.ts` | Mixin 模式，所有方法都是 `return this.xxx` 的简单 getter，需要完整引擎实例 |
| `engine-getters-types.ts` | 纯类型定义文件 |

## 🏗️ 测试设计原则

1. **最小化 mock**: 仅 mock 接口方法，不使用 `as any`
2. **独立测试**: 每个测试文件独立，不依赖引擎实例
3. **边界条件**: NaN/undefined/Infinity/空字符串/零值
4. **初始化顺序**: 验证依赖注入文件的 init 调用顺序
5. **回归测试**: 特别覆盖 setStateMachine bug 修复场景
