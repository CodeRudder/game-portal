# Trade 模块 R1 对抗式测试 — 流程树

> Builder Agent v1.9 | 2026-05-01
> 源码：5 文件 / ~1290 行

## 公开 API 清单

### TradeSystem (聚合根, 351行)
| # | API | 类型 | 参数 |
|---|-----|------|------|
| T-01 | `init(deps)` | ISubsystem | ISystemDeps |
| T-02 | `update(dt)` | ISubsystem | number |
| T-03 | `getState()` | ISubsystem | - |
| T-04 | `reset()` | ISubsystem | - |
| T-05 | `setCurrencyOps(ops)` | 注入 | TradeCurrencyOps |
| T-06 | `getRouteDefs()` | 查询 | - |
| T-07 | `getRouteState(routeId)` | 查询 | TradeRouteId |
| T-08 | `getAllRouteStates()` | 查询 | - |
| T-09 | `canOpenRoute(routeId, castleLevel)` | 校验 | TradeRouteId, number |
| T-10 | `openRoute(routeId, castleLevel)` | 状态变更 | TradeRouteId, number |
| T-11 | `refreshPrices()` | 状态变更 | - |
| T-12 | `getPrice(goodsId)` | 查询 | TradeGoodsId |
| T-13 | `getAllPrices()` | 查询 | - |
| T-14 | `getGoodsDef(goodsId)` | 查询 | TradeGoodsId |
| T-15 | `getAllGoodsDefs()` | 查询 | - |
| T-16 | `calculateProfit(routeId, cargo, bargainingPower, guardCost)` | 计算 | TradeRouteId, Record, number, number |
| T-17 | `completeTrade(routeId)` | 状态变更 | TradeRouteId |
| T-18 | `getProsperityLevel(routeId)` | 查询 | TradeRouteId |
| T-19 | `getProsperityMultiplier(routeId)` | 查询 | TradeRouteId |
| T-20 | `getProsperityTier(routeId)` | 查询 | TradeRouteId |
| T-21 | `generateTradeEvents(caravanId, routeId)` | 状态变更 | string, TradeRouteId |
| T-22 | `resolveTradeEvent(eventId, optionId)` | 状态变更 | string, string |
| T-23 | `autoResolveWithGuard(caravanId)` | 状态变更 | string |
| T-24 | `getActiveEvents(caravanId?)` | 查询 | string? |
| T-25 | `trySpawnNpcMerchants()` | 状态变更 | - |
| T-26 | `getActiveNpcMerchants()` | 查询 | - |
| T-27 | `interactWithNpcMerchant(merchantId)` | 状态变更 | string |
| T-28 | `serialize()` | 序列化 | - |
| T-29 | `deserialize(data)` | 序列化 | TradeSaveData |

### CaravanSystem (380行)
| # | API | 类型 | 参数 |
|---|-----|------|------|
| C-01 | `init(deps)` | ISubsystem | ISystemDeps |
| C-02 | `update(dt)` | ISubsystem | number |
| C-03 | `getState()` | ISubsystem | - |
| C-04 | `reset()` | ISubsystem | - |
| C-05 | `setRouteProvider(provider)` | 注入 | RouteInfoProvider |
| C-06 | `getCaravans()` | 查询 | - |
| C-07 | `getCaravan(id)` | 查询 | string |
| C-08 | `getIdleCaravans()` | 查询 | - |
| C-09 | `getCaravanCount()` | 查询 | - |
| C-10 | `canAddCaravan()` | 查询 | - |
| C-11 | `dispatch(request)` | 状态变更 | CaravanDispatchRequest |
| C-12 | `checkGuardMutex(heroId, excludeCaravanId?)` | 校验 | string, string? |
| C-13 | `assignGuard(caravanId, heroId)` | 状态变更 | string, string |
| C-14 | `removeGuard(caravanId)` | 状态变更 | string |
| C-15 | `getGuardHeroId(caravanId)` | 查询 | string |
| C-16 | `hasGuard(caravanId)` | 查询 | string |
| C-17 | `addCaravan()` | 状态变更 | - |
| C-18 | `upgradeCaravan(caravanId, attribute, value)` | 状态变更 | string, keyof CaravanAttributes, number |
| C-19 | `serialize()` | 序列化 | - |
| C-20 | `deserialize(data)` | 序列化 | { caravans, version } |

### ResourceTradeEngine (334行)
| # | API | 类型 | 参数 |
|---|-----|------|------|
| R-01 | `init(deps)` | ISubsystem | ISystemDeps |
| R-02 | `update(dt)` | ISubsystem | number |
| R-03 | `getState()` | ISubsystem | - |
| R-04 | `reset()` | ISubsystem | - |
| R-05 | `setDeps(deps)` | 注入 | ResourceTradeDeps |
| R-06 | `tradeResource(from, to, amount)` | 核心 | ResourceType, ResourceType, number |
| R-07 | `getResourceTradeRate(from, to)` | 查询 | ResourceType, ResourceType |
| R-08 | `canTradeResource(from, to, amount)` | 校验 | ResourceType, ResourceType, number |
| R-09 | `getSupportedTradePairs()` | 查询 | - |

