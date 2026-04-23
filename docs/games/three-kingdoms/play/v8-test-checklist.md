# v8.0 商贸繁荣 — 测试检查清单

> **Round**: 30 | **版本**: v8.0 | **日期**: 2025-07-11
> **测试框架**: Vitest | **总测试数**: 333 (10个文件) | **通过率**: 100%

---

## 1. 测试统计

### 新增集成测试（本轮）

| 文件 | 测试数 | 状态 |
|:-----|:------:|:----:|
| `shop/__tests__/ShopSystem.integration.test.ts` | 29 | ✅ |
| `trade/__tests__/TradeSystem.integration.test.ts` | 54 | ✅ |
| `shop/__tests__/v8-commerce-integration.test.ts` | 18 | ✅ |
| **新增合计** | **101** | **✅** |

### 已有单元测试（回归）

| 文件 | 测试数 | 状态 |
|:-----|:------:|:----:|
| `shop/__tests__/ShopSystem.test.ts` | 69 | ✅ |
| `shop/__tests__/ShopSystem-p1.test.ts` | 28 | ✅ |
| `shop/__tests__/ShopSystem-p2.test.ts` | 29 | ✅ |
| `shop/__tests__/ShopSystem-p3.test.ts` | 12 | ✅ |
| `trade/__tests__/TradeSystem.test.ts` | 53 | ✅ |
| `trade/__tests__/CaravanSystem.test.ts` | 24 | ✅ |
| `trade/__tests__/trade-helpers.test.ts` | 17 | ✅ |
| **回归合计** | **232** | **✅** |

### 总计

| 类别 | 文件数 | 测试数 | 通过 | 失败 |
|:-----|:------:|:------:|:----:|:----:|
| 新增集成测试 | 3 | 101 | 101 | 0 |
| 已有单元测试 | 7 | 232 | 232 | 0 |
| **总计** | **10** | **333** | **333** | **0** |

---

## 2. Play文档覆盖矩阵

### §1 商贸系统

| 流程 | 覆盖测试文件 | 状态 |
|:-----|:-----------|:----:|
| §1.1 集市商店浏览与购买 | ShopSystem.integration.test.ts | ✅ |
| §1.2 五级确认策略 | ShopSystem.integration.test.ts | ✅ |
| §1.3 误操作防护 | ShopSystem.integration.test.ts (部分) | ⚠️ |
| §1.4 库存与限购 | ShopSystem.integration.test.ts | ✅ |
| §1.5 折扣机制 | ShopSystem.integration.test.ts | ✅ |
| §1.5.1 NPC好感度等级映射 | ShopSystem.integration.test.ts | ✅ |
| §1.5.2 折扣叠加场景 | ShopSystem.integration.test.ts | ✅ |
| §1.6 货币体系 | ShopSystem.integration.test.ts | ✅ |
| §1.7 货币兑换与汇率 | ShopSystem.integration.test.ts | ✅ |
| §1.8 货币防通胀与转生 | v8-commerce-integration.test.ts | ✅ |

### §2 多商店类型

| 流程 | 覆盖测试文件 | 状态 |
|:-----|:-----------|:----:|
| §2.1 军需处商店 | ShopSystem.integration.test.ts (多商店) | ✅ |
| §2.2 黑市商店 | ShopSystem.integration.test.ts (多商店) | ✅ |
| §2.3 活动商店 | ShopSystem.integration.test.ts (多商店) | ✅ |
| §2.4 NPC交易商店 | v8-commerce-integration.test.ts | ✅ |
| §2.4.1 NPC好感度限购解锁 | v8-commerce-integration.test.ts | ✅ |

### §3 贸易路线

| 流程 | 覆盖测试文件 | 状态 |
|:-----|:-----------|:----:|
| §3.1 商路开通 | TradeSystem.integration.test.ts | ✅ |
| §3.2 商品系统 | TradeSystem.integration.test.ts | ✅ |
| §3.3 商队管理 | TradeSystem.integration.test.ts | ✅ |
| §3.4 商队属性提升 | v8-commerce-integration.test.ts | ✅ |
| §3.5 商队派遣与运输 | TradeSystem.integration.test.ts | ✅ |

### §4 价格波动

