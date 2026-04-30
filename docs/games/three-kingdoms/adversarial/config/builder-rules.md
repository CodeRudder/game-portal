# Builder Agent Rules — 三国霸业

> 版本: v1.4 | 初始化: 2026-05-01
> 每轮复盘后更新此文件

## 通用规则

1. 每个公开API至少1个F-Normal节点
2. 每个数值API必须检查null/undefined/NaN/负值/溢出
3. 每个状态变更API必须检查serialize/deserialize路径
4. covered标注必须有测试文件或源码行号支撑
5. 跨系统链路至少枚举 N 条（N=子系统数×2）
6. 所有数值参数检查必须使用 !Number.isFinite(x) || x <= 0 而非简单的 x <= 0（NaN绕过教训）
7. 配置文件必须交叉验证（不同配置文件间的一致性）
8. 算法正确性必须验证（推荐算法是否真的推荐了不同方案）
9. 双系统并存时必须分析重叠和冲突
10. 修复穿透验证：修复调用方时必须同步检查底层函数是否也需要防护（FIX穿透率目标<10%）
11. 注入点验证：所有setter/getter注入模式必须验证是否在初始化时被调用
12. 溢出闭环：资源系统必须有上限和溢出处理，形成完整闭环
13. 事务性扫描：多步操作必须验证原子性（全部成功或全部回滚）
14. 保存/加载覆盖扫描：每个子系统必须验证serialize/deserialize是否被engine-save调用（BR-023, R3教训：6个子系统状态丢失）
15. deserialize覆盖验证：新增子系统时必须同步更新GameSaveData、SaveContext、buildSaveData、toIGameState、fromIGameState、applySaveData六处（BR-024, R3教训：遗漏任一处导致数据丢失）
16. 跨系统链路验证：子系统间的回调注入必须在finalizeLoad/init流程中验证调用（BR-025, R3教训：HeroBadgeSystem依赖回调但无持久化需求）
17. 战斗数值安全：所有伤害/加成/乘数必须验证NaN/负数/Infinity
18. 配置-枚举同步：枚举值必须与配置数组完全对应
19. Infinity序列化：Infinity不能直接序列化，必须转为有限值

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
| 2026-05-01 | Hero R1 | +4条通用规则 | NaN绕过、配置交叉验证、算法正确性、双系统并存 |
| 2026-05-01 | Hero R2 | +4条通用规则(10-13) | FIX穿透验证、注入点验证、溢出闭环、事务性扫描 |
| 2026-05-01 | Hero R3 | +3条通用规则(14-16) | 保存/加载覆盖扫描、deserialize覆盖验证、跨系统链路验证 |
| 2026-05-01 | Battle R1 | +3条通用规则(17-19) | 战斗数值安全、配置-枚举同步、Infinity序列化 |
