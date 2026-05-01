# P0缺陷模式库 — 三国霸业

> 版本: v2.0 | 初始化: 2026-05-01
> 持续积累，每轮更新

## 已验证的P0模式（24个模式）

### 模式1: null/undefined防护缺失
- **出现频率**: 8次（19.0%）
- **检查方法**: 每个公开API的参数是否有null guard
- **典型案例**: initBattle(null)崩溃、distribute(undefined)崩溃、deserialize(null)崩溃
- **修复模式**: 入口加null检查 `if (!param) return defaultValue`

### 模式2: 数值溢出/非法值
- **出现频率**: 7次（16.7%）
- **检查方法**: 数值计算链是否有NaN/Infinity检查
- **典型案例**: applyDamage NaN全链传播、stars=NaN星级异常
- **修复模式**: `if (Number.isNaN(x) || !Number.isFinite(x)) return 0`

### 模式3: 负值漏洞
- **出现频率**: 高（P1中占比最高）
- **检查方法**: 伤害/消耗/扣除是否有<=0检查
- **典型案例**: applyDamage负伤害变治疗、负数声望
- **修复模式**: `if (value <= 0) return 0`

### 模式4: 浅拷贝副作用
- **出现频率**: 3次
- **检查方法**: 数组展开或Object.assign后是否修改嵌套属性
- **典型案例**: autoFormation浅拷贝导致原数组被修改
- **修复模式**: 使用深拷贝 `JSON.parse(JSON.stringify(x))` 或 structuredClone

### 模式5: 竞态/状态泄漏
- **出现频率**: 6次（14.3%）
- **检查方法**: 循环体内异常是否导致永久卡死
- **典型案例**: AutoPushExecutor 7个异常卡死点
- **修复模式**: try-finally包裹循环体

### 模式6: 经济漏洞
- **出现频率**: 3次
- **检查方法**: 购买/兑换是否有日限购/总限购
- **典型案例**: exchangeFragmentsFromShop无限购
- **修复模式**: 添加日限购累计计数

### 模式7: 数据丢失
- **出现频率**: 3次
- **检查方法**: serialize是否保存所有子系统状态
- **典型案例**: engine-save不保存Sweep/VIP/Challenge
- **修复模式**: 扩展序列化范围

### 模式8: 集成缺失
- **出现频率**: 7次
- **检查方法**: 跨系统调用是否完整
- **典型案例**: 装备加成不传递到战斗
- **修复模式**: 使用totalStats替代baseStats

## 自动扫描清单

每个新模块应自动扫描以上8种模式，预期可提前发现60%同类P0。

### 模式9: NaN绕过数值检查
- **出现频率**: 系统性（Hero R1发现5+处）
- **检查方法**: 搜索所有 `if (x <= 0)` 和 `if (x > 0)` 模式
- **典型案例**: calculatePower(NaN)返回NaN而非0, addExp(NaN)导致等级异常
- **修复模式**: 使用 `if (!Number.isFinite(x) || x <= 0)` 替代 `if (x <= 0)`

### 模式10: 配置交叉不一致
- **出现频率**: 中等
- **检查方法**: 不同配置文件中同名ID和值的交叉比对
- **典型案例**: 搭档羁绊ID在bond-config和faction-bond-config中不一致
- **修复模式**: 建立配置交叉验证脚本

### 模式11: 算法正确性缺陷
- **出现频率**: 中等
- **检查方法**: 验证算法输出是否符合预期（如推荐算法是否推荐不同方案）
- **典型案例**: FormationRecommendSystem推荐重复方案
- **修复模式**: 添加算法输出多样性验证

### 模式12: setter/getter注入未调用
- **出现频率**: 高（R2发现2处关键集成缺失）
- **检查方法**: 搜索所有set*方法定义，验证是否有调用点
- **典型案例**: setBondMultiplierGetter/setEquipmentPowerGetter定义但从未调用
- **修复模式**: 在初始化流程中添加调用，或改为直接导入

### 模式13: 修复穿透不完整
- **出现频率**: 高（R1→R2穿透率19%）
- **检查方法**: 验证每个FIX是否同时修复调用方和底层函数
- **典型案例**: FIX-001修复调用方的NaN检查，但getStarMultiplier本身仍接受NaN
- **修复模式**: 修复时追溯完整调用链

### 模式14: 资源溢出无上限
- **出现频率**: 中等
- **检查方法**: 搜索所有add*/gain*/earn*方法，验证是否有上限
- **典型案例**: 碎片数量无上限，溢出部分静默丢弃
- **修复模式**: 添加Math.min上限+溢出转化

### 模式15: 保存/加载流程缺失子系统
- **出现频率**: 架构级（R3发现6个子系统缺失）
- **检查方法**: 对比子系统列表与serialize/deserialize覆盖列表
- **典型案例**: HeroStarSystem等6个子系统完全不在保存/加载流程中
- **修复模式**: 在buildSaveData/applySaveData中添加子系统序列化

