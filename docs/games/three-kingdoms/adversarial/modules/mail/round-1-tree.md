# Mail 模块 R1 对抗式测试 — 测试分支树

> Builder: 2026-05-01 | 模块: engine/mail | 文件数: 7

## 公开API清单

| # | API | 来源 | 类型 |
|---|-----|------|------|
| 1 | `MailSystem.sendMail(request)` | MailSystem | 写入 |
| 2 | `MailSystem.sendBatch(requests)` | MailSystem | 写入 |
| 3 | `MailSystem.addMail(mail)` | MailSystem | 写入 |
| 4 | `MailSystem.markRead(mailId)` | MailSystem | 状态变更 |
| 5 | `MailSystem.markAllRead(filter?)` | MailSystem | 状态变更 |
| 6 | `MailSystem.claimAttachments(mailId)` | MailSystem | 资源变更 |
| 7 | `MailSystem.claimAllAttachments(filter?)` | MailSystem | 资源变更 |
| 8 | `MailSystem.getMails(filter?, page?)` | MailSystem | 查询 |
| 9 | `MailSystem.getMailCount(filter?)` | MailSystem | 查询 |
| 10 | `MailSystem.getUnreadCount(category?)` | MailSystem | 查询 |
| 11 | `MailSystem.getMail(mailId)` | MailSystem | 查询 |
| 12 | `MailSystem.deleteMail(mailId)` | MailSystem | 删除 |
| 13 | `MailSystem.deleteReadClaimed()` | MailSystem | 删除 |
| 14 | `MailSystem.processExpired()` | MailSystem | 状态变更 |
| 15 | `MailSystem.getCategories()` | MailSystem | 查询 |
| 16 | `MailSystem.getByCategory(category)` | MailSystem | 查询 |
| 17 | `MailSystem.getUnreadCountByCategory()` | MailSystem | 查询 |
| 18 | `MailSystem.getAllMails()` | MailSystem | 查询 |
| 19 | `MailSystem.query(filter)` | MailSystem | 查询 |
| 20 | `MailSystem.sendTemplateMail(templateId, vars, attachments?)` | MailSystem | 写入 |
| 21 | `MailSystem.sendCustomMail(...)` | MailSystem | 写入 |
| 22 | `MailSystem.getSaveData()` | MailSystem | 存档 |
| 23 | `MailSystem.loadFromSaveData(data)` | MailSystem | 存档 |
| 24 | `MailSystem.reset()` | MailSystem | 重置 |
| 25 | `MailTemplateSystem.registerTemplate(template)` | MailTemplateSystem | 写入 |
| 26 | `MailTemplateSystem.getTemplate(templateId)` | MailTemplateSystem | 查询 |
| 27 | `MailTemplateSystem.getAllTemplates()` | MailTemplateSystem | 查询 |
| 28 | `MailTemplateSystem.createFromTemplate(templateId, vars, attachments?)` | MailTemplateSystem | 写入 |
| 29 | `MailTemplateSystem.createCustom(...)` | MailTemplateSystem | 写入 |
| 30 | `MailTemplateSystem.reset()` | MailTemplateSystem | 重置 |
| 31 | `buildTemplateMail(templateId, vars)` | MailPersistence | 纯函数 |
| 32 | `buildSaveData(mails, nextId)` | MailPersistence | 纯函数 |
| 33 | `restoreSaveData(data)` | MailPersistence | 纯函数 |
| 34 | `loadFromStorage(storage)` | MailPersistence | IO |
| 35 | `persistToStorage(storage, data)` | MailPersistence | IO |
| 36 | `clearStorage(storage)` | MailPersistence | IO |
| 37 | `filterMails(mails, filter?)` | MailFilterHelpers | 纯函数 |
| 38 | `getDefaultRetainSeconds(category, defaults)` | MailFilterHelpers | 纯函数 |

---

## 测试分支树

