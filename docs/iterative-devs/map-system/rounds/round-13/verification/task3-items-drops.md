# Round 13 Task 3 — 内应信掉落(I7) + 攻城策略道具(I8)

## 实现摘要

### I7: 内应信掉落逻辑

**文件**: `src/games/three-kingdoms/engine/map/SiegeItemSystem.ts`

- 确定性随机种子函数 `hashCode(str)` — djb2算法，输出非负整数
- 掉落判定函数 `shouldDropInsiderLetter(taskId)` — `hashCode(taskId) % 100 < 20` 即为掉落
- 基于taskId的hash保证同一任务ID始终返回相同结果（可测试、可复现）
- 20%掉落概率符合设计要求

### I8: 攻城策略道具系统

**文件**: `src/games/three-kingdoms/engine/map/SiegeItemSystem.ts`

- 道具类型: `SiegeItemType = 'nightRaid' | 'insiderLetter' | 'siegeManual'`
- 数据结构: `SiegeItem { type, count }`
- `SiegeItemSystem` 类提供:
  - `getInventory()` — 获取完整背包
  - `getCount(type)` — 获取指定道具数量
  - `hasItem(type)` — 是否持有
  - `acquireItem(type, source, amount?)` — 获取道具，来源: `'shop' | 'drop' | 'daily'`
  - `consumeItem(type, amount?)` — 消费道具
  - `serialize() / deserialize()` — 序列化支持
  - `reset()` — 重置
- 堆叠上限: nightRaid=10, insiderLetter=10, siegeManual=5

### 测试覆盖

**文件**: `src/games/three-kingdoms/engine/map/__tests__/SiegeReward.drop.test.ts`

**17个测试全部通过** (执行时间 2ms):

| # | 测试用例 | 结果 |
|---|---------|------|
| 1 | 固定种子100次调用结果一致 | PASS |
| 2 | 不同种子产生不同结果 | PASS |
| 3 | 100个任务掉落数大致符合20% | PASS |
| 4 | hashCode输出稳定且非负 | PASS |
| 5 | hashCode不同字符串产生不同值 | PASS |
| 6 | 初始状态无道具hasItem=false | PASS |
| 7 | acquireItem后hasItem=true | PASS |
| 8 | consumeItem后count减少 | PASS |
| 9 | consumeItem count=0不可消耗 | PASS |
| 10 | 多次攻城掉落独立无状态污染 | PASS |
| 11 | 堆叠上限到达后acquireItem返回false | PASS |
| 12 | getInventory返回所有道具类型 | PASS |
| 13 | serialize/deserialize完整状态 | PASS |
| 14 | 不同来源获取计入totalAcquired | PASS |
| 15 | consumeItem指定数量消耗 | PASS |
| 16 | consumeItem数量不足时失败 | PASS |
| 17 | reset清空所有数据 | PASS |

## 新增文件

1. `src/games/three-kingdoms/engine/map/SiegeItemSystem.ts` — 道具系统实现（含I7掉落函数 + I8道具管理）
2. `src/games/three-kingdoms/engine/map/__tests__/SiegeReward.drop.test.ts` — 17个测试用例