### 模式16: 伤害计算NaN传播
- **出现频率**: 高（Battle R1发现3处）
- **检查方法**: 搜索所有伤害/buff/乘数计算，验证NaN防护
- **典型案例**: calculateDotDamage(NaN)绕过>0检查
- **修复模式**: 添加!Number.isFinite()检查

### 模式17: 配置-枚举不同步
- **出现频率**: 中等
- **检查方法**: 对比枚举值与配置数组
- **典型案例**: AVAILABLE_SPEEDS=[1,2,3]缺少X4=4
- **修复模式**: 同步更新配置数组

### 模式18: Infinity序列化风险
- **出现频率**: 低
- **检查方法**: 搜索Infinity使用，验证序列化路径
- **典型案例**: SKIP模式返回Infinity，JSON.stringify变为null
- **修复模式**: 使用有限值替代Infinity

### 模式19: 对称函数修复遗漏
- **出现频率**: 中等（Battle R2发现1处）
- **检查方法**: 修复一个函数时，搜索其对称函数（attack↔defense、add↔remove、serialize↔deserialize）是否需要相同修复
- **典型案例**: FIX-105对getTechTroopAttackBonus添加Math.max(0)，但getTechTroopDefenseBonus遗漏
- **修复模式**: 修复时同步搜索所有对称函数，确保一致处理

### 模式20: 无锁发奖（关卡系统状态锁缺失）
- **出现频率**: 中等（Campaign R1发现1处）
- **检查方法**: 搜索所有"发奖/发放奖励"代码路径，验证是否存在前置状态锁（如preLock/preCheck），未锁定时是否拒绝执行
- **典型案例**: FIX-303 ChallengeStageSystem.completeChallenge未验证preLockedResources[stageId]是否存在，导致跳过preLockResources直接调用即可免费获得奖励
- **修复模式**: 在complete/confirm类API入口添加前置状态检查，未满足条件时返回空结果而非执行业务逻辑
- **关联规则**: Builder规则#20（关卡系统状态锁验证）

### 模式21: 资源比较NaN绕过
- **出现频率**: 系统级（Building R1发现，影响13个API入口）
- **检查方法**: 搜索所有 `resources.x < cost.x` 或 `resources.x >= cost.x` 模式的比较，验证比较前是否有 `Number.isFinite` 检查
- **典型案例**: FIX-401 `resources.grain=NaN` 时 `NaN < cost.grain` 返回 false，绕过"粮草不足"检查，允许无资源升级
- **修复模式**: 在资源比较前添加 `if (!Number.isFinite(resources.grain) || !Number.isFinite(resources.gold) || !Number.isFinite(resources.troops)) { reasons.push('资源数据异常'); }`
- **关联规则**: Builder规则#21（资源比较NaN防护）

### 模式22: 资源累积无上限
- **出现频率**: 系统级（Tech R1发现，TechPointSystem无上限）
- **检查方法**: 搜索所有资源/货币/积分类数值的累积操作（`+=`），验证是否有MAX常量约束上限
- **典型案例**: FIX-504 TechPointSystem.update()中 `current += gain` 无上限检查，配合NaN问题导致不可恢复
- **修复模式**: 添加 `static readonly MAX_X = N` 常量，在所有增加路径中使用 `Math.min(current + gain, MAX_X)` 约束
- **关联规则**: Builder规则#22（科技点上限验证）

### 模式23: 免费强化/扩容/锻造漏洞
- **出现频率**: 系统级（Equipment R1发现3处同类变体）
- **检查方法**: 搜索所有消耗类操作（enhance/expand/forge/craft），验证资源扣除是否为必需步骤而非可选回调
- **典型案例**: 
  - FIX-603 `enhance()` 的 `deductResources` 为可选回调，未注入时免费强化
  - FIX-604 `expand()` 仅发射事件通知扣费，不验证资源是否充足
  - FIX-605 `executeForge()` 先消耗材料后生成结果，失败时材料丢失
- **修复模式**: 
  1. 资源扣除回调从可选改为必需（未注入时拒绝操作）
  2. 消耗类操作采用"先验证后消费"模式（validate→generate→consume）
  3. 扩容/购买类操作添加资源预检步骤
- **关联规则**: Builder规则#23（资源扣除必需验证）

### 模式24: 经济子系统存档缺失
- **出现频率**: 系统级（Resource R1发现，CopperEconomySystem + MaterialEconomySystem 未接入 engine-save）
- **检查方法**: 对比每个子系统的 serialize/deserialize 方法与 engine-save.ts 中 buildSaveData/applySaveData 的引用，验证"六处同步"完整性
- **典型案例**: FIX-720/721 CopperEconomySystem 和 MaterialEconomySystem 有完整的 serialize/deserialize 实现，但 engine-save.ts 中完全未引用，存档后数据丢失
- **修复模式**: 在 GameSaveData 类型 + SaveContext 接口 + buildSaveData + toIGameState + fromIGameState + applySaveData 六处同步添加子系统
- **关联规则**: Builder规则#14/15（保存/加载覆盖扫描、deserialize覆盖验证）