---

## 流程树节点

### F-Normal（正常流程）

#### TradeSystem
| 节点ID | 描述 | API | 覆盖 |
|--------|------|-----|------|
| FN-T01 | 初始化 → 获取商路定义 → 检查开通条件 → 开通商路 | T-06, T-09, T-10 | covered |
| FN-T02 | 开通商路 → 查看价格 → 计算利润 → 完成贸易 | T-10, T-12, T-16, T-17 | covered |
| FN-T03 | 完成贸易 → 繁荣度增长 → 查看繁荣等级 | T-17, T-18, T-19, T-20 | covered |
| FN-T04 | 生成贸易事件 → 解决事件 → 繁荣度变化 | T-21, T-22 | covered |
| FN-T05 | 生成事件 → 护卫自动解决 | T-21, T-23 | covered |
| FN-T06 | 尝试生成NPC商人 → 交互 | T-25, T-26, T-27 | covered |
| FN-T07 | 序列化 → 反序列化 → 数据一致 | T-28, T-29 | covered |
| FN-T08 | update → 繁荣度衰减 | T-02 | covered |
| FN-T09 | update → NPC商人过期清理 | T-02 | covered |
| FN-T10 | reset → 数据重置 | T-04 | covered |

#### CaravanSystem
| 节点ID | 描述 | API | 覆盖 |
|--------|------|-----|------|
| FN-C01 | 获取商队列表 → 获取空闲商队 → 派遣 | C-06, C-08, C-11 | covered |
| FN-C02 | 派遣 → update → 到达交易 → update → 返回完成 | C-11, C-02 | covered |
| FN-C03 | 派遣带护卫 → 检查互斥 | C-11, C-12, C-13 | covered |
| FN-C04 | 移除护卫 → 重新指派 | C-14, C-13 | covered |
| FN-C05 | 新增商队 → 达到上限 | C-17, C-10 | covered |
| FN-C06 | 升级商队属性 | C-18 | covered |
| FN-C07 | 序列化 → 反序列化 → 护卫表恢复 | C-19, C-20 | covered |
| FN-C08 | reset → 商队重置到初始数量 | C-04 | covered |

#### ResourceTradeEngine
| 节点ID | 描述 | API | 覆盖 |
|--------|------|-----|------|
| FN-R01 | grain→gold 正常交易 | R-06 | covered |
| FN-R02 | gold→grain 正常交易 | R-06 | covered |
| FN-R03 | grain→troops 正常交易 | R-06 | covered |
| FN-R04 | gold→techPoint 正常交易 | R-06 | covered |
| FN-R05 | canTradeResource 检查通过 | R-08 | covered |
| FN-R06 | 粮草保护线触发 | R-06 | covered |
| FN-R07 | 铜钱安全线触发 | R-06 | covered |
| FN-R08 | 市场等级不足 | R-06 | covered |
| FN-R09 | 资源不足 | R-06 | covered |
| FN-R10 | 不支持的交易对 | R-06 | covered |

### F-Boundary（边界条件）

| 节点ID | 描述 | API | 风险 |
|--------|------|-----|------|
| FB-T01 | 开通已开通的商路 | T-10 | 低 |
| FB-T02 | 开通不存在的商路 | T-10 | 低 |
| FB-T03 | 城堡等级不足开通商路 | T-10 | 低 |
| FB-T04 | 前置商路未开通 | T-10 | 低 |
| FB-T05 | calculateProfit 空 cargo | T-16 | 中 |
| FB-T06 | calculateProfit 不存在的商路 | T-16 | 低 |
| FB-T07 | resolveTradeEvent 不存在的事件 | T-22 | 低 |
| FB-T08 | resolveTradeEvent 不存在的选项 | T-22 | 低 |
| FB-T09 | 繁荣度上限 100 | T-17 | 低 |
| FB-T10 | 繁荣度下限 0 | T-02 | 低 |
| FB-C01 | 派遣不存在的商队 | C-11 | 低 |
| FB-C02 | 派遣非空闲商队 | C-11 | 低 |
| FB-C03 | 载重恰好等于上限 | C-11 | 低 |
| FB-C04 | 护卫互斥冲突 | C-12 | 低 |
| FB-C05 | 升级 currentLoad 属性 | C-18 | 低 |
| FB-C06 | 升级不存在的商队 | C-18 | 低 |
| FB-R01 | amount = 0 | R-06 | 低 |
| FB-R02 | amount < 0 | R-06 | 低 |
| FB-R03 | 粮草恰好等于保护线+交易量 | R-06 | 低 |
| FB-R04 | 铜钱恰好等于安全线 | R-06 | 低 |

### F-Error（错误路径）

