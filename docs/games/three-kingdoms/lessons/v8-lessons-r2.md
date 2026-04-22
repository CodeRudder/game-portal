# v8.0 商贸繁荣 — Round 2 复盘

> **版本**: v8.0 商贸繁荣 | **轮次**: Round 2
> **日期**: 2025-07-15

---

## LL-1: 跨域依赖用 type-only import + setter 注入是零耦合最佳实践

**场景**: ShopSystem 需要调用 CurrencySystem 检查余额和扣款，但两个系统属于不同域。
**做法**: `import type { CurrencySystem }` + `setCurrencySystem(cs)` setter注入。
**收益**: 编译时类型安全 + 运行时零循环依赖。DDD门面检查100%通过。
**适用**: 任何需要跨域协作但禁止运行时耦合的场景。

## LL-2: 聚合根 + 纯函数辅助模块是控制复杂度的有效模式

**场景**: TradeSystem 作为贸易域聚合根(351行)，将价格波动、事件生成、NPC逻辑等纯函数提取到 trade-helpers.ts(172行)。
**收益**: TradeSystem 保持聚合根职责清晰，trade-helpers 可独立测试(189行测试)，整体可维护性高。
**适用**: 当单个子系统超过300行时，将无状态计算逻辑提取为纯函数模块。

## LL-3: Math.random 散落是测试确定性的隐患，应尽早引入 RNG 注入

**场景**: trade-helpers.ts 7处、CaravanSystem 1处、ShopSystem 1处 Math.random 调用，影响价格波动、事件触发等核心逻辑。
**风险**: 单元测试无法精确控制随机结果，可能产生间歇性失败。
**改进**: 参照 v7.0 装备系统做法，将随机数生成器作为参数注入，生产环境用 Math.random，测试环境用确定性种子。
**适用**: 所有涉及随机性的游戏系统(战斗、掉落、价格、事件)。
