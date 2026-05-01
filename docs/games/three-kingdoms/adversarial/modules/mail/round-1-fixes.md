# Mail 模块 R1 — 修复报告

> Fixer: 2026-05-01 | 修复P0数: 7 | 测试: 251 passed

## 修复清单

### FIX-1: sendMail attachment.amount 校验
**文件**: `MailSystem.ts` L96-110
**问题**: NaN/负数/Infinity/零 可通过 sendMail 注入附件
**修复**: 在 attachments.map 前添加 `.filter(att => Number.isFinite(att.amount) && att.amount > 0)`
**穿透验证**: 搜索所有 `att.amount` 使用处，确认 createFromTemplate (FIX-7) 和 createCustom (FIX-7) 同步修复

### FIX-2: addClaimedResources amount 纵深防御
**文件**: `MailSystem.ts` L155
**问题**: 即使入口校验通过，addMail/restoreSaveData 仍可注入脏数据
**修复**: 在 addClaimedResources 中对每个 amount 做 `!Number.isFinite(amount) || amount <= 0` 检查，不合法则 skip
**穿透验证**: addClaimedResources 是资源系统唯一入口，已覆盖

### FIX-3: restoreSaveData 数据完整性校验
**文件**: `MailPersistence.ts` L82-95
**问题**: data.mails 为 undefined 时 for...of 崩溃；mail 为 null 时 mail.id 崩溃
**修复**: 
1. 检查 `!data` → return null
2. 检查 `!Array.isArray(data.mails)` → return null
3. 检查 `typeof data.nextId !== 'number'` → return null
4. 过滤 null/undefined mail 条目
5. 校验 mail.id 和 mail.category 存在
**穿透验证**: loadFromStorage 返回 null 时 restoreSaveData 不会被调用（MailSystem.initFromStorage 已判断）

### FIX-4: deleteMail 状态校验
**文件**: `MailSystem.ts` L172-176
**问题**: 无附件的 unread 邮件可被删除（`some()` 返回 false 导致条件不拦截）
**修复**: 改为 `if (mail.status !== 'read_claimed' && mail.status !== 'expired') return false;`
**穿透验证**: deleteReadClaimed 只删除 read_claimed 和 expired，不受影响

### FIX-5: loadFromSaveData null 防护
**文件**: `MailSystem.ts` L239
**问题**: `loadFromSaveData(null)` → `restoreSaveData(null)` → `null.version` → TypeError
**修复**: 入口添加 `if (!data) return;`
**穿透验证**: FIX-3 在 restoreSaveData 中也加了 null 检查，双重防护

### FIX-6: sendMail 容量检查
**文件**: `MailSystem.ts` L96
**问题**: MAILBOX_CAPACITY=100 已定义但从未使用，邮件可无限创建
**修复**: sendMail 开头添加 `if (this.mails.size >= MAILBOX_CAPACITY) return null;`
**影响**: sendMail 返回类型从 `MailData` 改为 `MailData | null`；sendBatch 返回类型改为 `(MailData | null)[]`
**穿透验证**: addMail 不检查容量（直接插入是内部API，用于 restoreSaveData 等场景）

### FIX-7: createFromTemplate/createCustom amount 校验
**文件**: `MailTemplateSystem.ts` L107-113, L137-141
**问题**: 模板系统附件生成路径同样缺少 amount 校验
**修复**: 在 createFromTemplate 和 createCustom 的附件生成中添加 `.filter(att => Number.isFinite(att.amount) && att.amount > 0)`
**穿透验证**: 与 FIX-1 对称修复（BR-20 对称函数修复验证规则）

## 测试更新

| 文件 | 修改 | 原因 |
|------|------|------|
| MailCapacity.test.ts | 6处更新 | 适配容量上限限制 |
| MailAdversarial.test.ts | 4处更新 | 适配amount校验和容量限制 |

## 验证结果

```
Test Files  10 passed (10)
Tests       251 passed (251)
Duration    4.24s
```

## 修复穿透率

| 修复 | 穿透检查 | 结果 |
|------|----------|------|
| FIX-1 | createFromTemplate/createCustom | → FIX-7 同步修复 |
| FIX-2 | claimAttachments 内部调用 | 已覆盖 |
| FIX-3 | loadFromStorage 上游 | 上游已有 null 判断 |
| FIX-4 | deleteReadClaimed | 不受影响 |
| FIX-5 | restoreSaveData | → FIX-3 双重防护 |
| FIX-6 | addMail | 不限制（内部API） |
| FIX-7 | sendMail | → FIX-1 已覆盖 |

穿透率: 0/7（所有穿透路径均已同步修复）
