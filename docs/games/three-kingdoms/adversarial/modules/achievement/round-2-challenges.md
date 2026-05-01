# Achievement R2 Challenges

> Challenger: AdversarialChallenger v2.0 | Time: 2026-05-01
> 模块: achievement | 基于: round-2-tree.md

## 挑战策略

R1 已修复 4 个 P0（FIX-ACH-402/403/404/406），174 测试通过。R2 挑战聚焦：
1. **P0 修复穿透验证** — 修复是否真正生效
2. **P1 遗留场景** — R1 标记的 4 个 P1 建议
3. **组合攻击** — 多个异常向量同时注入

---

## C1: FIX-ACH-402 穿透验证 — loadSaveData 全面防护

### 挑战描述
验证 loadSaveData 的 NaN/缺失字段/缺失实例三合一修复是否完整穿透。

### 测试向量
```typescript
// V1: totalPoints = NaN → 应 fallback 0
const data1 = validSaveData();
data1.state.totalPoints = NaN;
sys.loadSaveData(data1);
expect(sys.getState().totalPoints).toBe(0);

// V2: progress 含 NaN → 应 fallback 0
const data2 = validSaveData();
data2.state.achievements['ach_1'].progress['kill'] = NaN;
sys.loadSaveData(data2);
const ach = sys.getAchievement('ach_1');
expect(ach!.instance.progress['kill']).toBe(0);

// V3: achievements 为空对象 → 应补全
const data3 = validSaveData();
data3.state.achievements = {};
sys.loadSaveData(data3);
const all = sys.getAllAchievements();
expect(all.length).toBe(ALL_ACHIEVEMENTS.length);

// V4: completedChains 含无效值
const data4 = validSaveData();
data4.state.completedChains = null as any;
sys.loadSaveData(data4);
expect(sys.getState().completedChains).toEqual([]);

// V5: dimensionStats 缺失 → 拒绝加载
const data5 = validSaveData();
delete data5.state.dimensionStats;
sys.loadSaveData(data5);
// 状态不变
```

### 预期结果
所有 5 个向量均被正确防护，系统状态一致。

### 严重度评估
如果 V1-V3 失败 → 🔴 P0（R1 修复未穿透）
如果 V4-V5 失败 → 🟡 P1

---

## C2: FIX-ACH-403 穿透验证 — updateProgress NaN 进度

### 挑战描述
验证已有 NaN 进度在 updateProgress 中被正确重置。

### 测试向量
```typescript
// V1: 通过 loadSaveData 注入 NaN 进度，然后 updateProgress
const data = validSaveData();
data.state.achievements['ach_battle_1'].progress['total_kills'] = NaN;
sys.loadSaveData(data);

// loadSaveData 应已修复 NaN → 0，所以 updateProgress 正常
sys.updateProgress('total_kills', 5);
const ach = sys.getAchievement('ach_battle_1');
expect(ach!.instance.progress['total_kills']).toBe(5);

// V2: 直接篡改内部状态（模拟极端情况）
// 由于 loadSaveData 已防护，此路径实际不可达
// 但如果未来新增代码绕过 loadSaveData，仍需 updateProgress 自身防护
```

### 预期结果
NaN 进度在 loadSaveData 层被拦截（第一道防线），updateProgress 层有第二道防线。

### 严重度评估
如果 V1 失败 → 🔴 P0（双层防护断裂）

---

## C3: FIX-ACH-404 穿透验证 — getSaveData 深拷贝

### 挑战描述
验证 getSaveData 返回的 progress 对象是深拷贝，修改不影响内部。

### 测试向量
```typescript
sys.updateProgress('total_kills', 100);
const save1 = sys.getSaveData();

// 修改返回值
const achId = Object.keys(save1.state.achievements)[0];
save1.state.achievements[achId].progress['total_kills'] = 99999;

// 内部不受影响
const save2 = sys.getSaveData();
expect(save2.state.achievements[achId].progress['total_kills']).toBe(100);

// V2: 修改 status
save2.state.achievements[achId].status = 'claimed';
const save3 = sys.getSaveData();
expect(save3.state.achievements[achId].status).not.toBe('claimed');
```

### 预期结果
所有修改被隔离，内部状态完全不受影响。

### 严重度评估
如果失败 → 🔴 P0（引用泄漏导致外部可篡改）

---

## C4: FIX-ACH-406 穿透验证 — claimReward 积分防护

### 挑战描述
验证异常积分不会穿透到 totalPoints。

### 测试向量
```typescript
// 使用 mock 配置注入异常积分
// V1: achievementPoints = NaN
// V2: achievementPoints = 0
// V3: achievementPoints = -1
// V4: achievementPoints = Infinity
```

### 预期结果
所有异常积分被跳过，totalPoints 不变。成就仍标记为 claimed。

### 严重度评估
如果失败 → 🔴 P0（NaN 穿透到 totalPoints）

---

## C5: P1-1 遗留 — createInitialState 未知维度

### 挑战描述
如果配置中新增了未知的 AchievementDimension，createInitialState 是否能正确处理。

### 测试向量
```typescript
// 假设配置中有一个 dimension 不在已知枚举中
// dimensionStats 是否能动态扩展
```