| 流程 | 覆盖测试文件 | 状态 |
|:-----|:-----------|:----:|
| §4.1 行情刷新 | TradeSystem.integration.test.ts | ✅ |
| §4.2 低买高卖策略 | TradeSystem.integration.test.ts | ✅ |

### §5 贸易事件

| 流程 | 覆盖测试文件 | 状态 |
|:-----|:-----------|:----:|
| §5.1 随机事件 | TradeSystem.integration.test.ts | ✅ |
| §5.2 护卫自动处理 | TradeSystem.integration.test.ts | ✅ |
| §5.3 繁荣度 | TradeSystem.integration.test.ts | ✅ |
| §5.4 NPC特殊商人 | TradeSystem.integration.test.ts | ✅ |
| §5.4.1 NPC跨周持久性 | — | ⚠️ |

### §6 收藏系统

| 流程 | 覆盖测试文件 | 状态 |
|:-----|:-----------|:----:|
| §6.1 商品收藏与提醒 | ShopSystem.integration.test.ts | ✅ |

### §7 补货

| 流程 | 覆盖测试文件 | 状态 |
|:-----|:-----------|:----:|
| §7.1 补货引擎 | ShopSystem.integration.test.ts | ✅ |

### §8 交叉验证

| 流程 | 覆盖测试文件 | 状态 |
|:-----|:-----------|:----:|
| §8.1 商店→货币→库存联动 | v8-commerce-integration.test.ts | ✅ |
| §8.2 贸易→繁荣度闭环 | v8-commerce-integration.test.ts | ✅ |
| §8.4 护卫武将互斥 | TradeSystem.integration.test.ts | ✅ |
| §8.5 离线回归 | — | ⚠️ |
| §8.6 货币兑换→贸易增强 | v8-commerce-integration.test.ts | ✅ |
| §8.7 全经济循环压力测试 | v8-commerce-integration.test.ts | ✅ |
| §8.8 科技→贸易联动 | v8-commerce-integration.test.ts | ✅ |
| §8.10 转生→商贸系统 | v8-commerce-integration.test.ts | ✅ |
| §8.11 多商店并发状态 | ShopSystem.integration.test.ts | ✅ |
| §8.12 商贸→声望联动 | v8-commerce-integration.test.ts | ✅ |

### §9 R3补充流程

| 流程 | 覆盖测试文件 | 状态 |
|:-----|:-----------|:----:|
| §9.1 定价体系 | ShopSystem.integration.test.ts | ✅ |
| §9.2 仓库容量扩展 | — | ⚠️ |
| §9.3 声望转生规则 | v8-commerce-integration.test.ts (部分) | ⚠️ |
| §9.4 活动代币过期 | — | ⚠️ |
| §9.5 MAP领土→商贸联动 | — | ⚠️ |

---

## 3. 覆盖率统计

| Play文档章节 | 总流程数 | 已覆盖 | 部分覆盖 | 未覆盖 |
|:------------|:-------:|:-----:|:-------:|:-----:|
| §1 商贸系统 | 10 | 9 | 1 | 0 |
| §2 多商店类型 | 5 | 4 | 1 | 0 |
| §3 贸易路线 | 5 | 5 | 0 | 0 |
| §4 价格波动 | 2 | 2 | 0 | 0 |
| §5 贸易事件 | 5 | 4 | 0 | 1 |
| §6 收藏系统 | 1 | 1 | 0 | 0 |
| §7 补货 | 1 | 1 | 0 | 0 |
| §8 交叉验证 | 10 | 7 | 1 | 2 |
| §9 R3补充 | 5 | 1 | 1 | 3 |
| **总计** | **44** | **34** | **4** | **6** |
| **覆盖率** | | **77%** | **9%** | **14%** |

---

## 4. 发现的问题

### 🔴 严重问题（0个）

无。

### 🟡 中等问题（3个）

| # | 问题 | 来源 | 影响 |
|:-:|:-----|:-----|:-----|
| M1 | **繁荣度衰减使用dt而非实际时间差** | TradeSystem.update() | update(dt)中繁荣度衰减用dt，但NPC过期用Date.now()，时间体系不一致 |
| M2 | **商队运输时间基于Date.now()** | CaravanSystem.update() | 商队到达判断用Date.now()，无法通过update(dt)模拟时间推进，测试困难 |
| M3 | **NPC过期duration单位不一致** | trade-config.ts | NPC_MERCHANT_DURATION=3600(秒)，但getActiveNpcMerchants用毫秒比较(now - appearedAt < duration)，应乘1000 |

