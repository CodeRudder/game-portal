# Alliance R1 Arbiter 仲裁裁决

> 模块: engine/alliance | 日期: 2026-05-01
> Arbiter: v1.9 | Builder节点: 116 | Challenger缺陷: 13

## 裁决总览

| 严重性 | Challenger提交 | Arbiter确认 | 驳回 | 降级 |
|--------|---------------|-------------|------|------|
| P0 | 3 | 3 | 0 | 0 |
| P1 | 6 | 6 | 0 | 0 |
| P2 | 4 | 4 | 0 | 0 |

## P0 确认

### P0-001: ✅ 确认 — Alliance 未接入 engine-save 六处

**源码验证**:
- ✅ `SaveContext` (engine-save.ts L55-140): 0个 alliance 字段
- ✅ `GameSaveData` (shared/types.ts L216-315): 0个 alliance 字段
- ✅ `buildSaveData()` (engine-save.ts L152-236): 未调用 alliance.serialize()
- ✅ `applySaveData()` (engine-save.ts L479-700): 未调用 alliance.deserialize()
- ✅ `toIGameState()` (engine-save.ts L238-298): 未处理
- ✅ `fromIGameState()` (engine-save.ts L300-360): 未处理

**影响评估**: 存档/读档后所有联盟数据丢失。涉及4个子系统、61个API的全部状态。这是数据丢失级别的严重缺陷。

**违反规则**: BR-014 (保存/加载覆盖扫描), BR-015 (deserialize覆盖验证六处同步)

**修复优先级**: 🔴 最高

---

### P0-002: ✅ 确认 — AllianceTaskSystem Set<string> 无法 JSON 序列化

**源码验证**:
- ✅ `AllianceTaskInstance.claimedPlayers` 类型为 `Set<string>` (alliance.types.ts L218)
- ✅ `serializeTasks()` 存在但返回独立格式 (AllianceTaskSystem.ts L258-265)
- ✅ `AllianceSaveData` 不包含 TaskSystem 的 activeTasks (alliance.types.ts L318-324)
- ✅ 即使 P0-001 修复，TaskSystem 仍需独立序列化路径

**影响评估**: 任务进度、领取记录无法持久化。每日任务完成后存档丢失。

**修复优先级**: 🔴 最高 (与 P0-001 合并修复)

---

### P0-003: ✅ 确认 — AllianceShopSystem 无 serialize/deserialize

**源码验证**:
- ✅ AllianceShopSystem 无 serialize/deserialize 方法
- ✅ shopItems.purchased 是可变状态 (AllianceShopSystem.ts L78)
- ✅ getState() 返回快照但不是存档接口
- ✅ reset() 重置 purchased 但不恢复

**影响评估**: 商店限购状态无法持久化。玩家存档/读档后限购次数重置，可重复购买限购商品。

**修复优先级**: 🔴 最高 (与 P0-001 合并修复)

---

## P1 确认

| ID | 确认 | 源码验证 |
|----|------|----------|
| P1-001 | ✅ | AllianceSystem.ts L229: `Math.max(0, exp)` NaN→0 静默 |
| P1-002 | ✅ | AllianceBossSystem.ts L161: NaN damage→0 但消耗次数 |
| P1-003 | ✅ | AllianceTaskSystem.ts L175: `Math.max(0, progress)` NaN→0 |
| P1-004 | ✅ | AllianceTaskSystem.ts L192: `Math.max(0, contribution)` NaN→0 |
| P1-005 | ✅ | AllianceBossSystem.ts L56: allianceLevel<1 → maxHp 可为负 |
| P1-006 | ✅ | AllianceShopSystem.ts L147: count≤0 错误信息不准确 |

## P2 确认

| ID | 确认 | 备注 |
|----|------|------|
| P2-001 | ✅ | getLevelConfig 边界隐式 |
| P2-002 | ✅ | generateId 碰撞风险 |
| P2-003 | ✅ | 浅拷贝风险 |
| P2-004 | ✅ | 硬编码 playerId |

## 五维度评分

### D1: 流程覆盖度 (9.0/10)

- 61个公开API全部覆盖 F-Normal 节点 ✅
- 每个状态变更API都有 B-Boundary 节点 ✅
- 跨系统链路枚举 9 条 (要求: 4子系统×2=8) ✅
- 缺少: AllianceSystem 内部 `_alliance`/`_playerState` 状态管理的完整流程树 (-1.0)

### D2: 边界条件覆盖 (8.5/10)

- 名称长度边界覆盖 ✅
- 成员上限边界覆盖 ✅
- 置顶公告上限覆盖 ✅
- 消息截断边界覆盖 ✅
- 缺少: guildCoins 溢出/负数边界 (-0.5)
- 缺少: allianceLevel 极端值(0, 负数, 超大值) (-1.0)

### D3: 错误路径覆盖 (9.0/10)

- 权限不足路径全覆盖 ✅
- 重复操作路径(重复申请/重复领取)全覆盖 ✅
- 不存在实体(申请/商品/任务)路径全覆盖 ✅
- 缺少: currencySpendCallback 异常路径 (-0.5)
- 缺少: deserialize 损坏数据路径 (-0.5)

### D4: 数据安全 (7.0/10)

- NaN 绕过发现 4 处 (P1-001~P1-004) ✅
- 负值漏洞发现 2 处 (P1-005, P1-006) ✅
- engine-save 完全缺失 (P0-001) 🔴
- serialize 缺失 2 处 (P0-002, P0-003) 🔴
- 缺少: guildCoins 上限/溢出检查 (-1.0)
- 缺少: experience 溢出检查 (-1.0)

### D5: 跨系统一致性 (6.0/10)

- engine-save 六处全部缺失 🔴
- AllianceTaskSystem 序列化独立于 AllianceSaveData 🔴
- AllianceShopSystem 无序列化 🔴
- AllianceBossSystem getCurrentBoss 每次重建(无持久化) ⚠️
- 跨系统回调(currencyCallbacks)未在 finalizeLoad 中验证 (-1.0)
- 正面: AllianceHelper.serializeAlliance/deserializeAlliance 实现正确 (+1.0)

## R1 综合评分

| 维度 | 权重 | 得分 | 加权 |
|------|------|------|------|
| D1: 流程覆盖度 | 20% | 9.0 | 1.80 |
| D2: 边界条件覆盖 | 20% | 8.5 | 1.70 |
| D3: 错误路径覆盖 | 20% | 9.0 | 1.80 |
| D4: 数据安全 | 20% | 7.0 | 1.40 |
| D5: 跨系统一致性 | 20% | 6.0 | 1.20 |
| **总分** | **100%** | | **7.90** |

## 裁决结论

**R1 评分: 7.90/10 — 未达封版标准 (需 ≥ 9.0)**

**需要修复的 P0**:
1. P0-001: Alliance 接入 engine-save 六处 (SaveContext + GameSaveData + buildSaveData + applySaveData + toIGameState + fromIGameState)
2. P0-002: AllianceTaskSystem 添加 serialize/deserialize，接入 engine-save
3. P0-003: AllianceShopSystem 添加 serialize/deserialize，接入 engine-save

**P1 修复建议** (R2处理):
- 6个 P1 全部为 NaN/负值绕过，统一修复模式: 入口添加 `!Number.isFinite(x) || x <= 0` 检查

**下一步**: 进入 R1 Fixer 阶段，修复 3 个 P0 后重新评估。