### F-1: sendMail — 正常流
```
F-1-Normal: sendMail({category:'system', title:'T', content:'C', sender:'S'}) → 返回 MailData
  ├─ F-1-1: 验证 id 格式 = "mail_1"
  ├─ F-1-2: 验证 status = 'unread'
  ├─ F-1-3: 验证 isRead = false
  ├─ F-1-4: 验证 sendTime ≈ Date.now()
  ├─ F-1-5: 验证 attachments 生成 id + claimed=false
  ├─ F-1-6: 验证无附件时 attachments = []
  └─ F-1-7: 验证 nextId 自增

F-1-Boundary: sendMail 保留时长
  ├─ F-1-B1: retainSeconds=null → expireTime=null（永不过期）
  ├─ F-1-B2: retainSeconds=0 → expireTime = now
  ├─ F-1-B3: retainSeconds=undefined → 使用分类默认值
  └─ F-1-B4: retainSeconds=负数 → **P0候选**: expireTime 为过去时间

F-1-Error: sendMail 异常输入
  ├─ F-1-E1: title=空字符串 → 仍创建（无校验）
  ├─ F-1-E2: category=无效值 → **P0候选**: TypeScript不防
  ├─ F-1-E3: attachments[].amount=0 → 创建 amount=0 的附件
  ├─ F-1-E4: attachments[].amount=-1 → **P0**: 负数附件
  └─ F-1-E5: attachments[].amount=NaN → **P0**: NaN附件

F-1-Serialize: sendMail 后 getSaveData
  └─ F-1-S1: 发送邮件 → getSaveData → restoreSaveData → 邮件完整恢复
```

### F-2: sendBatch — 批量发送
```
F-2-Normal: sendBatch([req1, req2]) → 返回2个 MailData
  └─ F-2-1: 验证 nextId 连续递增

F-2-Error: sendBatch([])
  └─ F-2-E1: 空数组 → 返回空数组（正常）
```

### F-3: addMail — 直接插入
```
F-3-Normal: addMail(mail) → true
  └─ F-3-1: 验证邮件在 mails 中

F-3-Error: addMail 重复ID
  └─ F-3-E1: 同一ID再次 addMail → 覆盖（Map.set行为）
```

### F-4: markRead — 标记已读
```
F-4-Normal: markRead(mailId) → true
  ├─ F-4-1: unread → read_claimed（无附件）
  ├─ F-4-2: unread → read_unclaimed（有未领附件）
  └─ F-4-3: read_unclaimed → 保持（不变）

F-4-Error: markRead 异常
  ├─ F-4-E1: mailId不存在 → false
  ├─ F-4-E2: status='expired' → false
  └─ F-4-E3: mailId=空字符串 → false

F-4-State: 状态转换矩阵
  ├─ F-4-S1: unread → read_claimed（无附件时）
  ├─ F-4-S2: unread → read_unclaimed（有附件未领时）
  ├─ F-4-S3: read_unclaimed → read_unclaimed（再次markRead不变）
  └─ F-4-S4: read_claimed → read_claimed（不变）
```

### F-5: markAllRead — 批量已读
```
F-5-Normal: markAllRead() → count
  ├─ F-5-1: 3封未读 → count=3
  └─ F-5-2: 带 filter → 只标记匹配的

F-5-Error: markAllRead 无未读邮件
  └─ F-5-E1: count=0
```

### F-6: claimAttachments — 领取附件
```
F-6-Normal: claimAttachments(mailId) → claimed资源
  ├─ F-6-1: 单附件 → claimed = {gold: 100}
  ├─ F-6-2: 多附件同类型 → 累加 {gold: 200}
  ├─ F-6-3: 多附件不同类型 → {gold: 100, grain: 50}
  ├─ F-6-4: status → read_claimed
  ├─ F-6-5: isRead → true
  └─ F-6-6: 所有 attachment.claimed → true

F-6-Error: claimAttachments 异常
  ├─ F-6-E1: mailId不存在 → {}
  ├─ F-6-E2: status='expired' → {}
  ├─ F-6-E3: 附件已全部领取 → {}（无新领取）
  └─ F-6-E4: **P0**: attachment.amount=NaN → 资源系统收到NaN

F-6-Serialize: claimAttachments → save → restore
  └─ F-6-S1: 领取后存档恢复 → claimed状态保持

F-6-Cross: claimAttachments → 资源系统联动
  ├─ F-6-C1: deps.registry 存在 → 调用 resource.addResource
  └─ F-6-C2: deps.registry 不存在 → 静默跳过
```

