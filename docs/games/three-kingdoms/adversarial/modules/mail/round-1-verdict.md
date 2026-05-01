# Mail 模块 R1 — Arbiter 裁决报告

> Arbiter: 2026-05-01 | 裁决模式: 严格

## 裁决原则

1. P0节点100%源码验证
2. 每个P0必须有明确的攻击路径和崩溃/数据损坏证据
3. 修复方案必须最小化，不引入新风险

---

## P0 裁决

### P0-1: sendMail 不校验 attachment.amount — 确认 P0

**裁决**: 确认。NaN/负数/Infinity 可通过 sendMail 注入附件系统，并在 claimAttachments 时传播到资源系统。

**修复方案**: 在 `sendMail` 的 attachments.map 中添加 `!Number.isFinite(att.amount) || att.amount <= 0` 校验，不合法则跳过该附件。

**严重度**: P0 — 资源安全

---

### P0-2: addClaimedResources NaN传播 — 确认 P0

**裁决**: 确认。即使 sendMail 做了校验，addMail() 和 restoreSaveData 仍可注入脏数据，claimAttachments 到 addClaimedResources 是最终防线。

**修复方案**: 在 `addClaimedResources` 中对每个 amount 做 `Number.isFinite(amount) && amount > 0` 校验。

**严重度**: P0 — 资源安全（纵深防御）

---

### P0-3: restoreSaveData 不校验数据完整性 — 确认 P0

**裁决**: 确认。`data.mails` 为 undefined 时 for...of 崩溃；`mail` 为 null 时 `mail.id` 崩溃。存档损坏是真实场景。

**修复方案**: 
1. 检查 `data.mails` 是否为数组，否则返回 null
2. 过滤掉 null/undefined 的 mail 条目
3. 对每个 mail 的关键字段做基本校验

**严重度**: P0 — 崩溃 + 序列化安全

---

### P0-4: deleteMail 可删除无附件未读邮件 — 确认 P0

**裁决**: 确认。源码逻辑 `mail.attachments.some(a => !a.claimed) && mail.status !== 'expired'` 中，无附件时 `some()` 返回 false，整个条件为 false，不拦截。未读无附件邮件可被删除。

**修复方案**: 增加状态检查：`if (mail.status !== 'read_claimed' && mail.status !== 'expired') return false;`

**严重度**: P0 — 业务逻辑违反

---

### P0-5: loadFromSaveData(null) 崩溃 — 确认 P0

**裁决**: 确认。`loadFromSaveData(null)` 到 `restoreSaveData(null)` 到 `null.version` 导致 TypeError。

**修复方案**: 在 `loadFromSaveData` 入口添加 `if (!data) return;`

**严重度**: P0 — 崩溃

---

### P0-6: sendMail 不检查邮箱容量 — 确认 P0

**裁决**: 确认。MAILBOX_CAPACITY=100 已定义但从未使用。sendMail 无上限检查，可无限创建邮件。

**修复方案**: 在 `sendMail` 开头添加容量检查，超过上限时返回 null。

**严重度**: P0 — 资源溢出

---

### P0-7: createFromTemplate 不校验 attachment.amount — 确认 P0

**裁决**: 确认。与P0-1同源问题，通过模板系统路径注入。

**修复方案**: 在 `createFromTemplate` 和 `createCustom` 的附件生成中添加同样的 `Number.isFinite` 校验。

**严重度**: P0 — 资源安全

---

## P1 裁决（不阻塞，建议后续轮次修复）

| ID | 裁决 | 说明 |
|----|------|------|
| P1-1 | 确认P1 | markRead 返回值语义不清，建议但不阻塞 |
| P1-2 | 确认P1 | starredOnly 未实现，功能缺失但不影响安全 |
| P1-3 | 确认P1 | page=0 返回空数组不崩溃，行为不直观 |
| P1-4 | 确认P1 | hasAttachment/hasAttachments 不一致，可能导致过滤失效 |
| P1-5 | 确认P1 | 重复实现，架构问题 |

---

## 裁决总结

| 维度 | 结果 |
|------|------|
| P0 确认数 | 7/7 |
| P0 驳回数 | 0 |
| P1 确认数 | 5 |
| 修复优先级 | P0-3 > P0-5 > P0-1 > P0-7 > P0-2 > P0-6 > P0-4 |

## 修复验证清单

- [ ] FIX-1: sendMail attachment.amount 校验
- [ ] FIX-2: addClaimedResources amount 校验
- [ ] FIX-3: restoreSaveData 数据完整性校验
- [ ] FIX-4: deleteMail 状态校验
- [ ] FIX-5: loadFromSaveData null 防护
- [ ] FIX-6: sendMail 容量检查
- [ ] FIX-7: createFromTemplate/createCustom amount 校验
- [ ] 穿透验证: 搜索所有 amount 使用处，确认无遗漏
