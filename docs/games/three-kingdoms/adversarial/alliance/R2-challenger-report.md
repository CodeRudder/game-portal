# R2 Challenger — 联盟模块二次挑战报告

> **模块**: alliance (联盟系统)
> **轮次**: R2 (二次挑战)
> **挑战者**: TreeChallenger Agent
> **审阅对象**: R1-builder-tree.md + R2-builder-tree-supplement.md

---

## 总体评估
- **覆盖率评分**: 9.0/10
- **发现遗漏数**: 8
- **P0遗漏**: 0, **P1遗漏**: 3, **P2遗漏**: 5

---

## 维度分析

### F-Normal: 主线流程完整性

#### 遗漏点R2-1 [P2] 联盟名称空白字符
**描述**: R2补充了特殊字符测试(P2-6)，但未覆盖纯空白字符场景。name="  "（空格）长度为2，通过长度检查但语义为空。

**建议测试用例**:
```
- name="  " (2个空格) → 创建成功(长度=2)
- name="  " → 是否应该被允许?
```

#### 遗漏点R2-2 [P2] setRole设置为MEMBER
**描述**: R1覆盖了设置LEADER的拒绝场景(N-29)，但未覆盖ADVISOR→MEMBER和MEMBER→ADVISOR的正常场景是否都能正确执行。

**建议测试用例**:
```
- ADVISOR → MEMBER → 验证role变更
- MEMBER → ADVISOR → 验证role变更
```

### F-Boundary: 边界条件覆盖

#### 遗漏点R2-3 [P1] getLevelConfig level=NaN/undefined
**描述**: R2补充了level=0和负数场景，但未覆盖level为NaN或undefined的情况。`Math.min(undefined, 7)` 返回NaN，`NaN - 1` = NaN，`Math.max(0, NaN)` = 0，最终返回level=1的配置。行为正确但需验证。

**建议测试用例**:
```
- getLevelConfig(NaN) → 返回level=1配置
- getLevelConfig(undefined) → 返回level=1配置
```

#### 遗漏点R2-4 [P2] AlliancePlayerState字段缺失
**描述**: `createDefaultAlliancePlayerState`创建默认状态时，所有字段都有初始值。但如果反序列化的数据缺少某些字段（如旧版存档没有weeklyRetroactiveCount），展开运算符不会补充缺失字段。

**建议测试用例**:
```
- 反序列化缺少weeklyRetroactiveCount的旧存档 → playerState.weeklyRetroactiveCount = undefined
```

### F-Error: 异常路径覆盖

#### 遗漏点R2-5 [P1] AllianceBossSystem.challengeBoss中damage为NaN
**描述**: `Math.max(0, Math.min(NaN, boss.currentHp))` → `Math.max(0, NaN)` → 0。damage=NaN时actualDamage=0，但后续仍消耗次数和获得公会币。

**建议测试用例**:
```
- damage=NaN → actualDamage=0 → 消耗次数 → 获得公会币
- 是否应该抛出异常?
```

#### 遗漏点R2-6 [P1] AllianceShopSystem.deserialize中purchased为NaN
**描述**: `item.purchased = Math.max(0, saved.purchased)` — 如果saved.purchased是NaN，Math.max(0, NaN) = 0，行为正确但需验证。

**建议测试用例**:
```
- saved.purchased = NaN → item.purchased = 0
- saved.purchased = -5 → item.purchased = 0
```

### F-Cross: 跨系统交互覆盖

#### 遗漏点R2-7 [P2] 联盟升级经验累积精度
**描述**: `addExperience`使用简单加法累积experience。如果多次调用addExperience传入浮点数(如Boss贡献的浮点数)，可能产生浮点精度问题。

**建议测试用例**:
```
- 多次addExperience(0.1) → 10次后experience应为1.0
- 验证浮点精度是否影响升级判断
```

### F-Lifecycle: 数据生命周期覆盖

#### 遗漏点R2-8 [P2] AllianceData.messages的持久化
**描述**: messages数组在序列化时通过`{ ...alliance }`浅拷贝。但messages中的对象引用在反序列化后是否独立？

**建议测试用例**:
```
- 序列化 → 修改原messages → 反序列化的messages不受影响
```

---

## 对R1遗漏覆盖情况的确认

| R1遗漏 | R2是否覆盖 | 覆盖质量 |
|--------|-----------|---------|
| #1 联盟解散死锁 | ✅ P0-1.1~1.6 | 完整 |
| #2 硬编码ID | ✅ P0-2.1~2.5 | 完整 |
| #3 名称唯一性 | ✅ P1-1.1~1.2 | 完整 |
| #5 审批半完成 | ✅ P1-2.1~2.2 | 完整 |
| #6 宣言验证 | ✅ P1-3.1~3.2 | 完整 |
| #8 Boss双重检查 | ✅ P0-3.1~3.5 | 完整 |
| #10 getCurrentBoss | ✅ P1-4.1~4.2 | 完整 |
| #11 批量购买 | ✅ P1-5.1~5.3 | 完整 |
| #15 kickMember清理 | ✅ P0-4.1~4.5 | 完整 |
| #16 双重联盟 | ✅ P0-5.1~5.4 | 完整 |
| #17 damage=0 | ✅ P1-6.1~6.3 | 完整 |
| #21 浮点精度 | ✅ P1-7.1~7.3 | 完整 |
| #22 重置vs刷新 | ✅ P1-8.1~8.3 | 完整 |
| #23 序列化往返 | ✅ P1-9.1~9.3 | 完整 |
| #24 升级Boss HP | ✅ P1-10.1~10.2 | 完整 |
| #25 无回滚 | ✅ P1-11.1~11.2 | 完整 |
| #26 解散清理 | ✅ P0-6.1~6.5 | 完整 |
| #27 退出重申请 | ✅ P1-12.1~12.2 | 完整 |
| #28 转让贡献 | ✅ P1-13.1~13.2 | 完整 |

**R1遗漏覆盖率: 19/19 = 100%**

---

## 维度均衡度分析

| 维度 | R1+R2节点数 | R2遗漏数 | 覆盖充分度 |
|------|-----------|---------|-----------|
| F-Normal | 92 | 2 | 97% |
| F-Boundary | 48 | 2 | 96% |
| F-Error | 40 | 2 | 95% |
| F-Cross | 30 | 1 | 97% |
| F-Lifecycle | 24 | 1 | 96% |

**均衡度**: 各维度覆盖充分度在95%~97%之间，方差极小。

---

## 建议新增的测试用例

### P1 (强烈建议)
1. getLevelConfig(NaN/undefined) 边界测试 (遗漏点R2-3)
2. challengeBoss damage=NaN 测试 (遗漏点R2-5)
3. deserialize purchased=NaN 测试 (遗漏点R2-6)

### P2 (建议补充)
4. 联盟名称纯空白字符测试 (遗漏点R2-1)
5. setRole双向变更测试 (遗漏点R2-2)
6. 反序列化旧存档字段缺失测试 (遗漏点R2-4)
7. 经验累积浮点精度测试 (遗漏点R2-7)
8. messages序列化独立性测试 (遗漏点R2-8)

---

## 最终评估

Builder在R2中完整覆盖了R1 Arbiter指出的所有P0和P1遗漏。R2新发现的遗漏均为P1/P2级别，无P0遗漏。

**推荐封版**: ✅ 达到封版标准