### F-7: claimAllAttachments — 批量领取
```
F-7-Normal: claimAllAttachments() → BatchOperationResult
  ├─ F-7-1: 3封有附件 → count=3, successIds=[...]
  ├─ F-7-2: claimedResources 累加
  └─ F-7-3: 带 filter → 只领取匹配的

F-7-Error: claimAllAttachments 无可领取
  └─ F-7-E1: count=0, claimedResources={}
```

### F-8: getMails — 分页查询
```
F-8-Normal: getMails(filter, page)
  ├─ F-8-1: 25封邮件，page=1 → 20封
  ├─ F-8-2: page=2 → 5封
  ├─ F-8-3: page=3 → 0封
  ├─ F-8-4: 按sendTime倒序
  └─ F-8-5: 同sendTime按ID倒序

F-8-Error: getMails 异常分页
  ├─ F-8-E1: page=0 → start=-20, 返回空（slice行为）
  └─ F-8-E2: page=-1 → start=-40, 返回空
```

### F-9: getMailCount — 计数
```
F-9-Normal: getMailCount(filter?)
  ├─ F-9-1: 无filter → 全部邮件数
  └─ F-9-2: filter.category='system' → 系统邮件数
```

### F-10: getUnreadCount — 未读计数
```
F-10-Normal: getUnreadCount(category?)
  ├─ F-10-1: 无参数 → 全部未读数
  └─ F-10-2: category='system' → 系统未读数
```

### F-11: getMail — 单封查询
```
F-11-Normal: getMail(mailId) → MailData | undefined
  ├─ F-11-1: 存在 → 返回
  └─ F-11-2: 不存在 → undefined
```

### F-12: deleteMail — 删除
```
F-12-Normal: deleteMail(mailId) → boolean
  ├─ F-12-1: read_claimed → true
  ├─ F-12-2: expired → true
  └─ F-12-3: 无附件的已读邮件 → true

F-12-Error: deleteMail 删除保护
  ├─ F-12-E1: unread → false（有未读保护）
  ├─ F-12-E2: read_unclaimed（有未领附件）→ false
  ├─ F-12-E3: mailId不存在 → false
  └─ F-12-E4: **注意**: 无附件的unread → 有未领附件检查，但无附件时some()=false，应该能删？
      → 源码: `mail.attachments.some(a => !a.claimed) && mail.status !== 'expired'`
      → 无附件的unread: some()=false → 整个条件=false → 返回false被跳过 → 进入delete → true
      → **P0候选**: 可以删除未读邮件（只要无附件）
```

### F-13: deleteReadClaimed — 批量删除
```
F-13-Normal: deleteReadClaimed() → count
  ├─ F-13-1: 删除 read_claimed + expired
  └─ F-13-2: 保留 unread + read_unclaimed
```

### F-14: processExpired — 过期处理
```
F-14-Normal: processExpired() → count
  ├─ F-14-1: expireTime <= now → status='expired', count++
  └─ F-14-2: expireTime > now → 不变

F-14-Error: processExpired 边界
  ├─ F-14-E1: expireTime = now → 过期（<=）
  └─ F-14-E2: expireTime = null → 不处理
```

### F-15: getCategories — 分类列表
```
F-15-Normal: getCategories() → ['system', 'reward', ...]
```

### F-16: getByCategory — 按分类查询
```
F-16-Normal: getByCategory('system') → 系统邮件按时间倒序
```

### F-17: getUnreadCountByCategory — 分类未读
```
F-17-Normal: getUnreadCountByCategory() → {system: 2, reward: 1}
```

### F-18: getAllMails — 全部邮件
```
F-18-Normal: getAllMails() → 按时间倒序
```

