# Mail 模块 R1 — Challenger 审查报告

> Challenger: 2026-05-01 | 审查范围: 全部7个源文件

## 审查方法论

逐API扫描5个维度：Normal flow、Boundary conditions、Error paths、Cross-system interactions、Data lifecycle。
重点检查：NaN/null/undefined注入、序列化/反序列化安全、状态机完整性、资源安全。

---

## P0 级缺陷（必须修复）

### P0-1: sendMail 不校验 attachment.amount — NaN/负数/Infinity 可注入

**文件**: `MailSystem.ts` L105-109
**严重度**: P0 — 资源安全
**规则**: BR-02 (数值API必须检查null/undefined/NaN/负值/溢出), BR-17 (战斗数值安全)

```typescript
// 源码：无任何校验
const attachments: MailAttachment[] = (request.attachments ?? []).map((att, idx) => ({
  id: `${id}_att_${idx}`,
  resourceType: att.resourceType,
  amount: att.amount,        // ← NaN/负数/Infinity 直接通过
  claimed: false,
}));
```

**攻击路径**:
1. `sendMail({..., attachments: [{resourceType:'gold', amount: NaN}]})` → 创建 amount=NaN 的附件
2. `claimAttachments(id)` → `claimed['gold'] = NaN`
3. `addClaimedResources({gold: NaN})` → `resourceSystem.addResource('gold', NaN)` → 资源系统被污染

**影响**: NaN传播到资源系统，可能导致所有后续资源操作失效（NaN + anything = NaN）

---

### P0-2: claimAttachments NaN传播到资源系统

**文件**: `MailSystem.ts` L152-155
**严重度**: P0 — 资源安全
**规则**: BR-21 (资源比较NaN防护)

```typescript
private addClaimedResources(claimed: Record<string, number>): void {
    // ...
    for (const [type, amount] of Object.entries(claimed)) {
        resourceSystem.addResource(type, amount);  // ← amount 可能是 NaN
    }
}
```

**攻击路径**: 即使P0-1修复了sendMail，如果通过 addMail() 直接注入含NaN附件的邮件，claimAttachments仍会传播NaN。

**影响**: 资源系统污染。

---

### P0-3: restoreSaveData 不校验数据完整性 — null/undefined/NaN可注入

**文件**: `MailPersistence.ts` L82-89
**严重度**: P0 — 序列化安全
**规则**: BR-10 (deserialize覆盖验证：null/undefined输入必须安全处理)

```typescript
export function restoreSaveData(data: MailSaveData): { mails: Map<string, MailData>; nextId: number } | null {
  if (data.version !== MAIL_SAVE_VERSION) return null;
  const mails = new Map<string, MailData>();
  for (const mail of data.mails) {    // ← data.mails 可能是 undefined
    mails.set(mail.id, mail);          // ← mail 可能是 null
  }
  return { mails, nextId: data.nextId };
}
```

**攻击路径**:
1. `restoreSaveData({version:1, mails: undefined as any, nextId:1})` → `for...of undefined` → **TypeError崩溃**
2. `restoreSaveData({version:1, mails: [null] as any, nextId:1})` → `mail.id` → **TypeError崩溃**
3. `restoreSaveData({version:1, mails: [{id:'x', category:'system', title:'T', content:'C', sender:'S', sendTime:NaN, expireTime:null, status:'unread', isRead:false, attachments:[{id:'a', resourceType:'gold', amount:NaN, claimed:false}]}], nextId:1})` → 恢复含NaN附件的邮件

**影响**: 游戏加载时崩溃或恢复脏数据。

---

### P0-4: deleteMail 可删除无附件的未读邮件 — 违反业务规则

**文件**: `MailSystem.ts` L172-176
**严重度**: P0 — 业务逻辑缺陷

```typescript
deleteMail(mailId: string): boolean {
    const mail = this.mails.get(mailId);
    if (!mail) return false;
    if (mail.attachments.some(a => !a.claimed) && mail.status !== 'expired') return false;
    // ↑ 无附件时 some()=false → 整个条件=false → 不拦截 → 可以删除未读邮件
    this.mails.delete(mailId);
    this.persist();
    return true;
}
```

**攻击路径**:
1. `sendMail({category:'system', title:'T', content:'C', sender:'S'})` → 无附件的邮件
2. `deleteMail('mail_1')` → 返回 true → 未读邮件被删除

**影响**: 违反"只能删除已读已领或已过期"的业务规则。玩家可能误删未读邮件。

---

### P0-5: loadFromSaveData 不处理 null 输入 — 崩溃

