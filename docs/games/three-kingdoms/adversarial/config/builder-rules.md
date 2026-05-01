# Builder Agent Rules — 三国霸业

> 版本: v1.8 | 初始化: 2026-05-01
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
20. 对称函数修复验证：修复一对对称函数（如getAttack/getDefense）中的一个时，必须同步检查另一个是否需要相同修复（Battle R2教训：FIX-105修了attack侧Math.max(0)，遗漏defense侧）
21. 资源比较NaN防护：所有资源比较（`resources.x < cost.x`）前必须验证资源值是否为有限数（`Number.isFinite`），否则NaN比较返回false绕过检查（Building R1教训：FIX-401，13个API入口受影响）
22. 科技点上限验证：所有资源累积型系统必须有上限常量（MAX_*），且在所有增加路径（update/exchange/refund）中检查上限（Tech R1教训：FIX-504，TechPointSystem无上限）

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
| 2026-05-01 | Campaign R1 | +1条通用规则(20) | 关卡系统状态锁验证 |
| 2026-05-01 | Building R1 | +1条通用规则(21) | 资源比较NaN防护 |

## 通用规则

1. 所有数值API入口必须检查NaN（`!Number.isFinite(x) || x <= 0`）
2. 配置交叉验证：枚举值 vs 配置数组 vs 常量必须一致
3. 算法正确性优先于边界测试
4. 双系统并存时（如新旧VIPSystem），必须验证切换完整性
5. FIX穿透验证：修复一个P0后，搜索所有相似代码路径
6. 注入点验证：所有通过deps注入的回调必须有error case
7. 溢出闭环：Math.max/Math.min链必须有NaN前置检查
8. 事务性扫描：多步资源操作必须有回滚机制或补偿路径
9. 保存/加载覆盖扫描：每个子系统必须验证六处同步
10. deserialize覆盖验证：null/undefined输入必须安全处理
11. 跨系统回调注入必须在finalizeLoad/init流程中验证
12. 战斗数值安全——伤害/加成/乘数必须验证NaN/负数/Infinity
13. 配置-枚举同步——枚举值必须与配置数组完全对应
14. Infinity序列化风险——Infinity不能直接序列化，必须转为有限值
15. 对称函数修复验证——修复attack/defense对中的一个时，必须同步检查另一个
16. serialize/deserialize必须使用深拷贝，与同类子系统实现保持一致
17. 经济系统必须验证"预锁→消费→发奖"完整链路，未满足前置条件时拒绝执行
18. covered标注必须经源码验证，虚报率>5%扣准确性分
19. NaN防护标注为covered时必须验证所有入口
20. **关卡系统状态锁验证** — completeChallenge/completeStage类API必须验证前置状态锁（如preLock），未满足前置条件时拒绝执行并返回空结果，防止跳过预锁直接发奖
