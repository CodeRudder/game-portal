# R7 Builder Manifest — 技术债务修复与系统集成

**验证时间**: 2026-05-04
**验证角色**: Builder
**测试结果**: 75/75 PASS (SiegeBattleSystem 28 tests + SiegeBattleAnimationSystem 47 tests)
**TypeScript编译**: R7相关文件0错误 (修复了1个faction类型收窄问题)

---

## Phase 1: 技术债务修复

| ID | 功能点 | 实现位置 | 测试文件 | 测试结果 | 覆盖场景 |
|----|--------|----------|----------|----------|----------|
| R7-1 | ISubsystem.destroy() 可选方法 | `src/games/three-kingdoms/core/types/subsystem.ts:125` — `destroy?(): void` | 通过 SiegeBattleSystem/AnimationSystem 测试间接验证 | PASS | 接口定义，JSDoc说明"可选：仅当子系统在init中注册了需要清理的资源时才需要实现" |
| R7-2 | SiegeBattleAnimationSystem _initialized 幂等守卫 | `SiegeBattleAnimationSystem.ts:176,193-194` — `private _initialized: boolean = false; if (this._initialized) return;` | `SiegeBattleAnimationSystem.test.ts` | 47/47 PASS | 多次init()不重复注册事件监听 |
| R7-3 | SiegeBattleAnimationSystem unsubscribers 数组 | `SiegeBattleAnimationSystem.ts:179` — `private unsubscribers: Array<() => void> = [];` | `SiegeBattleAnimationSystem.test.ts` | 47/47 PASS | init()中收集 battle:started 和 battle:completed 的取消订阅函数 |
| R7-4 | SiegeBattleAnimationSystem destroy() 方法 | `SiegeBattleAnimationSystem.ts:300-313` — 取消所有事件监听、清除动画数据、重置_initialized | `SiegeBattleAnimationSystem.test.ts` | 47/47 PASS | destroy后事件不再触发；destroy后可重新init() |
| R7-5 | SiegeBattleSystem destroy() 方法 | `SiegeBattleSystem.ts:269-271` — `destroy(): void { this.activeBattles.clear(); }` | `SiegeBattleSystem.test.ts` | 28/28 PASS | destroy清除活跃战斗、释放资源 |
| R7-6 | BattleStartedEvent 扩展 targetX/targetY/faction | `SiegeBattleSystem.ts:101-111` — BattleStartedEvent接口包含 targetX, targetY, faction 字段 | `SiegeBattleSystem.test.ts` | 28/28 PASS | createBattle() emit battle:started 包含完整坐标和阵营信息 |
| R7-7 | BattleStartedEvent faction 类型收窄 | `SiegeBattleSystem.ts:110` — `faction: 'wei' \| 'shu' \| 'wu' \| 'neutral'` | TypeScript编译验证 | PASS (修复后) | TS编译通过，类型安全 |
| R7-8 | SiegeBattleAnimationSystem auto-subscription | `SiegeBattleAnimationSystem.ts:202-217` — init()中订阅 battle:started 自动调用 startSiegeAnimation()，订阅 battle:completed 自动调用 completeSiegeAnimation() | `SiegeBattleAnimationSystem.test.ts` | 47/47 PASS | 事件驱动自动启动/完成动画，使用事件数据中的坐标和阵营 |

## Phase 2: 系统集成

| ID | 功能点 | 实现位置 | 测试文件 | 测试结果 | 覆盖场景 |
|----|--------|----------|----------|----------|----------|
| R7-9 | SiegeBattleSystem 在 useEffect 中创建并 init | `WorldMapTab.tsx:406-408` — `new SiegeBattleSystem(); siegeBattleSystem.init(mockDeps);` | 集成验证（代码审查） | PASS | 与MarchingSystem共享同一eventBus实例 |
| R7-10 | SiegeBattleSystem.update(dt) 在 rAF 循环中调用 | `WorldMapTab.tsx:629` — `siegeBattleSystem.update(dt);` | 集成验证（代码审查） | PASS | 驱动城防衰减，完成时自动emit battle:completed |
| R7-11 | createBattle() 在攻城执行流程中调用 | `WorldMapTab.tsx:462-472` — battleSystem.createBattle() 传入taskId, targetId, troops, strategy, targetX, targetY, faction | 集成验证（代码审查） | PASS | 行军到达后自动触发，emit battle:started -> AnimationSystem自动启动动画 |
| R7-12 | siegeBattleSystem.destroy() 在 cleanup 中调用 | `WorldMapTab.tsx:657-658` — `siegeBattleSystem.destroy(); siegeBattleSystemRef.current = null;` | 集成验证（代码审查） | PASS | 组件卸载时释放资源 |
| R7-13 | SiegeBattleAnimationSystem 与 SiegeBattleSystem 共享 eventBus | `WorldMapTab.tsx:401-408` — 两者使用同一个 mockDeps.eventBus | 集成验证（代码审查） | PASS | battle:started/completed 事件自动传递 |

