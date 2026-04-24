# v8.0 测试检查清单

**日期**: 2026-04-24  
**版本**: v8.0  
**状态**: ✅ 全部通过

---

## 测试文件汇总

| # | 文件 | 覆盖章节 | 用例数 | 状态 |
|---|------|---------|--------|------|
| 1 | `shop-basics.integration.test.ts` | §1.1~1.4 商店浏览/五级确认/库存限购 | 27/27 | ✅ |
| 2 | `shop-discount-currency.integration.test.ts` | §1.5~1.8 折扣/货币/消耗优先级/汇率 | 29/29 | ✅ |
| 3 | `trade-route-caravan.integration.test.ts` | §3.1~3.5 商路开通/商队派遣/护卫 | 34/34 | ✅ |
| 4 | `price-events-prosperity.integration.test.ts` | §4.1~5.3 行情刷新/低买高卖/事件/繁荣度 | 47/47 | ✅ |
| 5 | `favorites-restock.integration.test.ts` | §6.1+§7.1 收藏/降价提醒/补货引擎/手动刷新 | 30/30 | ✅ |
| 6 | `cross-system-trade.integration.test.ts` | §8.1~8.5 购买→货币→库存/贸易闭环/护卫互斥/离线回归 | 37/37 | ✅ |

**总计**: 204/204 用例通过

---

## 补充文件（已有测试覆盖）

| 文件 | 覆盖章节 | 用例数 | 状态 |
|------|---------|--------|------|
| `trade-events-prosperity.integration.test.ts` | §3.2+§4.1+§5.1~5.4 商品/行情/事件/NPC | 46/46 | ✅ |
| `trade-caravan-dispatch.integration.test.ts` | §3.x 商队派遣详细 | 51/51 | ✅ |
| `trade-currency-shop.integration.test.ts` | §1.x 货币商店联动 | 45/45 | ✅ |

---

## 未覆盖章节（备注）

以下章节因 P0/P1 系统尚未实现，暂无测试覆盖：

| 章节 | 内容 | 原因 |
|------|------|------|
| §2.x | 多商店类型（黑市/限时/VIP 独立逻辑） | 商店类型差异化逻辑未实现 |
| §3.6 | 自动贸易（挂机运输） | AutoTrade 子系统未实现 |
| §3.7 | 仓库管理（库存上限/分类/整理） | WarehouseSystem 未实现 |
| §8.6~8.13 | 高级联动（商店等级→贸易解锁、VIP→折扣联动、成就→贸易加成等） | 跨域依赖系统未实现 |

---

## 运行命令

```bash
# 运行全部集成测试
cd game-portal && npx vitest run src/games/three-kingdoms/engine/trade/__tests__/integration/

# 单文件运行
npx vitest run src/games/three-kingdoms/engine/trade/__tests__/integration/price-events-prosperity.integration.test.ts
npx vitest run src/games/three-kingdoms/engine/trade/__tests__/integration/favorites-restock.integration.test.ts
npx vitest run src/games/three-kingdoms/engine/trade/__tests__/integration/cross-system-trade.integration.test.ts
```

---

## 封版签名

- **测试工程师**: AI Subagent
- **日期**: 2026-04-24
- **构建状态**: 待验证（见封版报告）
