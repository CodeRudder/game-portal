# Offline Module R1 Arbiter Verdict

> 模块: engine/offline | 轮次: R1 | 日期: 2026-05-01
> Arbiter: v1.6 | Builder: v1.8 | Challenger: v1.4

## 仲裁总览

| 项目 | 值 |
|------|-----|
| Builder节点总数 | 114 |
| Challenger P0声称 | 12 |
| Challenger P1声称 | 5 |
| Arbiter确认P0 | 10 |
| Arbiter降级P0→P1 | 2 |
| Arbiter升级P1→P0 | 0 |
| Arbiter独立发现P0 | 1 |

---

## 逐项裁决

### P0-001: OfflineRewardSystem/OfflineSnapshotSystem serialize() 未被 engine-save 调用 ✅ 确认P0

- **裁决**: **确认P0，架构级**
- **理由**: engine-save.ts buildSaveData() 中无 offlineReward/offlineSnapshot 引用，存档时全部离线数据丢失。这是模式15(保存/加载流程缺失子系统)的典型案例。
- **修复优先级**: 最高
- **关联规则**: AR-008(保存/加载架构评审), AR-009(收敛加速规则)

### P0-002: calculateSnapshot NaN 传播 ✅ 确认P0

- **裁决**: **确认P0**
- **理由**: NaN <= 0 返回 false 绕过入口检查，后续所有计算结果为NaN。无任何 Number.isFinite 检查。影响 calculateFullReward → generateReturnPanel 全链路。
- **修复优先级**: 高

### P0-003: calculateSnapshot Infinity 绕过封顶 → 降级为P1

- **裁决**: **降级为P1**
- **理由**: Infinity 在 Math.min(Infinity, 259200) 下被正确封顶为259200。Challenger声称的序列化问题（JSON.stringify(Infinity)→null）仅影响 `offlineSeconds` 字段（原始值），不影响实际计算结果。虽然序列化问题存在，但实际触发路径需要 `offlineSeconds=Infinity` 作为输入，这在正常游戏流程中不可能发生。
- **修复建议**: 在 calculateSnapshot 入口添加 Infinity 检查

### P0-004: applyDouble NaN 倍率 ✅ 确认P0

- **裁决**: **确认P0**
- **理由**: multiplier 无 NaN 检查，mulRes(earned, NaN) 导致全部收益变为NaN，且 success=true。
- **修复优先级**: 高

### P0-005: addBoostItem NaN 绕过 ✅ 确认P0

- **裁决**: **确认P0**
- **理由**: NaN <= 0 返回 false，NaN + 0 = NaN，NaN道具数量可无限使用。经济漏洞。
- **修复优先级**: 高

### P0-006: deserialize(null) 崩溃 ✅ 确认P0

- **裁决**: **确认P0**
- **理由**: data 为 null 时直接访问 data.lastOfflineTime 崩溃。存档损坏场景下必然触发。
- **修复优先级**: 高

### P0-007: claimReward(null) 崩溃 ✅ 确认P0

- **裁决**: **确认P0**
- **理由**: reward 为 null 时访问 reward.cappedEarned 崩溃。
- **修复优先级**: 中

### P0-008: calculateOfflineExp NaN 经验加成 ✅ 确认P0

- **裁决**: **确认P0**
- **理由**: Math.min(NaN, 1.0) = NaN，导致 bonusExp/finalExp 全部为NaN。
- **修复优先级**: 中

### P0-009: calculateSiegeResult 负兵力 ✅ 确认P0

- **裁决**: **确认P0**
- **理由**: dispatchedTroops 无负值检查，负兵力导致负损失和负剩余兵力。
- **修复优先级**: 中

### P0-010: OfflineRewardEngine.applyDouble NaN ✅ 确认P0

- **裁决**: **确认P0**
- **理由**: 与P0-004对称（对称函数修复验证 AR-012），OfflineRewardEngine侧同样无NaN防护。
- **修复优先级**: 高（需与P0-004同步修复）

### P0-011: OfflineSnapshotSystem.expandWarehouse 假升级 → 降级为P1

- **裁决**: **降级为P1**
- **理由**: OfflineSnapshotSystem.expandWarehouse 设计为纯计算函数（传入配置，返回结果），不持有状态。调用方应自行管理状态更新。但 success:true 确实有误导性，建议在文档中明确标注为"纯计算"或改名为 calculateExpansion。
- **修复建议**: 重命名或添加文档说明

### P0-012: applyDouble VIP路径 getVipBonus() 无参数 ✅ 确认P0

