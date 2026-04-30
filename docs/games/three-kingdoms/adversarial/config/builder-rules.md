# Builder Agent Rules — 三国霸业

> 版本: v1.0 | 初始化: 2026-05-01
> 每轮复盘后更新此文件

## 通用规则

1. 每个公开API至少1个F-Normal节点
2. 每个数值API必须检查null/undefined/NaN/负值/溢出
3. 每个状态变更API必须检查serialize/deserialize路径
4. covered标注必须有测试文件或源码行号支撑
5. 跨系统链路至少枚举 N 条（N=子系统数×2）

## 三国霸业特定规则

### 武将域 (hero)
- HeroSystem与HeroLevelSystem双路径一致性（DEF-003教训）
- 碎片系统exchangeFragmentsFromShop必须有日限购（DEF-001教训）
- 武将星级系统需检查NaN传播

### 战斗域 (battle)
- initBattle必须检查null防护（DEF-004教训）
- applyDamage必须检查负伤害和NaN（DEF-005/006教训）
- 装备加成必须传递到战斗（DEF-007教训）
- BattleEngine必须有serialize/deserialize（DEF-008教训）

### 攻城域 (campaign)
- engine-save必须保存所有子系统（DEF-011教训）
- AutoPushExecutor必须有try-finally（DEF-013教训）
- distribute必须防护null/undefined（DEF-014教训）

## 源码验证规则

1. P0节点100%源码验证
2. covered标注抽查率>=30%
3. 跨系统节点必须验证接口调用链

## 进化记录

| 日期 | 轮次 | 变更 | 原因 |
|------|------|------|------|
| 2026-05-01 | 初始化 | 创建初始规则 | 方法论升级 |
