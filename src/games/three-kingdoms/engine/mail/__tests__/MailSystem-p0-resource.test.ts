/**
 * P0-1 修复测试：邮件附件领取后资源应实际到账
 *
 * 验证 claimAttachments / claimAllAttachments 调用后，
 * 通过 deps.registry 获取的 ResourceSystem.addResource 被正确调用。
 *
 * @module tests/mail/MailSystem-p0-resource
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MailSystem } from '../MailSystem';
import type { ISystemDeps } from '../../../core/types/subsystem';
import type { ISubsystem } from "../../../core/types";

// ── Mock 依赖 ──

function createMockResourceSystem() {
  return {
    addResource: vi.fn((type: string, amount: number) => amount),
    name: 'resource',
  };
}

function createMockRegistry(resourceSystem: ReturnType<typeof createMockResourceSystem>) {
  return {
    get: vi.fn((name: string) => {
      if (name === 'resource') return resourceSystem;
      return undefined;
    }),
    getAll: vi.fn(() => new Map()),
    has: vi.fn((name: string) => name === 'resource'),
    register: vi.fn(),
    unregister: vi.fn(),
  };
}

function createMockDeps(resourceSystem: ReturnType<typeof createMockResourceSystem>) {
  return {
    eventBus: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    } as unknown as Record<string, unknown>,
    config: { get: vi.fn() as unknown as (key: string) => unknown },
    registry: createMockRegistry(resourceSystem) as unknown as ISubsystem,
  } as ISystemDeps;
}

// ── 测试 ──

describe('P0-1: 邮件附件领取后资源到账', () => {
  let mailSystem: MailSystem;
  let mockResourceSystem: ReturnType<typeof createMockResourceSystem>;
  let mockDeps: ISystemDeps;

  beforeEach(() => {
    mockResourceSystem = createMockResourceSystem();
    mockDeps = createMockDeps(mockResourceSystem);
    mailSystem = new MailSystem();
    // 初始化，注入依赖（包含 registry 中的 resource 系统）
    mailSystem.init(mockDeps);
  });

  it('领取单封邮件附件时，资源应增加到 ResourceSystem', () => {
    // 发送带附件的邮件
    const mail = mailSystem.sendMail({
      category: 'reward',
      title: '战斗奖励',
      content: '恭喜获得奖励',
      sender: '系统',
      attachments: [
        { resourceType: 'gold', amount: 500 },
        { resourceType: 'grain', amount: 200 },
      ],
    });

    // 记录领取前的资源系统调用次数
    const callsBefore = mockResourceSystem.addResource.mock.calls.length;

    // 领取附件
    const claimed = mailSystem.claimAttachments(mail.id);

    // 验证返回了正确的资源
    expect(claimed.gold).toBe(500);
    expect(claimed.grain).toBe(200);

    // 验证 ResourceSystem.addResource 被调用了 2 次（gold + grain）
    expect(mockResourceSystem.addResource).toHaveBeenCalledTimes(callsBefore + 2);

    // 验证调用了正确的参数
    expect(mockResourceSystem.addResource).toHaveBeenCalledWith('gold', 500);
    expect(mockResourceSystem.addResource).toHaveBeenCalledWith('grain', 200);
  });

  it('领取单封邮件附件（仅一种资源）', () => {
    const mail = mailSystem.sendMail({
      category: 'system',
      title: '新手礼包',
      content: '领取奖励',
      sender: '系统',
      attachments: [
        { resourceType: 'gold', amount: 1000 },
      ],
    });

    mailSystem.claimAttachments(mail.id);

    expect(mockResourceSystem.addResource).toHaveBeenCalledWith('gold', 1000);
  });

  it('批量领取附件时，所有邮件资源都应到账', () => {
    // 注意：init() 会自动发送一封欢迎邮件（含 gold 1000 + recruitToken 5）
    // 先领取欢迎邮件，确保后续批量领取只包含我们新发的邮件
    const welcomeMail = mailSystem.getAllMails().find(m => m.title === '欢迎来到三国霸业！');
    if (welcomeMail) {
      mailSystem.claimAttachments(welcomeMail.id);
    }

    // 清空 mock 调用记录
    mockResourceSystem.addResource.mockClear();

    // 发送 3 封带附件的邮件
    mailSystem.sendMail({
      category: 'reward',
      title: '奖励1',
      content: '',
      sender: '系统',
      attachments: [{ resourceType: 'gold', amount: 100 }],
    });
    mailSystem.sendMail({
      category: 'reward',
      title: '奖励2',
      content: '',
      sender: '系统',
      attachments: [{ resourceType: 'gold', amount: 200 }],
    });
    mailSystem.sendMail({
      category: 'reward',
      title: '奖励3',
      content: '',
      sender: '系统',
      attachments: [{ resourceType: 'grain', amount: 500 }],
    });

    const result = mailSystem.claimAllAttachments();

    expect(result.count).toBe(3);
    expect(result.claimedResources.gold).toBe(300);
    expect(result.claimedResources.grain).toBe(500);

    // 验证 addResource 被调用了 3 次（每封邮件的附件各一次）
    expect(mockResourceSystem.addResource).toHaveBeenCalledWith('gold', 100);
    expect(mockResourceSystem.addResource).toHaveBeenCalledWith('gold', 200);
    expect(mockResourceSystem.addResource).toHaveBeenCalledWith('grain', 500);
  });

  it('重复领取不应重复增加资源', () => {
    const mail = mailSystem.sendMail({
      category: 'reward',
      title: '奖励',
      content: '',
      sender: '系统',
      attachments: [{ resourceType: 'gold', amount: 100 }],
    });

    // 第一次领取
    mailSystem.claimAttachments(mail.id);
    expect(mockResourceSystem.addResource).toHaveBeenCalledTimes(1);

    // 第二次领取（已领取，不应再增加资源）
    const claimed = mailSystem.claimAttachments(mail.id);
    expect(Object.keys(claimed)).toHaveLength(0);
    expect(mockResourceSystem.addResource).toHaveBeenCalledTimes(1); // 不变
  });

  it('无 deps 时（独立使用）不报错，静默跳过资源增加', () => {
    // 创建不注入 deps 的邮件系统
    const standalone = new MailSystem();
    // 不调用 init()，所以 deps 未设置

    const mail = standalone.sendMail({
      category: 'reward',
      title: '奖励',
      content: '',
      sender: '系统',
      attachments: [{ resourceType: 'gold', amount: 100 }],
    });

    // 应不抛异常
    expect(() => standalone.claimAttachments(mail.id)).not.toThrow();
    const claimed = standalone.claimAttachments(mail.id);
    // 第二次调用（已领取）
    expect(Object.keys(claimed)).toHaveLength(0);
  });

  it('registry 中无 resource 子系统时不报错', () => {
    const emptyDeps = {
      eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } as unknown as Record<string, unknown>,
      config: { get: vi.fn() as unknown as (key: string) => unknown },
      registry: {
        get: vi.fn(() => { throw new Error('not found'); }),
        getAll: vi.fn(() => new Map()),
        has: vi.fn(() => false),
        register: vi.fn(),
        unregister: vi.fn(),
      } as unknown as Record<string, unknown>,
    } as ISystemDeps;

    const sys = new MailSystem();
    sys.init(emptyDeps);

    const mail = sys.sendMail({
      category: 'reward',
      title: '奖励',
      content: '',
      sender: '系统',
      attachments: [{ resourceType: 'gold', amount: 100 }],
    });

    // 应不抛异常
    expect(() => sys.claimAttachments(mail.id)).not.toThrow();
  });
});
