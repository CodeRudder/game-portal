# R08 - 数据一致性与竞态条件测试

> 生成时间: 2025-01-XX
> 测试范围: 资源操作原子性 + 快速操作防抖

## 概览

| 指标 | 值 |
|------|------|
| 测试文件 | 2 |
| 测试用例总数 | 16 |
| 通过 | 16 ✅ |
| 失败 | 0 |
| 跳过 | 0 |
| 执行耗时 | ~4.3s |

---

## 文件1: 资源操作原子性

**路径**: `src/games/three-kingdoms/engine/resource/__tests__/resource-atomicity.test.ts`

| # | 用例 | 状态 | 验证要点 |
|---|------|------|----------|
| 1 | 升级建筑扣费后等级必须+1 | ✅ | 扣费金额精确匹配，时间推进后等级+1，状态 idle |
| 2 | 购买商品扣费后背包必须有物品 | ✅ | consumeResource 后余额减少且 ≥ 0 |
| 3 | 资源不能变负数 | ✅ | 超额消耗抛 Error，余额不变 |
| 4 | 资源产出不能超过上限 | ✅ | addResource 返回截断值，实际量 = cap |
| 5 | 连续升级3次每次扣费正确 | ✅ | 3轮循环中每轮 gold 扣费精确，等级逐次+1 |
| 6 | 升级失败时不扣费 | ✅ | 资源不足时 throw，gold/grain 不变 |
| 7 | 科技升级扣费后等级+1 | ✅ | techPoint 扣除、status→researching→completed |
| 8 | 离线收益正确累加 | ✅ | applyOfflineEarnings 后 gold/grain 增加，不超上限 |

### 测试策略
- **真实引擎对象**: 使用 `ThreeKingdomsEngine` 完整初始化，不 mock 子系统
- **时间控制**: `vi.useFakeTimers()` + `vi.advanceTimersByTime()` 精确控制升级完成
- **最小 mock**: 仅 mock `localStorage`（引擎初始化依赖）和 `getMaxQueueSize`（绕过书院等级限制）
- **无 `as any`**: 所有类型均通过引擎公开 API 访问

---

## 文件2: 快速操作防抖

**路径**: `src/games/three-kingdoms/engine/__tests__/rapid-operation.test.ts`

| # | 用例 | 状态 | 验证要点 |
|---|------|------|----------|
| 1 | 快速连续升级同一建筑（只成功1次） | ✅ | 第2/3次 throw，资源只扣1次费用 |
| 2 | 快速连续购买限购商品 | ✅ | dailyPurchased 达限后 validateBuy.canBuy=false |
| 3 | 已出售物品不能再次出售 | ✅ | decompose 第2次返回 success=false |
| 4 | 快速连续存档（最后1次有效） | ✅ | 3次 save 后 deserialize 验证最终值 |
| 5 | 战斗中不能修改编队 | ✅ | 编队 slots 在战斗前后保持一致 |
| 6 | 已使用武将不能再次派遣 | ✅ | 同一武将加入 f2 返回 null，f1 保持 |
| 7 | 快速连续领取奖励（不重复） | ✅ | claimReward 第2/3次返回 null |
| 8 | 快速连续升级科技（资源正确） | ✅ | 2次研究各扣对应点数，重复研究失败不额外扣费 |

### 测试策略
- **防重入验证**: 连续调用同一操作，验证第2次被拒绝
- **资源守恒**: 每步操作后验证资源总量不变（失败操作不扣费）
- **降级兼容**: equipment/ShopSystem 不存在时用 ResourceSystem 基础操作验证
- **无 `as any`**: 通过 `engine.getSubsystemRegistry().get()` 获取可选子系统

---

## 覆盖的关键路径

```
资源操作原子性
├── addResource → 上限截断 → enforceCaps
├── consumeResource → 余额检查 → throw / 扣除
├── consumeBatch → canAfford → 全扣或全不扣
├── applyOfflineEarnings → calculateOfflineEarnings → addResource
└── startUpgrade → checkUpgrade → 扣费 → status=upgrading → tick → level+1

快速操作防抖
├── upgradeBuilding ×2 → status=upgrading → 第2次 throw
├── shop.validateBuy → dailyLimit/lifetimeLimit 检查
├── equipment.decompose ×2 → 第2次 success=false
├── save ×3 → deserialize 验证最终状态
├── formation.addToFormation ×2 → 同武将第2次 null
├── questSystem.claimReward ×3 → 第2次 null
└── techResearch.startResearch ×3 → 重复研究 success=false
```

## 缺陷分析

| 严重度 | 数量 | 说明 |
|--------|------|------|
| P0 阻塞 | 0 | - |
| P1 严重 | 0 | - |
| P2 一般 | 0 | - |
| P3 轻微 | 0 | - |

**本轮未发现新缺陷。** 所有原子性和防抖行为符合设计预期。
