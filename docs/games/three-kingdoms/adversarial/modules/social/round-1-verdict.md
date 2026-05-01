# Social 模块 R1 对抗式测试 — Arbiter 仲裁裁决

> 生成时间: 2025-07-11 (R1 正式版)
> 仲裁范围: Builder 测试树 + Challenger 挑战报告
> 仲裁标准: 5 维度评分 (每维度 0-10 分)

---

## 1. 维度评分

### 1.1 Normal Flow (正常流程覆盖) — 9/10

**评分依据**:
- 所有 59 个公开 API 均有 F-Normal 节点 ✅
- 好友 CRUD 全流程覆盖 ✅
- 互动三件套 (赠送/拜访/切磋) 正常路径覆盖 ✅
- 借将/归还正常路径覆盖 ✅
- 聊天四频道正常路径覆盖 ✅
- 排行榜增删改查正常路径覆盖 ✅
- 赛季结算正常路径覆盖 ✅

**扣分项**:
- LeaderboardSystem 无 serialize/deserialize 正常路径 (-1)

### 1.2 Boundary Conditions (边界条件) — 8/10

**评分依据**:
- 好友上限 50 → 已覆盖 ✅
- 每日申请 20 → 已覆盖 ✅
- 待处理申请 30 → 已覆盖 ✅
- 删除冷却 24h → 已覆盖 ✅
- 互动每日限制 (10/5/3) → 已覆盖 ✅
- 借将每日 3 次 → 已覆盖 ✅
- 发言间隔 (10s/5s/3s) → 已覆盖 ✅
- 消息容量上限 (100/50) → 已覆盖 ✅
- 排行榜容量 1000 → 已覆盖 ✅
- 分页 pageSize 上限 20 → 已覆盖 ✅

**扣分项**:
- friendshipPoints 无上限常量 (-1)
- sendMessage content 无空字符串校验 (-0.5)
- playerName/playerId 无空字符串校验 (-0.5)

### 1.3 Error Paths (错误路径) — 6/10

**评分依据**:
- 好友不存在 → throw ✅
- 申请不存在 → throw ✅
- 已是好友 → throw ✅
- 系统频道权限 → throw ✅
- 禁言中发言 → throw ✅
- 发言间隔 → throw ✅
- 已归还再归还 → throw ✅

**扣分项**:
- NaN 传入 now 参数 → 3 个子系统均未防护 (-2)
- NaN/Infinity 传入 score → 未防护 (-1)
- 自申请/自借 → 未防护 (-0.5)
- deserialize 版本不匹配 → 静默丢弃 (-0.5)

### 1.4 Cross-System Interactions (跨系统交互) — 3/10

**评分依据**:
- FriendSystem → BorrowHeroHelper 委托链路 ✅
- FriendSystem → FriendInteractionHelper 委托链路 ✅
- FriendSystem ↔ ChatSystem 共享 SocialState ✅

**严重扣分项**:
- **Social 模块完全未接入 engine-save** (-5) — BR-014/BR-024 直接违反
- LeaderboardSystem 无 serialize/deserialize (-1)
- LeaderboardSystem 与 SocialState 无关联 (-0.5)
- ChatSystem.serializeChat 与 FriendSystem.serialize 路径重叠/冲突 (-0.5)

### 1.5 Data Lifecycle (数据生命周期) — 3/10

**评分依据**:
- FriendSystem.serialize/deserialize 存在 ✅
- ChatSystem.serializeChat/deserializeChat 存在 ✅
- dailyReset 重置每日计数 ✅

**严重扣分项**:
- **GameSaveData 无 social 字段** → 保存时数据丢失 (-4)
- **buildSaveData 未调用 Social serialize** → 加载时数据丢失 (-2)
- **LeaderboardSystem 无序列化** → 排行榜无法持久化 (-1)

---

## 2. 总分计算

| 维度 | 权重 | 得分 | 加权分 |
|------|------|------|--------|
| Normal Flow | 20% | 9 | 1.8 |
| Boundary Conditions | 20% | 8 | 1.6 |
| Error Paths | 20% | 6 | 1.2 |
| Cross-System Interactions | 20% | 3 | 0.6 |
| Data Lifecycle | 20% | 3 | 0.6 |
| **总分** | **100%** | — | **5.8/10** |

---

## 3. 裁决结论

### R1 评分: 5.8/10 — **未达封版标准 (≥9.0)**

### 必须修复的 P0 (阻塞封版)

| 优先级 | 编号 | 问题 | 修复类型 |
|--------|------|------|---------|
| **P0-1** | P0-01 | engine-save 未接入 Social | 架构修复 (六处同步) |
| **P0-2** | P0-02 | updateScore NaN/Infinity/负数 | 入口校验 |
| **P0-3** | P0-03 | getState() 返回可变引用 | 深拷贝 |
| **P0-4** | P0-04 | getTodayInteractions NaN 绕过 | 入口校验 |
| **P0-5** | P0-05 | sendMessage NaN 绕过 | 入口校验 |

### 建议修复的 P0 (提升评分)

| 优先级 | 编号 | 问题 | 修复类型 |
|--------|------|------|---------|
| P1 | P0-06 | 自申请校验 | 逻辑校验 |
| P1 | P0-07 | 自借将校验 | 逻辑校验 |
| P1 | P0-08 | deserialize 版本迁移 | 数据安全 |
| P1 | P0-09 | metadata 浅拷贝 | 引用安全 |
| P1 | P0-10 | friendshipPoints 上限 | 游戏平衡 |
| P1 | P0-11 | LeaderboardSystem serialize | 数据持久化 |

### 修复后预期评分

如果修复全部 11 个 P0：
- Normal Flow: 10/10 (+1)
- Boundary Conditions: 9/10 (+1)
- Error Paths: 9/10 (+3)
- Cross-System: 9/10 (+6)
- Data Lifecycle: 9/10 (+6)
- **预期总分: 9.2/10** → 可封版

### 修复范围评估

P0-01 (engine-save 接入) 是架构级修复，需要修改 6 处文件：
1. `shared/types.ts` — GameSaveData 添加 social/leaderboard 字段
2. `engine-save.ts` — buildSaveData 调用 serialize
3. `engine-save.ts` — applySaveData 调用 deserialize
4. `engine-save-migration.ts` — toIGameState/fromIGameState 同步
5. `LeaderboardSystem.ts` — 添加 serialize/deserialize 方法
6. `engine-extended-deps.ts` — 确认 deps 传递

P0-02~P0-05 是入口校验修复，每个 1-3 行代码。
P0-06~P0-07 是逻辑校验修复，每个 1-2 行代码。

### 下一步

进入 **R1 Fixer** 阶段，修复全部 11 个 P0 后重新评估。