- **裁决**: **确认P0**
- **理由**: applyDouble 方法签名不接受 vipLevel 参数，内部调用 this.getVipBonus() 使用默认值0。VIP5玩家每日翻倍上限应为5次，实际只有1次。这是经济系统bug。
- **修复优先级**: 高

---

## Arbiter 独立发现

### P0-A1: OfflineRewardSystem.applyDouble 广告翻倍无日限检查

- **源码位置**: `OfflineRewardSystem.ts:155-165`
- **说明**: applyDouble 中只有 VIP source 有次数限制（vipDoubleUsedToday），但 `ad` source 完全没有日限检查。对比 OfflineRewardEngine.applyDouble 有 AD_DAILY_LIMIT=3 的限制。OfflineRewardSystem 的 applyDouble 允许无限广告翻倍。
- **严重度**: 🟡 P0（经济漏洞）
- **复现场景**:
  ```
  for (let i = 0; i < 100; i++) {
    system.applyDouble(earned, { source: 'ad', multiplier: 2, description: '' });
    // 全部 success: true，无日限
  }
  ```

---

## 评分

| 维度 | 权重 | 得分 | 说明 |
|------|------|------|------|
| 完备性 | 25% | 7.5 | Builder覆盖114节点，但F-Error有12个待验证节点未实际测试 |
| 准确性 | 25% | 8.0 | 12个P0中10个确认，2个降级，虚报率16.7%（>5%扣分） |
| 优先级 | 15% | 8.5 | P0排序合理，架构级P0-001正确识别为最高优先级 |
| 可测试性 | 15% | 9.0 | 每个P0都有明确复现场景，可直接转化为测试用例 |
| 挑战应对 | 20% | 8.5 | Challenger发现12个P0+Arbiter发现1个，Builder的F-Error标记了高风险但未深入 |

**加权总分**: 7.5×0.25 + 8.0×0.25 + 8.5×0.15 + 9.0×0.15 + 8.5×0.20 = **8.15**

## 收敛判断

- 评分 8.15 < 9.0 封版线 → **CONTINUE**
- 新P0 = 11（含Arbiter独立发现1个）→ 不满足"最终轮新P0=0"
- 系统性NaN问题（P0-002/004/005/008/010）需要一轮修复验证
- 架构级P0-001（存档丢失）需要专项修复

## 修复指令

### 必须修复（P0，共11项）

| 优先级 | ID | 修复方案 |
|--------|-----|----------|
| 1 | P0-001 | engine-save.ts buildSaveData() 添加 offlineReward/offlineSnapshot 序列化 |
| 2 | P0-002 | calculateSnapshot 入口添加 `!Number.isFinite(offlineSeconds) \|\| offlineSeconds <= 0` |
| 3 | P0-012 | applyDouble 添加 vipLevel 参数，传递给 getVipBonus |
| 4 | P0-006 | deserialize 入口添加 `if (!data) return` |
| 5 | P0-004 | applyDouble 入口添加 multiplier NaN 检查 |
| 6 | P0-010 | OfflineRewardEngine.applyDouble 同步修复（AR-012对称函数规则） |
| 7 | P0-005 | addBoostItem 入口添加 `!Number.isFinite(count) \|\| count <= 0` |
| 8 | P0-007 | claimReward 入口添加 `if (!reward) return null` |
| 9 | P0-008 | calculateOfflineExp 入口添加 expBonus NaN 检查 |
| 10 | P0-009 | calculateSiegeResult 入口添加 `dispatchedTroops <= 0` 检查 |
| 11 | P0-A1 | applyDouble ad source 添加日限检查 |

### 建议修复（P1降级，共2项）

| ID | 修复方案 |
|-----|----------|
| P0-003→P1 | calculateSnapshot 入口 Infinity 检查 |
| P0-011→P1 | expandWarehouse 添加文档说明或重命名 |

---

## 规则进化建议

| 建议 | 关联文件 | 原因 |
|------|----------|------|
| 新增规则: 翻倍机制必须有日限 | builder-rules.md | P0-A1: OfflineRewardSystem.applyDouble 广告翻倍无日限 |
| 新增规则: 双系统同功能函数必须参数一致 | builder-rules.md | P0-012: applyDouble vs getAvailableDoubles 参数不对称 |
| 新增P0模式24: 双系统同功能不一致 | p0-pattern-library.md | OfflineRewardSystem.applyDouble 与 OfflineRewardEngine.applyDouble 行为不一致 |
