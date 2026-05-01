# Prestige R1 — Arbiter 裁决

> Arbiter Agent 产出 | 2026-05-01
> 裁决对象: round-1-tree.md + round-1-challenges.md
> 方法论: 三方交叉验证 + 源码行级确认

---

## 裁决总览

| 指标 | 值 |
|------|-----|
| Builder P0节点 | 13 |
| Challenger 确认P0 | 12 |
| Challenger 降级 | 1 (P0-13→P1) |
| Challenger 遗漏追加 | 1 (合并到P0-07) |
| Arbiter 最终P0 | 12 |
| Arbiter 追加P0 | 0 |
| 覆盖率评分 | 85/100 |

---

## 逐项裁决

### P0-01: addPrestigePoints — basePoints无NaN/负值防护
- **Builder**: ✅ 正确识别
- **Challenger**: ✅ 源码验证通过，攻击路径可行
- **Arbiter**: **确认P0** — 声望值是核心资源，NaN传播影响全局
- **FIX**: 入口检查 `!Number.isFinite(basePoints) || basePoints <= 0`

### P0-02/03: PrestigeSystem.loadSaveData — NaN/null
- **Builder**: ✅ 正确识别
- **Challenger**: ✅ 验证通过
- **Arbiter**: **确认P0** — 存档注入是经典攻击面
- **FIX**: 深拷贝+字段验证，null防护

### P0-04: calcRebirthMultiplier — NaN
- **Builder**: ✅ 正确识别
- **Challenger**: ✅ 验证NaN传播链完整
- **Arbiter**: **确认P0** — multiplier是全局乘数，影响所有产出
- **FIX**: `if (!Number.isFinite(count) || count <= 0) return 1.0`

### P0-05/06: RebirthSystem.loadSaveData — NaN/null
- **Builder**: ✅ 正确识别
- **Challenger**: ✅ 验证通过
- **Arbiter**: **确认P0**
- **FIX**: 深拷贝+字段验证+null防护

### P0-07/08/09: PrestigeShopSystem.buyGoods — NaN/负值绕过
- **Builder**: ✅ 正确识别三个变体
- **Challenger**: ✅ 验证NaN绕过经典模式，命中BR-21
- **Arbiter**: **确认P0** — 经济系统核心漏洞，可免费获取商品+刷声望
- **FIX**: quantity检查 `!Number.isFinite(quantity) || quantity <= 0` + prestigePoints检查 `!Number.isFinite(this.prestigePoints)`

### P0-10: PrestigeShopSystem — 无存档集成
- **Builder**: ✅ 正确识别
- **Challenger**: ✅ 验证engine-save无prestigeShop字段
- **Arbiter**: **确认P0** — 命中BR-14/BR-15，购买记录丢失
- **FIX**: 添加serialize/deserialize方法 + engine-save集成（本轮仅修子系统，engine-save集成标记为跨域FIX）

### P0-11: calculateBuildTime — NaN/零除
- **Builder**: ✅ 正确识别
- **Challenger**: ✅ 验证除零=Infinity
- **Arbiter**: **确认P0**
- **FIX**: 入口检查 `!Number.isFinite(baseTimeSeconds) || baseTimeSeconds <= 0` + multiplier检查

### P0-12: RebirthSystem — engine-save未调用loadSaveData
- **Builder**: ✅ 正确识别
- **Challenger**: ✅ 验证engine-save仅调用prestige.loadSaveData，不调用rebirth.loadSaveData
- **Arbiter**: **确认P0** — 转生状态丢失，命中BR-14/BR-15
- **FIX**: engine-save中添加rebirth加载（跨域FIX，本轮标记）

### P0-13: setCallbacks — prestigeLevel=NaN
- **Builder**: 标记P0
- **Challenger**: ⚠️ 降级为P1 — NaN只导致无法转生，安全方向
- **Arbiter**: **同意降级P1** — NaN使条件永远不满足，阻止操作而非放行，安全方向

---

## 覆盖率评估

### 已覆盖维度
| 维度 | 评分 | 说明 |
|------|------|------|
| F-Normal | 90/100 | 每个公开API至少1个Normal节点 |
| F-Error (NaN) | 95/100 | 所有关键NaN路径识别 |
| F-Error (Null) | 85/100 | loadSaveData null路径覆盖 |
| F-Serialize | 90/100 | 存档/读档路径完整分析 |
| F-CrossSystem | 75/100 | 4条跨系统链路，但缺少与Tech/Hero的交叉 |
| BR规则命中 | 80/100 | BR-14, BR-15, BR-21命中，BR-22部分命中 |

### 未覆盖/弱覆盖
1. **Tech×Prestige交叉**: 科技系统声望获取途径未分析
2. **Hero×Prestige交叉**: 武将系统对声望等级的依赖未分析
3. **EventChain×Prestige**: 事件系统声望获取链路未分析
4. **VIP×PrestigeShop**: VIP折扣对商店的影响未分析

---

## 修复计划

| FIX ID | 关联P0 | 修复文件 | 修复策略 |
|--------|--------|----------|----------|
| FIX-501 | P0-01 | PrestigeSystem.ts | addPrestigePoints入口NaN/负值检查 |
| FIX-502 | P0-02/03 | PrestigeSystem.ts | loadSaveData深拷贝+null/NaN验证 |
| FIX-503 | P0-04 | prestige-config.ts | calcRebirthMultiplierFromConfig入口检查 |
| FIX-504 | P0-05/06 | RebirthSystem.ts | loadSaveData深拷贝+null/NaN验证 |
| FIX-505 | P0-07/08/09 | PrestigeShopSystem.ts | buyGoods入口quantity+points检查 |
| FIX-506 | P0-10 | PrestigeShopSystem.ts | 添加getSaveData/loadSaveData |
| FIX-507 | P0-11 | RebirthSystem.helpers.ts | calculateBuildTime入口检查 |
| FIX-508 | P0-12 | engine-save.ts | 添加rebirth loadSaveData调用 |
| FIX-509 | P0-13→P1 | RebirthSystem.ts | setCallbacks NaN防护（低优先级） |

---

## 裁决结论

**R1状态**: ✅ 通过 — 12个P0已确认，修复计划完整

**R2建议方向**:
1. 跨系统链路深化（Tech/Hero/EventChain×Prestige）
2. 转生保留/重置规则与reset()的语义一致性
3. 声望商店经济平衡验证（限购绕过、折扣叠加）
4. 收益模拟器算法正确性验证

**Builder评分**: 85/100（遗漏4个P1变体，P0-13过度标记）
**Challenger评分**: 90/100（精准降级P0-13，遗漏追加合理）
