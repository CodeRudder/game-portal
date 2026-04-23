# 架构合规检查规则

> **来源**: EVO-001,005,008,009,010,015,017,046~048,053~055 等。
> **进化**: 架构审查发现新模式时新增。

---

## P1 规则

### ARCH-01: 文件行数限制
- 硬限制 ≤500 行，预警线 400 行
- 检查: `find src/ -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -20`
- **来源**: EVO-009, EVO-047

### ARCH-02: DDD 单向依赖
- 依赖方向: UI → Engine → SubSystem → Config，禁止反向
- 检查: import 语句审查
- **来源**: DDD 架构规范

### ARCH-03: 门面违规检测
- UI 层禁止直接 `from "engine/(resource|building|hero|...)"`
- 必须通过 engine/index.ts 门面导出
- 检查: `grep -rn "from.*engine/(resource|building|...)" src/components/`
- **来源**: EVO-008, EVO-015

### ARCH-04: ISubsystem 100% 实现
- 新增子系统时必须同步实现 ISubsystem 接口
- 检查: `grep -rn "implements ISubsystem" src/games/three-kingdoms/engine/`
- **来源**: EVO-025, EVO-046

### ARCH-05: 门面导出按业务域命名
- 按 `{domain}` 命名（如 `exports-pvp.ts`）
- 禁止按版本号命名（如 `exports-v9.ts`）
- 新增文件必须同步更新门面导出
- **来源**: EVO-006, EVO-049

### ARCH-06: 复杂域四层拆分
- 子系统 >5 的功能域按"数据管理/流程控制/效果计算/辅助功能"拆分
- **来源**: EVO-024

### ARCH-07: 子系统接入六项清单
- 新增系统必须检查: create / register / init / reset / getter / export
- **来源**: EVO-030, EVO-036

---

## P2 规则

### ARCH-08: 域内命名统一
- 同一域遵循 `{Domain}{Function}System` 模式
- **来源**: EVO-027

### ARCH-09: Mixin 模式用于引擎扩展
- 引擎 getter 方法通过 mixin 外移到 engine-getters.ts
- **来源**: EVO-010, EVO-017

### ARCH-10: core 层聚合导出
- 配置/模板按功能域拆分，主文件做聚合 re-export
- **来源**: EVO-048

---

## 检查命令

```bash
# 文件行数超限
find src/ -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -20

# 门面违规
grep -rn "from.*engine/\(resource\|building\|hero\|battle\|campaign\)" src/components/

# ISubsystem 覆盖
grep -c "implements ISubsystem" src/games/three-kingdoms/engine/**/*.ts

# 按版本号命名的导出
find src/ -name "exports-v*" -type f
```

---

## 进化记录

| 日期 | 变更 | 来源 |
|------|------|------|
| 2026-04-23 | 从进化规则抽取 | 文档重构 |
