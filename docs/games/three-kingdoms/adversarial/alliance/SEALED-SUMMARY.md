# 联盟模块对抗式测试 — 最终封版摘要

> **模块**: alliance (联盟系统)  
> **封版轮次**: 2 (R1+R2)  
> **最终评分**: 9.2/10  
> **封版状态**: ✅ SEALED  
> **测试文件**: `alliance/__tests__/adversarial/alliance-adversarial.test.ts`  
> **测试用例**: 78个自动化用例 (全部通过)

---

## 产出文件清单

| 文件 | 说明 |
|------|------|
| `R1-builder-tree.md` | R1 Builder测试分支树 (154节点) |
| `R1-challenger-report.md` | R1 Challenger五维度挑战 (34遗漏) |
| `R1-arbiter-verdict.md` | R1 Arbiter裁决 (7.1/10, 驳回) |
| `R2-builder-tree-supplement.md` | R2 Builder补充树 (80新节点) |
| `R2-challenger-report.md` | R2 Challenger二次挑战 (8遗漏, 0个P0) |
| `R2-arbiter-verdict-sealed.md` | R2 Arbiter封版裁决 (9.2/10, 通过) |
| `alliance-adversarial.test.ts` | 自动化测试 (78用例, 全部通过) |

---

## 发现的BUG清单

### P0 (阻塞级)
无运行时崩溃BUG，但存在设计缺陷。

### P1 (严重)
| BUG ID | 描述 | 测试用例 |
|--------|------|---------|
| BUG-001 | 联盟解散死锁：盟主无法退出，仅剩1人时无法转让 | P0-1.1, P0-1.4 |
| BUG-002 | createAllianceSimple硬编码playerId='player-1' | P0-2.1, P0-2.3 |
| BUG-003 | kickMember不清理被踢者playerState.allianceId | P0-4.2 |
| BUG-004 | approveApplication不检查申请人是否已有联盟 | P0-5.1 |
| BUG-005 | getCurrentBoss每次重建丢失运行时状态 | P1-4 |
| BUG-009 | getLevelConfig(NaN/undefined)返回undefined | NaN边界测试 |
| BUG-010 | challengeBoss damage=NaN → actualDamage=NaN | NaN边界测试 |
| BUG-011 | deserialize purchased=NaN → purchased仍为NaN | NaN边界测试 |

### P2 (一般)
| BUG ID | 描述 | 测试用例 |
|--------|------|---------|
| BUG-006 | createAllianceSimple先创建后扣费(代码已正确处理) | P1-11 |
| BUG-007 | damage=0仍获公会币(设计意图待确认) | P1-6 |
| BUG-008 | CLAIMED状态定义但未使用 | 代码审查 |

---

## 维度覆盖

| 维度 | 得分 | 覆盖率 |
|------|------|--------|
| F-Normal | 9.4/10 | 97% |
| F-Boundary | 9.2/10 | 96% |
| F-Error | 9.0/10 | 95% |
| F-Cross | 9.3/10 | 97% |
| F-Lifecycle | 9.1/10 | 96% |
| **综合** | **9.2/10** | **96%** |

---

## 进化规则归档

### Builder规则
- RULE-001: 联盟模块必须覆盖解散路径和死锁检测
- RULE-002: 涉及playerState的操作必须检查双向一致性
- RULE-003: 硬编码值必须作为边界条件覆盖
- RULE-004: 重建型API必须验证运行时状态保持
- RULE-005: 先操作后扣费模式必须验证回滚机制
- RULE-006: JS中NaN输入必须作为边界条件覆盖(Math.max(0,NaN)=NaN)

### P0 Pattern Library
- PATTERN-001: 解散死锁
- PATTERN-002: 硬编码ID
- PATTERN-003: 双重计数器不一致
- PATTERN-004: 踢人不清理外部状态
- PATTERN-005: 审批不检查前置条件
- PATTERN-006: 解散无级联清理
- PATTERN-007: NaN穿透(Math.max/Math.min不处理NaN)
