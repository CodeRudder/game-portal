# MAP 天下系统实现状态

> **日期**: 2026-05-02
> **总体完成度**: ~85% (核心12流程已实现，R2-R11增强功能待实现)

---

## 已完成

### 文档重构 ✅
- [x] flows.md — 汇总流程文档(960+行)
- [x] FLOW-LIST.md — 流程清单(链接指向flows.md)
- [x] MAP-DEV-PLAN.md — Sprint开发计划(7个Sprint)
- [x] CHECKLIST.md — 开发检查清单(8大模块)
- [x] 文档审计修复(GAP-MAP-08/A/B测试/PRD-R/FIFO)

### 测试修复 ✅
- [x] 修复14个MAP系统测试(领土归属/计数/序列化)
- [x] MAP系统测试: 32 passed / 2 failed(非MAP问题)
- [x] 总体测试: 1423 passed / 4 failed

### 核心引擎 ✅
- [x] WorldMapSystem — 地图数据/区域/地形/地标/视口
- [x] TerritorySystem — 领土归属/产出/升级/相邻
- [x] SiegeSystem — 攻城条件/消耗/执行/每日3次/24h冷却
- [x] GarrisonSystem — 武将驻防/防御加成/产出加成
- [x] SiegeEnhancer — 胜率估算/奖励计算/征服流程
- [x] MapEventSystem — 5种事件/10%触发/选择分支
- [x] MapFilterSystem — 筛选/统计
- [x] MapDataRenderer — 视口/坐标转换/渲染数据
- [x] NPCMapPlacer — NPC地图放置

### UI组件 ✅
- [x] WorldMapTab — 地图主面板(网格/筛选/热力图/气泡)
- [x] TerritoryInfoPanel — 领土详情面板
- [x] SiegeConfirmModal — 攻城确认弹窗
- [x] SiegeResultModal — 攻城结果弹窗

---

## 待实现 (按优先级排序)

### P0 — 核心玩法增强

#### 1. 攻城策略系统 (MAP-F06-02)
**文件**: `engine/map/SiegeSystem.ts` (扩展现有)
**内容**:
- 4种策略: 强攻/围困/夜袭/内应
- 四维差异化: 时间/损耗/前置/特效
- 策略选择UI集成

**实现步骤**:
1. 定义 `SiegeStrategy` 类型和配置
2. 在 `SiegeSystem` 中添加策略参数
3. 修改 `executeSiegeWithResult` 支持策略
4. 添加策略道具校验(夜袭令/内应信)
5. 更新 `SiegeConfirmModal` 显示策略选择

#### 2. 事件战斗分支 (MAP-F09-02)
**文件**: `engine/map/MapEventSystem.ts` (扩展现有)
**内容**:
- 山贼战斗公式(R6修正): 独立战力+兵力参与
- 遗迹探索三档判定(R6/R7修正)
- 装备掉落品质表

**实现步骤**:
1. 添加 `CombatResolver` 工具类
2. 实现山贼战力公式: `max(100, level×100) × 难度系数`
3. 实现胜利损耗公式: `min(35%, max(5%, 20%×F/S))`
4. 实现遗迹三档判定: 失败阈值+部分成功阈值
5. 在 `MapEventSystem.resolveEvent` 中集成战斗/探索

#### 3. 内应信道具系统 (MAP-F06-07)
**文件**: 新建 `engine/map/InsiderLetterSystem.ts`
**内容**:
- 获取: 攻城胜利20%/事件掉落10-25%
- 存储: 背包系统(堆叠上限10)
- 消费: 内应策略扣取
- 暴露冷却: 24h/per-city

**实现步骤**:
1. 定义 `InsiderLetterData` 类型
2. 实现获取逻辑(掉落判定)
3. 实现消费逻辑(扣取+效果)
4. 实现暴露冷却(cooldownManager)
5. 集成到 `SiegeSystem` 内应策略

### P1 — 系统完善

#### 4. 声望衰减系统
**文件**: 新建 `engine/map/ReputationSystem.ts`
**内容**:
- 声望数据: per-faction, 0~100
- 每日衰减: 00:00, -1/阵营
- 豁免条件: 昨日活跃/当日声望事件/声望为0
- 声望效果: 商店折扣/NPC好感

#### 5. 情报值系统
**文件**: 新建 `engine/map/IntelPointsSystem.ts`
**内容**:
- 获取: 山贼快速处理+1
- 上限: dailyLimit=5, maxCap=100
- 兑换: 10点→战斗重试令牌
- 约束: 每次事件处理时实时检查

#### 6. 冷却管理器
**文件**: 新建 `engine/map/CooldownManager.ts`
**内容**:
- 全局单例管理所有冷却状态
- cooldownStateChanged事件驱动
- 10s定时扫描主动检测
- 乐观锁去重+destroy()生命周期

### P2 — 体验优化

#### 7. 离线事件累积 (MAP-F12-01)
- 离线期间事件队列(最多5个)
- 最低价值优先替换策略
- 过期累计衰减(24h→12h→6h→72h上限)
- 快速处理(推荐分支+80%奖励)

#### 8. 产出上限管理增强 (MAP-F01-04)
- 80%预警+百分比显示
- 产出概览面板
- 一键收取(确认+溢出处理+30s冷却)

---

## 实现顺序

```
Sprint 1: 攻城策略系统 (MAP-F06-02)
  → 扩展SiegeSystem → 策略选择UI → 测试

Sprint 2: 事件战斗分支 (MAP-F09-02)
  → CombatResolver → 山贼/遗迹公式 → 测试

Sprint 3: 内应信系统 (MAP-F06-07)
  → InsiderLetterSystem → 获取/消费/冷却 → 测试

Sprint 4: 声望衰减系统
  → ReputationSystem → 衰减/豁免/效果 → 测试

Sprint 5: 情报值系统
  → IntelPointsSystem → 获取/上限/兑换 → 测试

Sprint 6: 冷却管理器
  → CooldownManager → 统一管理/事件驱动 → 测试

Sprint 7: 离线事件+产出管理
  → 离线队列/快速处理/产出概览 → 测试
```

---

*MAP 天下系统实现状态 v1.0 | 2026-05-02*
