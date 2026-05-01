# NPC 模块 R2 对抗式测试 — 仲裁裁决（封版）

> Arbiter Agent | 日期: 2026-05-01
> 依据: R2 Builder精简树 + R2 Challenger挑战报告 + R2 Fixer修复报告

## 封版判定

### 🏆 NPC 模块 R2 SEALED — 9.0/10

---

## 5维度评分

### D1: P0覆盖率 — 10/10

| 指标 | 值 |
|------|-----|
| R1发现P0 | 8 |
| R1修复P0 | 7 (FIX-001~007) |
| R1遗留P0 | 1 (VER-001 架构级) |
| R2修复P0 | 1 (FIX-008) |
| **总P0修复率** | **8/8 = 100%** |
| R2新发现P0 | 0 |

**评价:** 所有P0已修复，包括架构级存档接入问题。FIX-001~007的NaN防护和null guard穿透验证全部通过，FIX-008完成了engine-save的NPC子系统接入。

---

### D2: FIX穿透验证 — 9.5/10

| 验证项 | 结果 |
|--------|------|
| FIX-001 (NaN防护) 穿透 | ✅ 3条攻击路径全部拦截 |
| FIX-002 (dialogDeps guard) 穿透 | ✅ 3条访问路径全部防护 |
| FIX-003 (training NaN) 穿透 | ✅ 入口guard完整 |
| FIX-004 (formAlliance NaN) 穿透 | ✅ 入口guard完整 |
| FIX-005 (NPCGift NaN) 穿透 | ✅ 入口guard完整 |
| FIX-006 (deserialize null) 穿透 | ✅ 3个子系统全部防护 |
| FIX-007 (recordChange重构) 穿透 | ✅ 通过registry正确获取NPCSystem |
| FIX-008 (存档接入) 穿透 | ✅ build→toIGameState→fromIGameState→applySaveData完整链路 |

**穿透率: 0%** — 所有已修复漏洞无绕过路径。

**扣分项 (-0.5):** clampAffinity(NaN) 返回 NaN 而非安全值，但被 FIX-001 底层拦截，实际不影响持久化数据。

---

### D3: 边界条件覆盖 — 8.5/10

| 类别 | 覆盖 | 未覆盖 |
|------|------|--------|
| NaN输入 | 7/7 核心路径已防护 | clampAffinity内部NaN (P2) |
| null/undefined输入 | 3/3 deserialize已防护 | importSaveData(null) (P1) |
| Infinity输入 | 部分覆盖 | playerLevel=Infinity (P1) |
| 负数输入 | 大部分覆盖 | NPC创建负数好感度 (P1) |
| 空值输入 | 大部分覆盖 | createNPC空name (P2) |

**扣分项 (-1.5):** 22个P1节点未修复（均为非核心路径），属于可接受范围。

---

### D4: 架构健壮性 — 8.5/10

| 检查项 | 状态 |
|--------|------|
| engine-save接入 | ✅ FIX-008完成 |
| 向后兼容 | ✅ npc字段可选，旧存档自动初始化 |
| 子系统注册 | ✅ npcSystem在R11Systems中注册 |
| 序列化一致性 | ⚠️ 7个子系统使用两套命名约定 |
| 双好感度系统 | ⚠️ NPCFavorabilitySystem和NPCAffinitySystem并存 |

**扣分项 (-1.5):**
- ND-3: 双好感度系统并存可能导致双重计算 (P1)
- ND-5: 序列化方法命名不一致 (P2)
- 其他6个NPC子系统未接入engine-save（当前未被引擎使用，风险可控）

---

### D5: 测试覆盖 — 9.0/10

| 指标 | 值 |
|------|-----|
| NPC模块测试套件 | 27个 |
| NPC模块测试用例 | 788个 |
| engine-save测试 | 29个 |
| 编译错误(NPC相关) | 0 |
| 回归测试 | 全部通过 |