## Phase 3: Canvas 渲染

| ID | 功能点 | 实现位置 | 测试文件 | 测试结果 | 覆盖场景 |
|----|--------|----------|----------|----------|----------|
| R7-14 | siegeAnimsRef 数据同步 | `PixelWorldMap.tsx:624,899-904` — `siegeAnimsRef.current = activeSiegeAnims` | 代码审查 | PASS | activeSiegeAnims prop变化时同步到ref并触发重绘 |
| R7-15 | renderSiegeAnimationOverlay 函数 | `PixelWorldMap.tsx:1061-1096` — 遍历siegeAnimsRef，按phase分发渲染 | 代码审查 | PASS | 每帧检查，有活跃攻城动画时绘制 |
| R7-16 | 集结阶段 assembly 渲染 | `PixelWorldMap.tsx:291-365` — renderAssemblyPhase(): 围绕城池的闪烁集结点(阵营色)、从外向内汇聚、兵力数字标签 | 代码审查 | PASS | ASSEMBLY_POINT_COUNT=8个点围绕，ASSEMBLY_RADIUS=3瓦片，闪烁间隔200ms |
| R7-17 | 战斗阶段 battle 渲染 | `PixelWorldMap.tsx:375-522` — renderBattlePhase(): 策略特定特效+通用粒子+城防血条 | 代码审查 | PASS | 12个战斗粒子、策略颜色差异、城防HP条实时更新 |
| R7-18 | forceAttack 强攻特效 | `PixelWorldMap.tsx:389-411` — 红色闪光+四方向撞击线 | 代码审查 | PASS | primary=#FF3333, 红色闪光强度sin波动 |
| R7-19 | siege 围困特效 | `PixelWorldMap.tsx:412-431` — 橙色虚线围困圈+旋转标记点 | 代码审查 | PASS | primary=#FF8800, setLineDash虚线 |
| R7-20 | nightRaid 夜袭特效 | `PixelWorldMap.tsx:432-447` — 蓝紫色脉动光+月牙图标 | 代码审查 | PASS | primary=#7744CC, 脉动半径sin变化 |
| R7-21 | insider 内应特效 | `PixelWorldMap.tsx:448-467` — 绿色城门裂缝+向上箭头 | 代码审查 | PASS | primary=#33CC55, 城门逐渐打开进度 |
| R7-22 | 完成阶段 completed 渲染 | `PixelWorldMap.tsx:529-597` — renderCompletedPhase(): 胜利金色旗帜闪烁/失败灰色旗帜+烟雾 | 代码审查 | PASS | 胜利金旗闪烁300ms间隔，失败灰色烟雾上升 |
| R7-23 | 策略颜色差异定义 | `PixelWorldMap.tsx:126-131` — STRATEGY_COLORS: forceAttack红/siege橙/nightRaid紫/insider绿 | 代码审查 | PASS | 每种策略有primary/secondary/glow三色 |

## 修复记录

| 修复项 | 原始问题 | 修复内容 |
|--------|----------|----------|
| R7-FIX-1 | SiegeBattleSystem.ts BattleStartedEvent.faction 类型为 `string`，赋值给 AnimationSystem 的联合类型报 TS2322 | 将 BattleStartedEvent.faction 和 createBattle() params.faction 类型收窄为 `'wei' \| 'shu' \| 'wu' \| 'neutral'` |

## 非R7相关预存TS错误(不在此轮修复范围)

- `PathfindingSystem.ts`: WalkabilityGrid 类型未导出 (5 errors)
- `CooldownManager.ts`: remaining 属性不存在 (1 error)
- `siege-task.types.ts`: 类型定义问题 (1 error)