### 预期结果
系统不崩溃，新维度被正确初始化。

### 严重度评估
如果失败 → 🟡 P1（向前兼容问题）

---

## C6: P1-3 遗留 — reset 不清空 rewardCallback

### 挑战描述
reset() 后 rewardCallback 是否被清空。如果不清空，可能导致旧 callback 引用泄漏。

### 测试向量
```typescript
const callback = vi.fn();
sys.setRewardCallback(callback);
sys.reset();
// callback 是否被清空？
sys.claimReward('ach_1'); // 如果 callback 未清空，旧回调可能被调用
```

### 预期结果
reset 后 rewardCallback 被清空，claimReward 不调用旧回调。

### 严重度评估
如果失败 → 🟡 P1（内存泄漏风险）

---

## C7: P1-4 遗留 — rewardCallback 返回值 NaN 穿透

### 挑战描述
如果 rewardCallback 返回的奖励中含有 NaN 值，是否会影响系统。

### 测试向量
```typescript
sys.setRewardCallback((rewards) => {
  // 返回含 NaN 的修改奖励
  return { ...rewards, achievementPoints: NaN };
});
```

### 预期结果
claimReward 中的 FIX-ACH-406 防护应拦截 NaN，不累加到 totalPoints。

### 严重度评估
如果失败 → 🟡 P1（callback 返回值未验证）

---

## C8: 组合攻击 — loadSaveData + updateProgress + claimReward

### 挑战描述
同时注入多个异常向量，验证系统在组合攻击下的稳定性。

### 测试向量
```typescript
// Step 1: 加载含 NaN 的存档
const data = validSaveData();
data.state.totalPoints = NaN;
data.state.achievements['ach_1'].progress['kill'] = NaN;
sys.loadSaveData(data);

// Step 2: 更新进度
sys.updateProgress('kill', NaN); // 应被 FIX-901 拦截
sys.updateProgress('kill', 10);  // 正常更新

// Step 3: 完成并领取
// ... 触发完成条件
sys.claimReward('ach_1');

// 验证: totalPoints 不含 NaN
expect(Number.isFinite(sys.getState().totalPoints)).toBe(true);
```

### 预期结果
totalPoints 始终为有限数，系统稳定。

### 严重度评估
如果失败 → 🔴 P0（组合穿透）

---

## C9: 保存/加载往返一致性

### 挑战描述
完整生命周期后的保存/加载往返是否完全一致。

### 测试向量
```typescript
// 完整流程
sys.updateProgress('kill', 50);
sys.updateProgress('recruit', 3);
// ... 触发多个完成
const save1 = sys.getSaveData();
const json = JSON.stringify(save1);
const parsed = JSON.parse(json);
sys2.loadSaveData(parsed);
const save2 = sys2.getSaveData();
expect(save2).toEqual(save1); // 深度相等
```

### 预期结果
保存 → JSON 序列化 → 解析 → 加载后状态完全一致。

### 严重度评估
如果失败 → 🟡 P1（数据丢失）

---

## C10: 事件监听器完整性

### 挑战描述
验证所有 5 个事件监听器在异常 payload 下不崩溃。

### 测试向量
```typescript
// 每个事件发送 3 种 payload: 正常、null、含 NaN
const events = ['battle:victory', 'hero:recruit', 'quest:complete', 'resource:gain', 'dimension:unlock'];
for (const evt of events) {
  emitter.emit(evt, normalPayload);   // 不崩溃
  emitter.emit(evt, null);            // 不崩溃
  emitter.emit(evt, { count: NaN });  // 不崩溃
}
```

### 预期结果
所有事件处理不抛异常，NaN payload 被 FIX-901 拦截。

### 严重度评估
如果正常 payload 失败 → 🔴 P0
如果异常 payload 失败 → 🟡 P1

---

## 挑战总结

| # | 挑战 | 覆盖分支 | 严重度 | 类型 |
|---|------|---------|--------|------|
| C1 | FIX-402 穿透 | T2.2 | 🔴→🟢 | 穿透验证 |
| C2 | FIX-403 穿透 | T2.5 | 🔴→🟢 | 穿透验证 |
| C3 | FIX-404 穿透 | T3.4 | 🔴→🟢 | 穿透验证 |
| C4 | FIX-406 穿透 | T2.3 | 🔴→🟢 | 穿透验证 |
| C5 | 未知维度 | T3.3 | 🟡 | P1 遗留 |
| C6 | reset callback | T2.6 | 🟡 | P1 遗留 |
| C7 | callback NaN | T4.4 | 🟡 | P1 遗留 |
| C8 | 组合攻击 | T2+T3 | 🔴 | 新增 |
| C9 | 往返一致 | T4.2 | 🟡 | 新增 |
| C10 | 事件完整性 | T4.1 | 🔴→🟡 | P1 遗留 |

**穿透验证类(C1-C4)**: 预期全部通过（R1 修复已验证）
**P1 遗留类(C5-C7)**: 预期部分通过，可能需 R3 跟进
**新增类(C8-C10)**: 预期通过，验证组合稳定性
