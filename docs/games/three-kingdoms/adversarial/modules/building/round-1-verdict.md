# Building R1 Arbiter Verdict

> Arbiter: v1.6 | 模块: building | 时间: 2026-05-01
> 基于文档: round-1-tree.md + round-1-challenges.md + 源码审查

## 一、5维度评分

| 维度 | 权重 | 得分 | 评价 |
|------|------|------|------|
| 完备性 | 25% | 7.0 | 42个API中13个有NaN防护缺口，66个uncovered节点中27个P0 |
| 准确性 | 25% | 7.5 | covered标注经源码验证基本可靠；Challenger虚报率0%，4个降级基于深入分析 |
| 优先级 | 15% | 8.0 | P0/P1分配合理；NaN系统性问题正确识别为根因；batchUpgrade事务性正确标P0 |
| 可测试性 | 15% | 8.5 | 每个节点均可转化为测试用例；Challenger提供完整复现场景 |
| 挑战应对 | 20% | 6.5 | Builder未直接参与本轮（R1为Tree+Challenge首轮）；Tree覆盖64.1%偏低 |
| **加权总分** | | **7.2** | |

### 评分详细说明

**完备性 7.0**:
- 42个API入口全覆盖 ✅
- 13个NaN防护缺口全部识别 ✅
- 跨系统链路12条中10条covered，2条uncovered ⚠️
- 66个uncovered节点中27个P0未覆盖 ❌
- 缺少F-Cross维度的集成测试验证 ❌

**准确性 7.5**:
- Challenger 18个质疑中14个P0确认，0个虚报 ✅
- 4个P0降级为P1均有充分理由（`?.`隐式防御） ✅
- Tree中covered标注136个经源码交叉验证基本准确 ✅
- NaN防护全景表准确反映13个入口点状态 ✅
- BS-066(getCastleBonusMultiplier)在Tree中标P0但实际被`?.`防御，Challenger正确降级 ✅
- 扣分：Tree中部分covered标注依赖"隐含"测试而非直接测试 ⚠️

**优先级 8.0**:
- NaN系统性问题正确识别为根因，影响5个API入口 ✅
- deserialize null崩溃正确标P0（可玩性阻断） ✅
- batchUpgrade事务性正确标P0（经济一致性） ✅
- 推荐算法正确性标P1合理（不影响核心玩法） ✅
- 外观阶段NaN标P1合理（仅UI影响） ✅

**可测试性 8.5**:
- CH-007 NaN绕过：直接构造 `resources.grain = NaN` 即可复现 ✅
- CH-009 deserialize null：`bs.deserialize(null)` 一行复现 ✅
- CH-010 deserialize NaN：构造含 NaN level 的存档数据 ✅
- CH-001 batchUpgrade事务性：构造"资源仅够第一个"的场景 ✅
- 每个P0均有完整复现场景和修复建议 ✅

**挑战应对 6.5**:
- R1为Tree+Challenge首轮，Builder尚未参与 ⚠️
- Tree本身覆盖64.1%偏低 ❌
- 27个P0 uncovered节点待Builder修复 ❌
- 跨系统链路2条uncovered待处理 ⚠️

---

## 二、封版条件检查

| 条件 | 要求 | 当前 | 状态 |
|------|------|------|------|
| 评分 >= 9.0 | 9.0 | 7.2 | ❌ 不满足 |
| API覆盖率 >= 90% | 90% | 67.3% (136/202) | ❌ 不满足 |
| F-Cross覆盖率 >= 75% | 75% | 83.3% (10/12) | ✅ 满足 |
| F-Lifecycle覆盖率 >= 70% | 70% | ~60% (估算) | ❌ 不满足 |
| P0节点覆盖 = 100% | 100% | 50% (14/27 covered) | ❌ 不满足 |
| 虚报数 = 0 | 0 | 0 | ✅ 满足 |
| 最终轮新P0 = 0 | 0 | 14 (首轮) | ❌ 不满足 |
| 所有子系统覆盖 = 是 | 是 | 否 (BuildingRecommender 63.6%) | ❌ 不满足 |

**封版条件满足数: 2/8 → 判定: CONTINUE**

---

## 三、收敛预测

### R2预期改善

| 改善项 | 预期效果 |
|--------|---------|
| Builder修复NaN入口检查 | P0 covered 从 50% → 85%+ |
| Builder修复deserialize null guard | P0 covered +2 |
| Builder补充batchUpgrade事务性 | P0 covered +1 |
| Builder补充缺失测试 | API覆盖率 67% → 80%+ |
| Challenger R2验证修复 | 虚报率维持0% |

### 收敛信号评估

| 信号 | 当前 | R2预期 |
|------|------|--------|
| 评分差 < 0.5 | N/A（首轮） | 预计 +1.5~2.0 |
| 新P0 = 0 | 14个新P0 | 预计 0~2个 |
| 节点增量 < 30 | 202个节点 | 预计 +15~25 |
| Challenger无新P0 | N/A | 取决于修复质量 |

**收敛预测**: R2预计评分 8.5~9.0，R3可达封版线。关键路径是NaN系统性修复的完整性。

---

## 四、P0 修复优先级排序