**文件**: `MailSystem.ts` L237-241
**严重度**: P0 — 崩溃
**规则**: BR-10 (null/undefined输入必须安全处理)

```typescript
loadFromSaveData(data: MailSaveData): void {
    const restored = restoreSaveData(data);  // ← data 可能是 null/undefined
    // restoreSaveData 访问 data.version → TypeError
}
```

**攻击路径**: `mailSystem.loadFromSaveData(null as any)` → `data.version` → **TypeError崩溃**

**影响**: 存档损坏时游戏无法启动。

---

### P0-6: sendMail 不检查邮箱容量 — 可无限创建邮件

**文件**: `MailSystem.ts` L96
**严重度**: P0 — 资源溢出
**规则**: BR-12 (溢出闭环：资源系统必须有上限和溢出处理)

```typescript
sendMail(request: MailSendRequest): MailData {
    const id = `mail_${this.nextId++}`;
    // ← 无 MAILBOX_CAPACITY 检查
    this.mails.set(id, mail);
}
```

**攻击路径**: 循环调用 `sendMail` 超过 MAILBOX_CAPACITY(100) → 邮件无限增长 → 内存溢出

**影响**: 邮件系统无上限保护，长期运行可能导致性能问题。

---

### P0-7: MailTemplateSystem.createFromTemplate — 无附件amount校验

**文件**: `MailTemplateSystem.ts` L107-111
**严重度**: P0 — 资源安全（与P0-1同源）

```typescript
const mailAttachments: MailAttachment[] = attachmentDefs.map(att => ({
    id: `att_${++this.idCounter}`,
    resourceType: att.resourceType,
    amount: att.amount,    // ← NaN/负数/Infinity 直接通过
    claimed: false,
}));
```

**攻击路径**: 同P0-1，通过模板系统注入NaN附件。

---

## P1 级缺陷（建议修复）

### P1-1: markRead 状态转换不完整 — read_claimed 再 markRead 无变化但不报错

**文件**: `MailSystem.ts` L121-128
**说明**: 已读已领的邮件再次 markRead 返回 true 但实际无变化，可能误导调用方。

### P1-2: query 方法 starredOnly 参数未实现

**文件**: `MailSystem.ts` L215
```typescript
query(filter: { ...; starredOnly?: boolean; ... }): MailData[] {
    // starredOnly 参数在 filter 逻辑中完全未使用
}
```

### P1-3: getMails page=0 或负数时行为异常

**文件**: `MailSystem.ts` L161
```typescript
const start = (page - 1) * MAILS_PER_PAGE;  // page=0 → start=-20
```
负数 start 传给 slice 不会报错但返回空数组，不崩溃但行为不直观。

### P1-4: MailFilter.hasAttachment vs hasAttachments 字段不一致

**文件**: `MailFilterHelpers.ts` L8 vs `mail.types.ts` L124
- MailFilter 接口同时定义了 `hasAttachment?: boolean` 和 `hasAttachments?: boolean`
- `filterMails` 只检查 `filter?.hasAttachment`，不检查 `hasAttachments`
- 而 `query` 方法检查的是 `filter.hasAttachments`
- **不一致**可能导致部分过滤条件被忽略

### P1-5: buildTemplateMail 与 MailTemplateSystem 重复实现

**文件**: `MailPersistence.ts` vs `MailTemplateSystem.ts`
两处都有 BUILTIN_TEMPLATES 和模板插值逻辑，容易不同步。

---

## P0 汇总

| ID | 缺陷 | 文件 | 行号 | 规则 |
|----|------|------|------|------|
| P0-1 | sendMail不校验attachment.amount (NaN/负数/Infinity) | MailSystem.ts | L107 | BR-02, BR-17 |
| P0-2 | addClaimedResources不校验amount (NaN传播) | MailSystem.ts | L155 | BR-21 |
| P0-3 | restoreSaveData不校验数据完整性 (null/undefined崩溃) | MailPersistence.ts | L84-87 | BR-10 |
| P0-4 | deleteMail可删除无附件未读邮件 | MailSystem.ts | L173 | 业务规则 |
| P0-5 | loadFromSaveData(null)崩溃 | MailSystem.ts | L239 | BR-10 |
| P0-6 | sendMail不检查邮箱容量上限 | MailSystem.ts | L96 | BR-12 |
| P0-7 | createFromTemplate不校验attachment.amount | MailTemplateSystem.ts | L110 | BR-02 |

**P0总数**: 7
**P1总数**: 5
