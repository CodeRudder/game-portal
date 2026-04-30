# 对抗式测试流程分支树方法论

> 版本: 1.0
> 日期: 2026-04-30
> 目的: 通过多Agent对抗枚举，系统性发现游戏测试流程遗漏

---

## 一、核心理念

传统测试覆盖率衡量的是"代码行是否被执行"，但无法回答"游戏玩法流程是否完备"。对抗式测试引入3个Agent角色，通过**构建→质疑→仲裁**的循环，逐步枚举完整的测试流程分支树。

### 1.1 三Agent角色

| 角色 | 职责 | 输出 |
|------|------|------|
| **TreeBuilder** (构建者) | 阅读引擎源码，枚举所有公开API的调用流程，构建DAG分支树 | 流程分支树JSON |
| **TreeChallenger** (挑战者) | 质疑树的完备性，寻找遗漏的边界条件、异常路径、跨系统交互 | 遗漏项列表 |
| **TreeArbiter** (仲裁者) | 评估构建者补充是否充分，挑战者的质疑是否合理，打分并决定是否进入下一轮 | 评分+裁决 |

### 1.2 对抗循环

```
Round N:
  1. TreeBuilder: 基于源码构建/补充流程分支树
  2. TreeChallenger: 从5个维度挑战完备性
  3. TreeArbiter: 评估本轮质量，打分(0-10)
  4. 如果分数 < 9.0，TreeBuilder根据挑战补充，进入Round N+1
  5. 如果分数 >= 9.0，该模块封版
```

### 1.3 五维度挑战框架

挑战者从以下5个维度系统性质疑：

| 维度 | 代号 | 关注点 |
|------|------|--------|
| **正常流程** | F-Normal | 主线业务流程是否完整枚举？ |
| **边界条件** | F-Boundary | 极值、空值、溢出、并发、时序边界 |
| **异常路径** | F-Error | 错误输入、资源不足、状态冲突、数据损坏 |
| **跨系统交互** | F-Cross | 系统间依赖、事件传播、状态同步 |
| **数据生命周期** | F-Lifecycle | 创建→读取→更新→删除→持久化→恢复 |

---

## 二、流程分支树数据结构

### 2.1 节点定义

```typescript
interface FlowNode {
  id: string;                    // 唯一标识: "hero-recruit-001"
  module: string;                // 所属模块: "hero"
  system: string;                // 所属系统: "HeroRecruitSystem"
  api: string;                   // 对应API: "recruitHero()"
  flowType: 'normal' | 'boundary' | 'error' | 'cross' | 'lifecycle';
  description: string;           // 流程描述
  preconditions: string[];       // 前置条件
  steps: string[];               // 执行步骤
  expectedOutcome: string;       // 预期结果
  branches: FlowBranch[];        // 分支
  testStatus: 'covered' | 'missing' | 'partial';  // 测试覆盖状态
  testFile?: string;             // 对应测试文件
  priority: 'P0' | 'P1' | 'P2'; // 优先级
}

interface FlowBranch {
  condition: string;             // 分支条件
  targetNodeId: string;          // 指向的节点ID
}
```

### 2.2 树结构

每个模块一棵树，根节点是模块入口，子节点是各系统的API流程。

---

## 三、迭代执行规范

### 3.1 每轮迭代输出

1. **TreeBuilder输出**: `adversarial/{module}/round-{N}-tree.json` — 更新后的流程树
2. **TreeChallenger输出**: `adversarial/{module}/round-{N}-challenges.md` — 挑战清单
3. **TreeArbiter输出**: `adversarial/{module}/round-{N}-verdict.md` — 评分和裁决

### 3.2 封版标准

- 仲裁者评分 >= 9.0
- 所有P0节点测试状态为 `covered`
- P1节点覆盖率 >= 90%
- 挑战者无法在5分钟内找到新的遗漏项

### 3.3 模块优先级排序

按游戏核心循环依赖关系：
1. **hero** (武将域) — 核心养成系统，被battle/campaign/expedition依赖
2. **battle** (战斗域) — 核心玩法循环
3. **campaign** (攻城域) — PVE主循环
4. **resource** → **building** → **tech** → **equipment** — 基础系统链
5. **shop** → **quest** → **event** → **mail** — 辅助系统
6. **alliance** → **pvp** → **expedition** — 社交/竞技
7. **settings** → **offline** → **heritage** → **prestige** — 元系统

---

## 四、度量体系

### 4.1 核心指标

| 指标 | 计算方式 | 目标 |
|------|----------|------|
| **节点覆盖率** | covered节点数 / 总节点数 | >= 95% |
| **分支覆盖率** | covered分支数 / 总分支数 | >= 90% |
| **P0覆盖率** | P0 covered / P0 total | 100% |
| **维度均衡度** | min(各维度覆盖) / max(各维度覆盖) | >= 0.7 |
| **遗漏发现率** | 每轮新发现遗漏数 | 单轮<2时封版 |

### 4.2 进化跟踪

每轮记录：
- 新增节点数
- 新发现遗漏数
- 修复遗漏数
- 评分变化曲线
- 累计覆盖率变化

---

## 五、与现有测试体系的关系

对抗式测试**不替代**现有测试，而是**补充**：

- **现有单元测试**: 验证单个函数/方法的行为正确性
- **现有集成测试**: 验证系统间交互
- **对抗式测试**: 发现**遗漏的测试场景**，生成新的测试用例

对抗式测试的输出是**测试用例清单**，由开发者决定是否编写为实际测试代码。

---

## 六、Agent角色详细Prompt模板

### TreeBuilder Prompt
```
你是测试流程分支树的构建者。阅读以下引擎源码，枚举所有公开API的调用流程。

要求：
1. 每个公开方法至少生成1个正常流程节点
2. 每个方法考虑边界条件（空值、极值、溢出）
3. 每个方法考虑异常路径（资源不足、状态冲突）
4. 考虑与其他系统的交互
5. 考虑数据的完整生命周期

输出格式：JSON流程分支树
```

### TreeChallenger Prompt
```
你是测试完备性的挑战者。审查以下流程分支树，从5个维度寻找遗漏：

1. F-Normal: 是否有未覆盖的主线流程？
2. F-Boundary: 是否遗漏了边界条件？
3. F-Error: 是否遗漏了异常路径？
4. F-Cross: 是否遗漏了跨系统交互？
5. F-Lifecycle: 是否遗漏了数据生命周期阶段？

对每个遗漏项，说明：
- 遗漏的节点ID或位置
- 具体遗漏内容
- 为什么这是重要的遗漏
- 建议的补充方式
```

### TreeArbiter Prompt
```
你是测试质量的仲裁者。评估本轮流程分支树的质量。

评分维度（每项0-10分）：
1. 完备性: 流程枚举是否全面？
2. 准确性: 流程描述是否准确？
3. 优先级: P0/P1/P2划分是否合理？
4. 可测试性: 每个节点是否可转化为测试用例？
5. 挑战应对: 对挑战者质疑的回应是否充分？

总分 = 加权平均
封版线: 9.0分
```
