# Trade 模块 R1 对抗式测试 — 修复报告

> Fixer Agent | 2026-05-01
> 修复 8 个 P0，验证编译通过

---

## 修复清单

### FIX-801: ResourceTradeEngine NaN 绕过防护 (P0-001)
- **文件**: `src/games/three-kingdoms/engine/trade/ResourceTradeEngine.ts`
- **行**: 164, 243
- **变更**: `amount <= 0` → `!Number.isFinite(amount) || amount <= 0`
- **影响**: tradeResource + canTradeResource 两个 API 入口

### FIX-802: upgradeCaravan NaN/负值防护 (P0-002)
- **文件**: `src/games/three-kingdoms/engine/trade/CaravanSystem.ts`
- **行**: 348-353
- **变更**: 添加 `if (!Number.isFinite(value) || value <= 0) return false;`
- **影响**: 防止 NaN/负值污染商队属性

### FIX-803: dispatch cargo NaN/负值防护 (P0-003)
- **文件**: `src/games/three-kingdoms/engine/trade/CaravanSystem.ts`
- **行**: 205-209
- **变更**: 在循环中添加 `if (!Number.isFinite(qty) || qty < 0) return error`
- **影响**: 防止 NaN 货物数量绕过载重检查

### FIX-804: calculateProfit NaN 防护 (P0-004)
- **文件**: `src/games/three-kingdoms/engine/trade/TradeSystem.ts`
- **行**: 179-218
- **变更**:
  - bargainingPower: NaN → 默认 1.0
  - guardCost: NaN → 默认 0
  - cargo quantity: 添加 `Number.isFinite(quantity) && quantity > 0` 过滤
- **影响**: 防止利润计算 NaN 传播

### FIX-805: CaravanSystem engine-save 接入 (P0-005)
- **文件**: 
  1. `src/games/three-kingdoms/engine/engine-save.ts` — SaveContext + buildSaveData + toIGameState + fromIGameState + applySaveData
  2. `src/games/three-kingdoms/shared/types.ts` — GameSaveData
  3. `src/games/three-kingdoms/engine/ThreeKingdomsEngine.ts` — buildSaveCtx
- **变更**: 六处同步添加 caravan 支持
  1. SaveContext: `readonly caravan?: CaravanSystem`
  2. GameSaveData: `caravan?: { caravans: Caravan[]; version: number }`
  3. buildSaveData: `caravan: ctx.caravan?.serialize()`
  4. toIGameState: `if (data.caravan) subsystems.caravan = data.caravan`
  5. fromIGameState: `caravan: s.caravan as ...`
  6. applySaveData: `if (data.caravan && ctx.caravan) ctx.caravan.deserialize(data.caravan)`
  7. buildSaveCtx: `caravan: this.r11.caravanSystem`
  - **同时修复**: trade 系统也从 buildSaveCtx 缺失，一并添加 `trade: this.r11.tradeSystem`

### FIX-806: TradeSystem.serialize caravans 注释 (P0-006)
- **文件**: `src/games/three-kingdoms/engine/trade/TradeSystem.ts`
- **变更**: 添加注释说明 caravans 由 CaravanSystem 独立管理

### FIX-808: TradeSystem.deserialize null 安全 (P0-008)
- **文件**: `src/games/three-kingdoms/engine/trade/TradeSystem.ts`
- **变更**: 添加 `!data || typeof data !== 'object'` 检查，data.routes/prices/activeEvents/npcMerchants null 安全

### FIX-809: CaravanSystem.deserialize null 安全 (P0-009)
- **文件**: `src/games/three-kingdoms/engine/trade/CaravanSystem.ts`
- **变更**: 添加 `!data || typeof data !== 'object'` 检查，data.caravans null/Array.isArray 安全

---

## 编译验证

```bash
npx tsc --noEmit
# 无新增错误（仅预存的 social/leaderboard 模块错误）
```

✅ 编译通过

---

## 额外发现

### FIX-805-EX: TradeSystem 也未在 buildSaveCtx 中注册
- `buildSaveCtx()` 缺少 `trade: this.r11.tradeSystem`
- 导致 `ctx.trade?.serialize()` 始终为 undefined
- **已一并修复**

---

## 修复穿透验证

| 修复 | 穿透检查 | 结果 |
|------|---------|------|
| FIX-801 (NaN防护) | 检查所有 `<= 0` 模式 | ✅ Trade模块内全部覆盖 |
| FIX-802 (upgradeCaravan) | 检查对称函数 | ✅ 无对称函数 |
| FIX-804 (calculateProfit) | 检查所有数值参数 | ✅ 3个参数全部防护 |
| FIX-805 (engine-save) | 检查六处同步 | ✅ 六处+buildSaveCtx全部覆盖 |
| FIX-808/809 (deserialize) | 检查所有 deserialize | ✅ Trade+Caravan 均已修复 |

FIX穿透率: 0% < 10% 目标 ✅
