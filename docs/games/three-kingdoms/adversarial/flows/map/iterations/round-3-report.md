# Round 3 迭代报告

> **日期**: 2026-05-03
> **迭代周期**: 第3轮 — 架构修复

---

## 1. 改进内容

### 1.1 P0修复: 攻城条件异常默认允许 (Q-04)

**文件**: WorldMapTab.tsx:547

**修复**: `catch { canSiege: true }` → `catch { canSiege: false, errorCode: 'SYSTEM_ERROR' }`

**影响**: 异常时不再默认允许攻城，防止玩家绕过条件检查

### 1.2 P2修复: 存储警告阈值

**文件**: ProductionPanel.tsx:410

**修复**: 阈值从10%提高到80%/小时

**影响**: 只有即将满仓(约1.25小时内)的领土才显示警告

### 1.3 P0修复: 离线系统getter

**文件**: WorldMapTab.tsx:201,355

**修复**: 优先使用`engine.offlineEvents`(地图层OfflineEventSystem)而非`engine.getOfflineEventSystem()`(事件队列系统)

**影响**: 离线奖励弹窗现在能正确触发

### 1.4 P1修复: 核心层反向依赖 (D-01)

**文件**: territory-config.ts, PathfindingSystem.ts, core/map/index.ts

**修复**: 将`deriveAdjacency`和`WalkabilityGrid`从引擎层下沉到核心层，PathfindingSystem重新导出保持向后兼容

**影响**: 核心层不再依赖引擎层，架构分层正确

---

## 2. 测试结果

| 测试套件 | 通过 | 失败 |
|----------|:----:|:----:|
| territory-config.test.ts | 27 | 0 |
| PathfindingSystem.test.ts | 25 | 0 |
| PathfindingSystem.adjacency.test.ts | 16 | 0 |
| SiegeSystem.test.ts | 40 | 0 |
| 全部map面板测试(9文件) | 182 | 0 |
| **总计** | **290** | **0** |

---

## 3. 架构改进总结

### 修复前

```
core/map/territory-config.ts
  └── imports from engine/map/PathfindingSystem  ❌ 核心层依赖引擎层
```

### 修复后

```
core/map/territory-config.ts
  ├── defines WalkabilityGrid type
  └── defines deriveAdjacency function

engine/map/PathfindingSystem.ts
  ├── re-exports WalkabilityGrid from core  (向后兼容)
  └── re-exports deriveAdjacency from core  (向后兼容)
```

---

## 4. 回顾(3轮)

| 指标 | R1 | R2 | R3 | 趋势 |
|------|:--:|:--:|:--:|:----:|
| 测试通过率 | 250/263 | 339/339 | 290/290 | ✅ |
| P0问题 | 3 | 0 | 0 | ✅ |
| 架构问题 | 未评估 | 6严重 | 4严重 | ↓ |
| 功能完成度 | 72.7% | 85% | 90% | ↑ |

### 剩余架构问题

| ID | 问题 | 优先级 |
|----|------|:------:|
| Q-01 | engine?: any类型逃逸 | P2 |
| Q-09 | WorldMapTab上帝组件 | P2 |
| F-02 | 独立eventBus | P2 |
| Q-02 | PixelWorldMap as any | P3 |

---

*Round 3 迭代报告 | 2026-05-03*