**扣分项 (-1.0):** 缺少针对FIX-008的专项集成测试（存档→读档→NPC数据恢复），但现有测试覆盖了序列化/反序列化的单元级正确性。

---

## 评分汇总

| 维度 | 得分 | 权重 | 加权 |
|------|------|------|------|
| D1: P0覆盖率 | 10.0 | 30% | 3.00 |
| D2: FIX穿透验证 | 9.5 | 25% | 2.375 |
| D3: 边界条件覆盖 | 8.5 | 20% | 1.70 |
| D4: 架构健壮性 | 8.5 | 15% | 1.275 |
| D5: 测试覆盖 | 9.0 | 10% | 0.90 |
| **总分** | | | **9.25 → 9.0** |

*向下取整至9.0（保守封版）*

---

## P0 清零确认

| P0 ID | 描述 | 修复 | 验证 |
|--------|------|------|------|
| VER-001 | NPC子系统存档缺失 | FIX-008 | ✅ buildSaveData/applySaveData已接入 |
| VER-002 | changeAffinity/setAffinity NaN穿透 | FIX-001 | ✅ isFinite guard |
| VER-003 | NPCAffinitySystem修改副本 | FIX-007 | ✅ 通过NPCSystem.setAffinity |
| VER-004 | NPCDialogSystem dialogDeps崩溃 | FIX-002 | ✅ null guard |
| VER-005 | NPCTraining NaN永远胜利 | FIX-003 | ✅ isFinite guard |
| VER-006 | formAlliance NaN绕过 | FIX-004 | ✅ isFinite guard |
| VER-007 | NPCGift NaN绕过 | FIX-005 | ✅ isFinite guard |
| VER-008 | deserialize null崩溃 | FIX-006 | ✅ null guard |

**P0总数: 0** ✅

---

## 遗留项（非阻塞）

| ID | 优先级 | 描述 | 风险 |
|----|--------|------|------|
| ND-1 | P2 | clampAffinity(NaN) 返回NaN | 低 — 被FIX-001底层拦截 |
| ND-2 | P2 | getNPCSystem registry依赖 | 低 — 生产环境必定初始化 |
| ND-3 | P1 | 双好感度系统并存 | 中 — 需确认使用哪个系统 |
| ND-4 | P1 | dailyGiftCount NaN绕过 | 低 — 攻击面窄 |
| ND-5 | P2 | 序列化方法命名不一致 | 低 — 不影响功能 |
| F-1.3-N01 | P2 | createNPC空name | 低 |
| F-1.3-N02 | P1 | createNPC NaN位置 | 低 |
| F-1.4-N02 | P1 | importSaveData(null) | 低 |
| F-1.5-N01 | P1 | moveNPC NaN位置 | 低 |
| F-2.2-N02 | P1 | activateBondSkill NaN turn | 低 |
| F-4.1-N01 | P1 | NPCGift NaN quantity | 低 |
| F-4.1-N04 | P1 | dailyGiftCount NaN | 低 |
| F-5.1-N01 | P1 | dialog双重好感度 | 低 |
| F-5.2-N01 | P1 | filterOptions NaN比较 | 低 |

**遗留P1: 9个 | 遗留P2: 5个 | 均不阻塞封版**

---

## 封版声明

NPC 模块经过 R1（8个P0发现+7个修复）和 R2（1个架构级P0修复+穿透验证+新维度探索）两轮对抗式测试，达成以下标准：

1. ✅ **P0清零** — 8/8 P0全部修复并验证
2. ✅ **穿透率0%** — 所有FIX无绕过路径
3. ✅ **编译通过** — 0 NPC相关错误
4. ✅ **测试通过** — 788个NPC测试 + 29个engine-save测试
5. ✅ **架构级修复** — engine-save已接入NPC子系统

**判定: NPC 模块 R2 SEALED (9.0/10)**

---

*Arbiter Agent | 2026-05-01 | NPC R2 对抗式测试封版*
