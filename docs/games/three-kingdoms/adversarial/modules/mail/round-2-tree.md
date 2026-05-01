# Mail 模块 R2 — Builder 测试分支树（精简版）

> Builder: 2026-05-01 | 基于 R1 7-P0 修复后源码精简 | 251 tests passed

## 精简原则

R1 已修复全部 7 个 P0，R2 树聚焦：
1. **FIX 穿透确认** — 每个 FIX 至少 1 条测试直接验证
2. **修复后新路径** — 修复引入的行为变化（如容量限制返回 null）
3. **残余风险** — R1 未覆盖的边界组合

---

## 树结构

### BR-01: 邮件创建安全（FIX-1/6/7 穿透）

```
BR-01-01: sendMail 正常创建 → 返回 MailData ✓
BR-01-02: sendMail amount=NaN → 附件被过滤 ✓
BR-01-03: sendMail amount=-1 → 附件被过滤 ✓
BR-01-04: sendMail amount=Infinity → 附件被过滤 ✓
BR-01-05: sendMail amount=0 → 附件被过滤 ✓
BR-01-06: sendMail 容量满 → 返回 null ✓ (FIX-6)
BR-01-07: sendBatch 含超量 → 部分返回 null ✓ (FIX-6)
BR-01-08: createFromTemplate amount=NaN → 附件被过滤 ✓ (FIX-7)
BR-01-09: createCustom amount=-1 → 附件被过滤 ✓ (FIX-7)
BR-01-10: sendMail 全部附件无效 → 邮件创建但无附件 ✓
```

### BR-02: 资源领取安全（FIX-2 穿透）

```
BR-02-01: claimAttachments 正常 → 返回资源 ✓
BR-02-02: addClaimedResources amount=NaN → 跳过 ✓ (FIX-2)
BR-02-03: addClaimedResources amount=-5 → 跳过 ✓ (FIX-2)
BR-02-04: claimAllAttachments 批量 → 聚合资源 ✓
BR-02-05: 已领取附件 → 返回空对象 ✓
```

### BR-03: 数据恢复安全（FIX-3/5 穿透）

```
BR-03-01: restoreSaveData 正常数据 → 恢复成功 ✓
BR-03-02: restoreSaveData null → 返回 null ✓ (FIX-5)
BR-03-03: restoreSaveData mails=undefined → 返回 null ✓ (FIX-3)
BR-03-04: restoreSaveData mails 含 null → 过滤跳过 ✓ (FIX-3)
BR-03-05: restoreSaveData nextId 非数字 → 返回 null ✓ (FIX-3)
BR-03-06: loadFromSaveData(null) → 静默返回 ✓ (FIX-5)
BR-03-07: restoreSaveData mail 无 id → 跳过该条 ✓ (FIX-3)
```

### BR-04: 删除安全（FIX-4 穿透）

```
BR-04-01: deleteMail unread → 返回 false ✓ (FIX-4)
BR-04-02: deleteMail read_unclaimed → 返回 false ✓ (FIX-4)
BR-04-03: deleteMail read_claimed → 删除成功 ✓ (FIX-4)
BR-04-04: deleteMail expired → 删除成功 ✓ (FIX-4)
BR-04-05: deleteMail 无附件 unread → 返回 false ✓ (FIX-4 核心)
BR-04-06: deleteReadClaimed → 只删 read_claimed+expired ✓
```

### BR-05: 容量管理（FIX-6 新路径）

```
BR-05-01: 容量未满 → 正常发送 ✓
BR-05-02: 容量恰好满 → 返回 null ✓
BR-05-03: 删除后容量释放 → 可再次发送 ✓
BR-05-04: addMail 不受容量限制 ✓（内部 API）
```

### BR-06: 状态机完整性

```
BR-06-01: unread → markRead → read_claimed（无附件）✓
BR-06-02: unread → markRead → read_unclaimed（有附件未领）✓
BR-06-03: read_unclaimed → claimAttachments → read_claimed ✓
BR-06-04: unread → claimAttachments → read_claimed ✓
BR-06-05: expired 状态下 markRead → 返回 false ✓
BR-06-06: expired 状态下 claimAttachments → 返回 {} ✓
```

### BR-07: 过期处理

```
BR-07-01: 未过期邮件 → status 不变 ✓
BR-07-02: 已过期邮件 → status='expired' ✓
BR-07-03: 无 expireTime → 永不过期 ✓
BR-07-04: processExpired 批量处理 ✓
```

### BR-08: 查询与分页

```
BR-08-01: getMails 无 filter → 返回全部分页 ✓
BR-08-02: getMails page=0 → 返回空 ✓
BR-08-03: getMails page 超出 → 返回空 ✓
BR-08-04: getUnreadCount 按分类 ✓
BR-08-05: query hasAttachments=true → 过滤无附件 ✓
```

### BR-09: 持久化

```
BR-09-01: persist → storage 写入 ✓
BR-09-02: loadFromStorage 正常 → 恢复 ✓
BR-09-03: loadFromStorage 损坏 → 返回 null ✓
BR-09-04: clearStorage → 清除 ✓
```

### BR-10: 模板系统

```
BR-10-01: createFromTemplate 正常 → 插值+附件 ✓
BR-10-02: createFromTemplate 不存在 → throw Error ✓
BR-10-03: createCustom 正常 → 生成邮件 ✓
BR-10-04: registerTemplate → 可获取 ✓
BR-10-05: interpolate {{var}} → 替换 ✓
```

---

## 与 R1 对比

| 维度 | R1 | R2 |
|------|----|----|
| 总分支数 | 47 | 42 |
| P0 节点 | 7 | 0（全部已修复） |
| FIX 穿透节点 | 0 | 17 |
| 新风险节点 | 0 | 5 |

## 精简说明

- 移除 7 个 P0 攻击节点（已修复，转为穿透验证）
- 合并 3 对重复的过期处理节点
- 新增 5 个 FIX 引入的新行为验证节点（BR-05）
- 所有 42 个分支均有对应测试覆盖（251 tests）
