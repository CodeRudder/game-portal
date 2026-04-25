# 代码质量检查规则

> **来源**: EVO-001,005,054 等及评测经验。
> **进化**: 代码审查发现新模式时新增。

---

## P0 规则

### CQ-01: 提取即删除
- 代码提取/迁移后，必须立即删除原文件中的重复代码
- **来源**: EVO-001

### CQ-02: as any 零容忍（引擎层）
- engine/ 目录不允许新增 `as any`
- 已有的必须在发现后 2 轮内消除
- 修复优先级: 扩展接口 > 泛型/联合类型 > 精确类型断言 > 全局类型扩展
- 检查: `grep -rn "as any" src/engine/`
- **来源**: EVO-054

---

## P1 规则

### CQ-03: 废弃即清理
- @deprecated 标记后必须在下一轮完成删除
- 重构后 `grep` 验证零引用再删除废弃文件
- **来源**: EVO-005, EVO-053

### CQ-04: 废弃目录全局扫描
- 每次重构后 `find . -name "bak" -type d` 全局扫描
- **来源**: EVO-026

### CQ-05: 禁止模式
- alert() / prompt() / Math.random() 伪造 / engine: any
- 检查: grep 扫描 src/components/idle/
- **来源**: 评测规范

---

## P2 规则

### CQ-06: 子任务粒度控制
- 单个子任务代码变更：业务代码≤500行，测试≤1000行
- 超过则拆分为多个子任务
- **来源**: EVO-012, EVO-016, EVO-018

### CQ-07: 函数签名冲突检测
- 同名函数在不同模块中存在时，明确权威版本和委托关系
- 禁止两个模块各自独立实现相同逻辑
- **来源**: EVO-057

---

## 检查命令

```bash
# as any 扫描
grep -rn "as any" src/games/three-kingdoms/engine/

# 禁止模式
grep -rn "alert(\|prompt(\|Math.random()" src/components/idle/ --include="*.tsx"

# 废弃目录
find . -name "bak" -type d

# 废弃导出文件
find src/ -name "exports-v*" -type f
```

---

## 进化记录

| 日期 | 变更 | 来源 |
|------|------|------|
| 2026-04-23 | 从进化规则抽取 | 文档重构 |