| 优先级 | 质疑ID | 描述 | 修复复杂度 | 影响范围 |
|--------|--------|------|-----------|---------|
| 🔴 1 | CH-007 | checkUpgrade NaN绕过 | 低（加3行guard） | 5个API入口 |
| 🔴 2 | CH-009 | deserialize null崩溃 | 低（加null guard） | 存档加载 |
| 🔴 3 | CH-010 | deserialize NaN传播 | 低（加Number.isFinite验证） | 全局计算链 |
| 🔴 4 | CH-013 | batchUpgrade NaN绕过 | 低（入口guard） | 批量升级 |
| 🔴 5 | CH-001 | batchUpgrade无事务回滚 | 中（需设计回滚机制） | 批量升级 |

**修复建议**: CH-007/CH-013 共享同一根因（NaN比较绕过），可统一修复。建议在 `checkUpgrade` 入口增加统一的 NaN 防护，而非在每个调用点分别打补丁。

---

## 五、Arbiter 独立发现（~10%补充）

### AD-001: startUpgrade 中 `!` 非空断言风险

- **源码**: `BuildingSystem.ts:143` — `const cost = this.getUpgradeCost(type)!`
- **问题**: `getUpgradeCost` 返回类型为 `UpgradeCost | null`，使用 `!` 强制断言非空。虽然前面有 `checkUpgrade` 检查，但在并发场景（如 tick() 在 check 和 start 之间触发）下，`getUpgradeCost` 可能返回 null。
- **建议**: 改为 `const cost = this.getUpgradeCost(type); if (!cost) throw new Error('...')`

### AD-002: tick() 中 level += 1 无上界检查

- **源码**: `BuildingSystem.ts:174` — `state.level += 1`
- **问题**: tick() 完成升级时直接 `level += 1`，不检查是否超过 maxLevel。若因 bug 导致重复 tick（如 endTime 被篡改），level 可能超过 maxLevel。
- **建议**: 增加 `if (state.level < BUILDING_MAX_LEVELS[slot.buildingType]) state.level += 1`

### AD-003: upgradeQueue 与 buildings 状态不同步风险

- **源码**: `BuildingSystem.ts` — upgradeQueue 和 buildings 各自维护 upgrading 状态
- **问题**: `startUpgrade` 同时修改 `buildings[type].status` 和 `upgradeQueue`，但 `cancelUpgrade` 先修改 buildings 再过滤 queue。若过滤过程中异常，两者不一致。
- **建议**: 考虑将 queue 作为 buildings 状态的派生数据，而非独立维护

---

## 六、三Agent复盘

### Builder 表现

| 维度 | 评价 |
|------|------|
| 覆盖率 | 64.1%偏低，202个节点中66个uncovered |
| P0识别 | 27个P0节点正确标记 |
| 测试质量 | 已有测试（1,534行）覆盖核心路径 |
| **改进建议** | R2应优先修复5个P0系统性问题，补充NaN防护测试 |

### Challenger 表现

| 维度 | 评价 |
|------|------|
| 质疑数量 | 18个质疑，覆盖5个维度 |
| P0准确率 | 14/18 = 77.8%（4个降级为P1） |
| 虚报率 | 0%（无虚假P0） |
| 复现质量 | 5个核心P0均有完整复现场景 |
| **改进建议** | R2应重点验证Builder的修复是否穿透到调用链底层 |

### Arbiter 独立发现

| 维度 | 评价 |
|------|------|
| 补充发现 | 3个额外问题（AD-001~003） |
| 与Challenger重叠 | 0%（完全独立） |
| **改进建议** | R2应关注 startUpgrade 的 `!` 断言和 tick 的上界检查 |

---

## 七、规则进化建议

| 建议 | 目标规则 | 描述 |
|------|---------|------|
| RE-001 | challenger-rules.md | 新增"隐式防护验证"维度：`?.` 和 `??` 提供的NaN防护需标注为"隐式防护"而非"无防护"，降低虚报率 |
| RE-002 | arbiter-rules.md | 新增AR-014"非空断言审查"：所有 `!` 非空断言必须验证前置条件是否充分 |
| RE-003 | arbiter-rules.md | 新增AR-015"状态同步审查"：多个数据源维护同一状态时，必须验证一致性保障 |

---

## 八、可玩性评估

| 维度 | 得分 | 评价 |
|------|------|------|
| 趣味性 | 7.0 | 建筑升级+队列+推荐系统提供策略深度 |
| 进度平衡 | 7.5 | 等级曲线设计合理，主城前置条件增加节奏感 |
| 经济平衡 | 6.5 | NaN绕过可能导致无限升级（P0），需修复后重新评估 |
| 玩家体验 | 7.0 | 外观演进提供视觉反馈，但NaN导致UI显示错误 |
| 系统一致性 | 6.0 | batchUpgrade事务性缺失+NaN传播影响系统一致性 |
| **加权总分** | **6.8** | |

### 可玩性阻断项

| 阻断项 | 影响 | 优先级 |
|--------|------|--------|
| NaN绕过资源检查 | 玩家可免费升级所有建筑 | 🔴 阻断 |
| deserialize null崩溃 | 存档损坏时游戏无法启动 | 🔴 阻断 |
| batchUpgrade无回滚 | 批量升级资源不一致 | 🟡 降级体验 |

---

## 最终裁定

| 项目 | 结果 |
|------|------|
| **判定** | **CONTINUE** |
| **下一轮** | R2: Builder修复 → Challenger验证 → Arbiter复审 |
| **R2重点** | NaN系统性修复（CH-007/013）、deserialize防护（CH-009/010）、batchUpgrade事务性（CH-001） |
| **预计封版轮次** | R3 |
| **当前评分** | 7.2 / 10 |
| **封版评分差** | -1.8 |
