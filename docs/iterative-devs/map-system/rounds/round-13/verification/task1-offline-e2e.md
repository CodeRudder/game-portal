# Task 1: E1-4 离线→上线→奖励弹窗→资源更新 E2E集成测试

## 任务描述

创建覆盖完整离线奖励生命周期的 E2E 集成测试:
离线(时间流逝) → 上线检测 → OfflineRewardSystem 计算6档衰减快照 → OfflineEventSystem 生成事件 → 奖励弹窗数据 → 领取(防重复) → 资源更新

使用真实 EventBus (非 mock) 串联各系统, 使用 vi.useFakeTimers() 控制离线时间流逝。

## 测试文件

`src/games/three-kingdoms/engine/map/__tests__/integration/offline-e2e.integration.test.ts`

## 测试场景列表

### 场景1: 正常离线8小时 (3个测试)
- 8小时快照: tier1(0~2h,100%) + tier2(2~8h,80%) = 综合效率85%
- OfflineEventSystem 通过真实 EventBus 触发 `offline:processed` 事件
- 验证衰减系数: 2h*1.0 + 6h*0.8 = 0.85

### 场景2: 离线时间过短 (< 5分钟) (4个测试)
- OfflineEventSystem: 离线 < 10秒 → 无奖励
- OfflineRewardSystem: 离线0秒 → 零收益
- OfflineRewardSystem: 负数秒 → NaN防护返回零收益
- 离线1分钟 → 仅tier1(100%)极少收益

### 场景3: 离线时间过长 (> 72小时) → 奖励封顶 (4个测试)
- 离线100小时 → 封顶72小时 + isCapped=true
- 72小时应包含5个衰减档位全覆盖
- OfflineEventSystem: 离线48小时 → 封顶24小时
- 封顶72h的收益 < 24h收益 * 3倍 (衰减机制验证)

### 场景4: 多资源类型(粮草/金币/兵力/天命)分别计算 (4个测试)
- grain/gold/troops/mandate 按各自速率独立计算
- 不同衰减档位下比例保持不变
- 资源溢出时按caps分别截断
- OfflineEventSystem: 各资源类型独立积累事件

### 场景5: 领土数量影响奖励 (4个测试)
- 5个玩家城市 vs 1个玩家城市 → 奖励约5倍
- 敌方城市不产生离线奖励
- 高等级城市产出更多 (level multiplier = 1 + (level-1)*0.2)
- OfflineRewardSystem: 5倍产出速率 = 5倍奖励

### 场景6: 领取后资源更新 + 防重复领取 (4个测试)
- 领取奖励后资源数量应增加
- 防重复领取: 第二次claimReward返回null
- 新一轮 calculateOfflineReward 后可再次领取
- 完整流程: 离线→上线→弹窗数据→领取→资源更新→EventBus通知

### 场景7: VIP等级影响离线奖励 (3个测试)
- VIP3 比 VIP0 收益更高 (15%加成)
- VIP加成后资源上限截断仍有效
- 系统修正系数: building(1.2) > resource(1.0) > expedition(0.85)

### 额外场景: 序列化 + 时间连续性 (3个测试)
- 存档恢复后离线奖励应能正确计算
- OfflineEventSystem 序列化/反序列化后保持离线时间
- 多次离线-上线循环: 每次奖励独立且一致

## 运行结果

```
 RUN  v1.6.1 /Users/gongdewei/work/projects/game-portal

 ✓ src/games/three-kingdoms/engine/map/__tests__/integration/offline-e2e.integration.test.ts  (28 tests) 8ms

 Test Files  1 passed (1)
      Tests  28 passed (28)
   Duration  462ms
```

## 新增测试数量

**28个 E2E 集成测试全部通过**, 覆盖7大场景 + 额外验证。

### 涉及系统
- `OfflineRewardSystem` (engine/offline) - 6档衰减快照、VIP加成、系统修正、资源溢出、领取防重复
- `OfflineEventSystem` (engine/map) - 离线事件生成、城市产出、随机事件、序列化
- `EventBus` (core/events) - 真实事件总线, 非mock, 验证系统间通信

### 关键验证点
- 5档衰减系数精确计算 (tier1~tier5: 100%/80%/60%/40%/20%)
- 72小时封顶机制
- 多资源类型独立计算
- 领土数量与产出线性关系
- 防重复领取机制
- VIP等级加成
- 系统差异化修正系数
- 序列化/反序列化数据一致性
