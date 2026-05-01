# Mail 模块 R2 — Challenger 挑战报告

> Challenger: 2026-05-01 | 挑战模式: 残余风险 + 新维度

## 挑战策略

R1 修复了 7 个 P0，R2 挑战聚焦：
1. FIX 完整性 — 修复是否有遗漏的绕过路径
2. 新维度 — R1 未覆盖的攻击面
3. 修复副作用 — FIX 是否引入新问题

---

## CH-01: addMail 绕过容量限制（中风险）

**攻击路径**: `addMail()` 是内部 API，不检查容量。如果外部模块直接调用 addMail，可绕过 FIX-6 的容量限制。

```typescript
// 攻击代码
for (let i = 0; i < 200; i++) {
  mailSystem.addMail({ id: `bypass_${i}`, ... });
}
// 结果：mails.size = 200，超过 MAILBOX_CAPACITY=100
```

**评估**: addMail 是 `public` 方法，任何持有 MailSystem 引用的模块都可调用。虽然注释标注为"内部 API"，但 TypeScript 无强制限制。

**裁决**: **P1** — 设计意图是内部 API，但缺少访问控制。不阻塞封版，建议 R3 添加容量检查或改为 private。

**Builder 覆盖**: BR-05-04 已验证此行为。

---

## CH-02: resourceType 未校验（低风险）

**攻击路径**: `sendMail` 和 `addClaimedResources` 只校验了 amount，未校验 resourceType。

```typescript
// 攻击代码
mailSystem.sendMail({
  category: 'system', title: 'x', content: 'x', sender: 'x',
  attachments: [{ resourceType: '', amount: 100 }]  // 空字符串
});
// 或
attachments: [{ resourceType: '__proto__', amount: 100 }]  // 原型污染
```

**评估**: resourceType 传入 `resourceSystem.addResource(type, amount)`，如果 ResourceSystem 不校验 type，可能产生意外行为。但这是 ResourceSystem 的职责，不在 Mail 模块范围内。

**裁决**: **P2** — 跨模块责任，不阻塞封版。建议 ResourceSystem R2 检查。

---

## CH-03: sendMail 空标题/内容（低风险）

**攻击路径**: `sendMail` 不校验 title、content、sender 是否为空字符串。

```typescript
mailSystem.sendMail({
  category: 'system', title: '', content: '', sender: '',
  attachments: []
});
// 结果：创建一封全空的邮件
```

**评估**: 不影响安全，仅影响用户体验。TypeScript 类型已约束为 string。

**裁决**: **P2** — UI 层校验即可，不阻塞封版。

---

## CH-04: retainSeconds=0 导致立即过期（低风险）

**攻击路径**: `retainSeconds=0` 时，`expireTime = now + 0 * 1000 = now`，邮件创建后立即过期。

```typescript
mailSystem.sendMail({
  category: 'system', title: 'test', content: 'x', sender: 'x',
  retainSeconds: 0,  // 立即过期
});
// expireTime = now → 下次 processExpired 时变为 expired
```

**评估**: 行为合理（0 秒保留 = 立即过期），但可能不符合策划意图。

**裁决**: **P2** — 业务逻辑问题，不影响安全。建议策划确认最小 retainSeconds。

---

## CH-05: restoreSaveData 覆盖运行时数据（低风险）

**攻击路径**: `loadFromSaveData` 直接覆盖 `this.mails` 和 `this.nextId`，不合并。

```typescript
// 运行时已有 50 封邮件
mailSystem.loadFromSaveData(savedData);  // 直接覆盖为存档数据
// 结果：运行时邮件全部丢失
```

**评估**: 这是存档恢复的标准行为（全量覆盖），非 bug。

**裁决**: **非问题** — 设计意图如此。

---

## CH-06: claimAttachments 重复调用幂等性（已安全）

**攻击路径**: 对同一封邮件多次调用 `claimAttachments`。

```typescript
mailSystem.claimAttachments(mailId);  // 第一次领取
mailSystem.claimAttachments(mailId);  // 第二次领取
```

**评估**: 第二次调用时 `attachment.claimed === true`，跳过，返回空对象。**安全**。

**裁决**: **已安全** — 无需修复。

---

## CH-07: sendBatch 部分失败不回滚（低风险）

**攻击路径**: `sendBatch` 逐封发送，容量满后部分返回 null，但已发送的不回滚。

```typescript
// 容量剩余 2，发送 5 封
const results = mailSystem.sendBatch([...5封]);
// results = [MailData, MailData, null, null, null]
// 前 2 封已持久化，后 3 封失败
```

**评估**: 批量操作部分成功是常见设计模式。调用方应检查返回数组。

**裁决**: **P2** — API 设计选择，不阻塞封版。建议文档说明。

---

## CH-08: MailData 可变性（低风险）

**攻击路径**: `getMail()` 返回 Map 中的原始引用，外部可直接修改。

```typescript
const mail = mailSystem.getMail('mail_1');
mail.status = 'expired';  // 直接修改内部状态
mail.attachments[0].claimed = true;  // 绕过 claimAttachments
```

**评估**: `getMail` 返回 `this.mails.get(mailId)` 的原始引用，未做防御性拷贝。`addMail` 做了 `{ ...mail }` 浅拷贝，但 getMail 没有。

**裁决**: **P1** — 可绕过所有状态校验（FIX-4 等），但需要恶意调用方。不阻塞封版，建议 R3 添加防御性拷贝。

---

## 挑战总结

| ID | 风险 | 裁决 | 阻塞封版 |
|----|------|------|----------|
| CH-01 | addMail 绕过容量 | P1 | ❌ |
| CH-02 | resourceType 未校验 | P2 | ❌ |
| CH-03 | 空标题/内容 | P2 | ❌ |
| CH-04 | retainSeconds=0 | P2 | ❌ |
| CH-05 | loadFromSaveData 覆盖 | 非问题 | ❌ |
| CH-06 | claimAttachments 幂等 | 已安全 | ❌ |
| CH-07 | sendBatch 部分失败 | P2 | ❌ |
| CH-08 | MailData 可变性 | P1 | ❌ |

**P0 数量**: 0  
**P1 数量**: 2（不阻塞）  
**P2 数量**: 4  
**阻塞封版**: ❌ 无阻塞项

## R2 封版建议

所有 R1 P0 修复穿透验证通过，R2 未发现新的 P0 级问题。2 个 P1 建议纳入 R3 改进计划。**建议封版**。