| 节点ID | 描述 | API | 风险 |
|--------|------|-----|------|
| FE-T01 | **NaN 作为 bargainingPower** | T-16 | **P0** — NaN绕过计算 |
| FE-T02 | **NaN 作为 guardCost** | T-16 | **P0** — NaN传播到profit |
| FE-T03 | **NaN 作为 cargo 数量** | T-16 | **P0** — NaN传播 |
| FE-T04 | **NaN 作为 amount 传入 tradeResource** | R-06 | **P0** — NaN绕过 <=0 检查 |
| FE-T05 | **NaN 作为 amount 传入 canTradeResource** | R-08 | **P0** — 同上 |
| FE-T06 | **NaN 作为 value 传入 upgradeCaravan** | C-18 | **P0** — NaN污染属性 |
| FE-T07 | **负数作为 value 传入 upgradeCaravan** | C-18 | **P0** — 负值降低属性 |
| FE-T08 | **NaN 作为 cargo qty 传入 dispatch** | C-11 | **P0** — NaN绕过载重检查 |
| FE-T09 | **负数 cargo qty 传入 dispatch** | C-11 | **P1** — 负载重 |
| FE-T10 | deserialize 版本不匹配 | T-29, C-20 | P1 |
| FE-T11 | deserialize null/undefined data | T-29, C-20 | **P0** |
| FE-T12 | currencyOps 未设置时 openRoute | T-10 | P2 |
| FE-T13 | routeProvider 未设置时 dispatch | C-11 | P2 |
| FE-T14 | tradeDeps 未设置时 tradeResource | R-06 | P2 |
| FE-T15 | **Infinity 作为 amount** | R-06 | **P1** — Infinity序列化问题 |

### F-CrossSystem（跨系统链路）

| 节点ID | 描述 | 链路 | 风险 |
|--------|------|------|------|
| FX-01 | **CaravanSystem 未被 engine-save 覆盖** | Caravan ↔ engine-save | **P0** |
| FX-02 | **ResourceTradeEngine 未被 engine-save 覆盖** | ResourceTrade ↔ engine-save | **P0** |
| FX-03 | TradeSystem.serialize caravans 字段为空数组 | Trade ↔ Caravan | **P0** |
| FX-04 | TradeSystem.deserialize 不恢复 CaravanSystem | Trade ↔ Caravan | **P0** |
| FX-05 | openRoute → currencyOps.spendByPriority 链路 | Trade ↔ Currency | P2 |
| FX-06 | dispatch → routeProvider.completeTrade 链路 | Caravan ↔ Trade | P1 |
| FX-07 | ResourceTradeEngine.setDeps 注入时机 | ResourceTrade ↔ Resource/Building | P2 |
| FX-08 | initR11Systems 中 trade 子系统初始化顺序 | Engine ↔ Trade | P2 |
| FX-09 | deserialize 后 initResourceTradeDeps 重新注入 | Engine ↔ ResourceTrade | P2 |
| FX-10 | SaveContext 缺少 caravan/resourceTrade 字段 | engine-save ↔ Trade | **P0** |

### F-DataLifecycle（数据生命周期）

| 节点ID | 描述 | 风险 |
|--------|------|------|
| FD-01 | **商队状态在 save/load 后丢失** | **P0** |
| FD-02 | **护卫互斥表在 save/load 后丢失** | **P0** |
| FD-03 | **ResourceTradeEngine 无状态 — 可接受** | P2 |
| FD-04 | 活跃事件在 save/load 后保留 | 低 |
| FD-05 | NPC商人在 save/load 后保留 | 低 |
| FD-06 | 价格波动数据在 save/load 后保留 | 低 |

---

## 跨系统链路清单（N=3×2=6条，实际枚举10条）

| # | 链路 | 节点 | 状态 |
|---|------|------|------|
| 1 | Engine → TradeSystem.init | FX-08 | ✅ |
| 2 | Engine → CaravanSystem.init | FX-08 | ✅ |
| 3 | Engine → ResourceTradeEngine.init | FX-08 | ✅ |
| 4 | Engine.save → TradeSystem.serialize | FX-01/03 | ❌ 不完整 |
| 5 | Engine.save → CaravanSystem.serialize | FX-01 | ❌ 缺失 |
| 6 | Engine.load → TradeSystem.deserialize | FX-04 | ❌ 不恢复Caravan |
| 7 | Engine.load → CaravanSystem.deserialize | FX-01 | ❌ 缺失 |
| 8 | Trade ↔ Currency (openRoute) | FX-05 | ✅ |
| 9 | Caravan ↔ Trade (completeTrade) | FX-06 | ✅ |
| 10 | ResourceTrade ↔ Resource/Building | FX-07 | ✅ |

---

## 统计

| 维度 | 数量 |
|------|------|
| 公开 API | 48 |
| F-Normal | 28 |
| F-Boundary | 20 |
| F-Error | 15 |
| F-CrossSystem | 10 |
| F-DataLifecycle | 6 |
| **总计** | **79** |
| P0 节点 | 13 |
| P1 节点 | 3 |
| P2 节点 | 5 |
