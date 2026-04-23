# R21 v4.0 P0 Fix Seal — WorldMapSystem.getRegions() 返回4个区域

> **封版时间**: 2025-01-21  
> **严重等级**: P0（核心API返回值错误）  
> **状态**: ✅ 已修复 & 测试通过

---

## 1. 问题描述

`WorldMapSystem.getRegions()` 返回 **4 个区域**（魏/蜀/吴/中立），而测试断言及 PRD 预期为 **3 个区域**（魏/蜀/吴）。

### 测试失败信息

```
Expected: 3
Received: 4
  at Object.<anonymous> (WorldMapSystem.test.ts:145)
```

---

## 2. 根因分析

| 层级 | 数据结构 | 元素数量 | 内容 |
|------|---------|---------|------|
| `RegionId` (类型) | 联合类型 | 4 | `'wei' \| 'shu' \| 'wu' \| 'neutral'` |
| `REGION_IDS` (常量) | readonly array | **3** | `['wei', 'shu', 'wu']` |
| `REGION_DEFS` (常量) | Record | **4** | `{ wei, shu, wu, neutral }` |

**根因**: `getRegions()` 使用 `Object.values(REGION_DEFS)` 遍历，而 `REGION_DEFS` 类型为 `Record<RegionId, RegionDef>`，包含 `neutral` 条目（共4个key）。但 `REGION_IDS` 常量明确只列出3个玩家阵营区域。

`neutral` 是地图上的中立地带（x: 0-9），不是玩家阵营区域，不应被 `getRegions()` 返回。

---

## 3. 修复方案

**策略**: 修改 `getRegions()` 实现，基于 `REGION_IDS` 遍历而非 `Object.values(REGION_DEFS)`。

### 修改文件

`src/games/three-kingdoms/engine/map/WorldMapSystem.ts`

### Diff

```diff
 // 导入新增 REGION_IDS
 import {
   MAP_SIZE,
   VIEWPORT_CONFIG,
+  REGION_IDS,
   REGION_DEFS,
   TERRAIN_DEFS,
   DEFAULT_LANDMARKS,
   ...
 } from '../../core/map';

 // 修复 getRegions 实现
-  /** 获取所有区域定义 */
-  getRegions(): RegionDef[] {
-    return Object.values(REGION_DEFS).map(r => ({ ...r }));
-  }
+  /** 获取所有区域定义（仅魏蜀吴三大区域，不含 neutral） */
+  getRegions(): RegionDef[] {
+    return REGION_IDS.map(id => ({ ...REGION_DEFS[id] }));
+  }
```

### 设计考量

- `REGION_DEFS` 保持不变：其他系统（如 `TerritorySystem`、`MapFilterSystem`）仍需通过 `REGION_DEFS.neutral` 查询中立区域定义
- `REGION_IDS` 作为"玩家阵营区域"的权威列表，语义清晰
- `getRegions()` 方法名暗示"获取区域"，注释和实现现在明确为"三大区域"

---

## 4. 验证结果

### 编译

```
✓ built in 30.02s
```

### 测试 — WorldMapSystem

```
✓ src/games/three-kingdoms/engine/map/__tests__/WorldMapSystem.test.ts  (25 tests) 190ms

 Test Files  1 passed (1)
      Tests  25 passed (25)
```

### 测试 — map-config (core)

```
✓ src/games/three-kingdoms/core/map/__tests__/map-config.test.ts  (53 tests) 310ms

 Test Files  1 passed (1)
      Tests  53 passed (53)
```

### 关键断言验证

| 测试用例 | 预期 | 实际 | 结果 |
|---------|------|------|------|
| `getRegions 返回三个区域` | `length === 3` | `3` | ✅ |
| `getRegions 包含 wei/wu/shu` | `toContain` | ✅ | ✅ |
| `getRegionTileCount 三区域总和 === 总格子数` | 等值 | 等值 | ✅ |

---

## 5. 影响范围

| 文件 | 变更类型 | 影响 |
|------|---------|------|
| `engine/map/WorldMapSystem.ts` | 修改 | `getRegions()` 返回值从4→3 |
| 其他引用 `getRegions()` 的代码 | 无变更 | 下游调用方本就期望3个区域 |

`neutral` 区域定义仍可通过 `REGION_DEFS.neutral` 或 `getRegionAt()` 获取，不影响其他系统。

---

## 6. 封版结论

- [x] P0 bug 已修复
- [x] 编译通过
- [x] 全部 78 个相关测试通过（25 + 53）
- [x] 无回归风险（`neutral` 区域仍可通过其他API访问）
- [x] 代码注释已更新

**结论**: v4.0 可封版发布。