### F-19: query — 条件查询
```
F-19-Normal: query({category:'system'}) → 过滤结果
  ├─ F-19-1: category 过滤
  ├─ F-19-2: status 过滤
  └─ F-19-3: hasAttachments 过滤

F-19-Error: query 空条件
  └─ F-19-E1: query({}) → 全部邮件
```

### F-20: sendTemplateMail — 模板发送
```
F-20-Normal: sendTemplateMail('offline_reward', {hours:2, grain:100, gold:200, troops:50, mandate:1})
  ├─ F-20-1: 返回 MailData
  └─ F-20-2: content 包含变量值

F-20-Error: sendTemplateMail 不存在的模板
  └─ F-20-E1: templateId='nonexist' → null
```

### F-21: sendCustomMail — 自定义发送
```
F-21-Normal: sendCustomMail('system', 'T', 'C', 'S') → MailData
```

### F-22: getSaveData / loadFromSaveData — 存档
```
F-22-Normal: getSaveData() → loadFromSaveData(data) → 状态一致
  ├─ F-22-1: 邮件数量一致
  ├─ F-22-2: nextId 一致
  └─ F-22-3: 邮件内容完整

F-22-Error: loadFromSaveData 异常
  ├─ F-22-E1: version 不匹配 → 不恢复（restoreSaveData返回null）
  ├─ F-22-E2: data=null → **P0候选**: loadFromSaveData(null) → restoreSaveData(null) → 崩溃？
  └─ F-22-E3: data.mails 含无效数据 → **P0候选**
```

### F-23: reset — 重置
```
F-23-Normal: reset() → mails清空, nextId=1
  ├─ F-23-1: mails.size=0
  └─ F-23-2: nextId=1
```

### F-24: MailTemplateSystem — 模板系统
```
F-24-Normal: createFromTemplate('offline_reward', {hours:2, ...})
  ├─ F-24-1: title = '离线收益报告'
  ├─ F-24-2: content 中 {{hours}} 被替换
  └─ F-24-3: idCounter 自增

F-24-Error: createFromTemplate 不存在
  └─ F-24-E1: throw Error

F-24-Normal: createCustom(...)
  └─ F-24-2: 返回 MailData

F-24-Normal: registerTemplate + getTemplate
  └─ F-24-3: 注册后可获取

F-24-Normal: reset()
  └─ F-24-4: 恢复内置模板
```

### F-25: MailPersistence — 持久化
```
F-25-Normal: persistToStorage + loadFromStorage
  └─ F-25-1: 写入后读取一致

F-25-Error: loadFromStorage 异常
  ├─ F-25-E1: JSON损坏 → null
  └─ F-25-E2: 空storage → null

F-25-Normal: clearStorage
  └─ F-25-3: 清除后 loadFromStorage → null
```

### F-26: filterMails — 过滤
```
F-26-Normal: filterMails(mails, {category:'system'})
  ├─ F-26-1: 只返回系统邮件
  ├─ F-26-2: category='all' → 全部
  └─ F-26-3: status 过滤
```

### F-27: getDefaultRetainSeconds — 默认保留时长
```
F-27-Normal: getDefaultRetainSeconds('system', {...})
  ├─ F-27-1: system → SYSTEM_RETAIN_SECONDS
  ├─ F-27-2: reward → REWARD_RETAIN_SECONDS
  └─ F-27-3: 其他 → DEFAULT_RETAIN_SECONDS
```

---

## 跨系统链路（N=2×2=4条）

| # | 链路 | 验证点 |
|---|------|--------|
| L-1 | Mail → Resource: claimAttachments → addResource | 资源正确增加 |
| L-2 | Mail → Storage: persist → load → restore | 存档完整性 |
| L-3 | MailTemplate → Mail: createFromTemplate → addMail | 模板邮件入库 |
| L-4 | Engine.save → Mail.getSaveData | 引擎级保存覆盖 |

---

## 覆盖统计

| 维度 | 节点数 | P0候选 |
|------|--------|--------|
| Normal | 38 | 0 |
| Boundary | 4 | 1 |
| Error | 15 | 3 |
| Serialize | 2 | 1 |
| Cross | 4 | 0 |
| State | 4 | 0 |
| **合计** | **67** | **5** |
