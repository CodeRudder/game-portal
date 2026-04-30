# Hero 挑战清单 Round 1 — 汇总

> Challenger: TreeChallenger | Time: 2026-05-01
> 审查对象: Part A (245节点) + Part B (257节点) + Part C (243节点) = 745节点

## 挑战总结

| 指标 | Builder声称 | Challenger评估 | 差距 |
|------|-----------|--------------|------|
| 总节点 | 745 | ~745 | 0 |
| 新增P0遗漏 | 0 | 41 | +41 |
| 虚报率 | 0% | 4-8% | 发现虚报 |

## 最严重发现（系统性P0）

### 1. NaN绕过 <= 0 检查（系统性问题）
- 影响5+处：calculatePower、addExp、calculateTotalExp、calculateOfflineReward、tick
- JavaScript中 NaN <= 0 返回false，所有使用 if(x<=0) 防护的代码被NaN绕过
- 修复：使用 !Number.isFinite(x) || x <= 0

### 2. 三套羁绊系统并存（架构缺陷）
- engine/bond/BondSystem（旧规则）
- hero/BondSystem（新规则）
- hero/FactionBondSystem（新规则）
- 战力公式中羁绊系数永远为1.0（setBondMultiplierGetter从未被调用）

### 3. 6名RARE武将碎片获取路径断裂
- 鲁肃/黄盖/甘宁/徐晃/张辽/魏延无商店兑换配置无关卡掉落配置

### 4. useFragments负值漏洞（经济漏洞）
- useFragments(generalId, -100) 凭空增加碎片

### 5. deserialize(null)系统性缺失
- 所有子系统deserialize方法均无null防护

## 详细内容

- Part A: round-1-challenges-partA.md（核心子系统）
- Part B: round-1-challenges-partB.md（辅助子系统）
- Part C: round-1-challenges-partC.md（编队配置）