### 🟢 轻微问题（4个）

| # | 问题 | 来源 | 影响 |
|:-:|:-----|:-----|:-----|
| L1 | **离线回归(§8.5)无测试** | 缺OfflineTradeAndBoost集成 | 离线补货/离线贸易效率未覆盖 |
| L2 | **仓库容量扩展(§9.2)无独立测试** | 无WarehouseSystem | 仓库溢出保护未验证 |
| L3 | **活动代币过期(§9.4)无测试** | TokenShopSystem未集成 | 代币过期结算流程未覆盖 |
| L4 | **MAP领土→商贸(§9.5)无测试** | 跨系统依赖 | 领土产出加成未验证 |

---

## 5. Play文档 vs 实现差异

| 差异 | Play文档 | 实际实现 | 建议 |
|:-----|:---------|:---------|:-----|
| 商路数量 | 8条(洛阳/长安/成都/许昌/邺城/建业/南中/会稽) | 8条(洛阳/长安/成都/许昌/邺城/建业/襄阳/柴桑) | 城市名称不同，南中→襄阳，会稽→柴桑。需确认是否为设计变更 |
| 贸易商品 | 10种(粮草/木材/铁矿/书籍/杜康酒/兵器/西凉马/蜀锦/药材/和田玉) | 10种(丝绸/茶叶/铁矿石/战马/精粮/美酒/玉石/药材/食盐/漆器) | 商品完全不同。需确认是否为设计变更 |
| 繁荣度等级 | 萧条(0~30)/平淡(31~60)/繁荣(61~80)/鼎盛(81~100) | declining(0~25)/normal(25~50)/thriving(50~75)/golden(75~100) | 阈值不同：Play用0/31/61/81，实现用0/25/50/75。需对齐 |
| 繁荣度产出倍率 | ×0.8/×1.0/×1.2/×1.5 | ×0.8/×1.0/×1.3/×1.6 | 繁荣和鼎盛倍率不同(×1.2→×1.3, ×1.5→×1.6) |
| 商队数量上限 | 主城6~9级2队/10~14级4队/15~19级6队/20+级8队 | 固定MAX_CARAVAN_COUNT=5 | 实现简化为固定上限5，未按主城等级动态调整 |
| 开通费用 | 洛阳→许昌2K等 | route_luoyang_xuchang={copper:500} | 费用大幅低于Play文档定义 |
| NPC商人类型 | 丝绸之路/江东/蜀中/北方/黑市 | 行商/珍品/奢侈品/黑市/商业大师 | NPC类型完全不同 |
| NPC持续时间 | 4h | 3600秒(1h) | Play文档4h，实现1h |
| 贸易事件 | 8种(山贼/暴雨/商路发现/官府设卡/商队遇友/路遇流民/天降横财/商路断绝) | 8种(山贼/暴雨/关税/商业繁荣/偶遇商人/道路堵塞/意外发现/商业竞争) | 事件类型部分不同 |

---

## 6. 下一步建议

1. **[P0] 对齐繁荣度阈值**: Play文档0/31/61/81 vs 实现0/25/50/75，需确认哪个为准
2. **[P0] 对齐商队上限**: Play文档按主城等级动态(2/4/6/8) vs 实现固定5
3. **[P1] 修复NPC duration单位**: 3600秒 vs 毫秒比较，可能导致NPC立即过期或永不过期
4. **[P1] 补充离线贸易测试**: 集成OfflineTradeAndBoost
5. **[P2] 补充仓库容量测试**: 需WarehouseSystem或仓库模块
6. **[P2] 补充活动代币过期测试**: 集成TokenShopSystem

---

## 7. 构建状态

| 检查项 | 状态 |
|:-------|:----:|
| `pnpm run build` | ✅ 通过 (29.17s) |
| 单元测试 | ✅ 232/232 通过 |
| 集成测试 | ✅ 101/101 通过 |
| 总测试 | ✅ 333/333 通过 |
