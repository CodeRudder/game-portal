/**
 * Toast 单元测试
 *
 * 测试场景：
 * - 显示消息文本
 * - 4种类型（success/warning/danger/info）样式不同
 * - 自动消失（setTimeout）
 * - 默认类型为 info
 * - 最大堆叠3条
 *
 * 注意：Toast 使用命令式 API（Toast.show / Toast.success 等），
 * 通过 createRoot 直接渲染到 DOM，不使用 React 组件树。
 * createRoot.render() 是异步的，需要用 act() + await setTimeout 刷新。
 * 不能使用 vi.useFakeTimers()，因为它会阻止 React 的微任务刷新。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, act } from '@testing-library/react';
import { Toast, ToastType } from '../Toast';

// ── Mock CSS ──
vi.mock('../Toast.css', () => ({}));

// Helper: wrap Toast calls in act() and flush React renders
async function showToast(fn: () => void) {
  act(() => {
    fn();
  });
  // Flush React's createRoot async render
  await act(async () => {
    await new Promise(r => setTimeout(r, 10));
  });
}

// Helper: advance time and flush React renders
async function advanceTime(ms: number) {
  await act(async () => {
    await new Promise(r => setTimeout(r, ms));
  });
}

describe('Toast', () => {
  beforeEach(() => {
    // 清理 DOM 中可能残留的 toast 容器
    const existing = globalThis.document?.querySelector('.tk-toast-portal');
    if (existing) existing.remove();
  });

  afterEach(() => {
    // 清理
    const existing = globalThis.document?.querySelector('.tk-toast-portal');
    if (existing) existing.remove();
  });

  it('应显示消息文本', async () => {
    await showToast(() => {
      Toast.show({ message: '测试消息' });
    });

    expect(screen.getByText('测试消息')).toBeInTheDocument();
  });

  it('4种类型应有不同的CSS类名', async () => {
    const types: ToastType[] = ['success', 'warning', 'danger', 'info'];

    for (const type of types) {
      await showToast(() => {
        Toast.show({ message: `${type}消息`, type });
      });
    }

    // 验证每种类型的 CSS 类名
    for (const type of types) {
      const toastEl = screen.getByText(`${type}消息`).closest('.tk-toast');
      expect(toastEl?.classList.contains(`tk-toast--${type}`)).toBe(true);
    }
  });

  it('success类型应显示✅图标', async () => {
    await showToast(() => {
      Toast.success('操作成功');
    });

    expect(screen.getByText('操作成功')).toBeInTheDocument();
    expect(screen.getByText('✅')).toBeInTheDocument();
  });

  it('warning类型应显示⚠️图标', async () => {
    await showToast(() => {
      Toast.warning('注意警告');
    });

    expect(screen.getByText('注意警告')).toBeInTheDocument();
    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });

  it('danger类型应显示❌图标', async () => {
    await showToast(() => {
      Toast.danger('危险操作');
    });

    expect(screen.getByText('危险操作')).toBeInTheDocument();
    expect(screen.getByText('❌')).toBeInTheDocument();
  });

  it('info类型应显示ℹ️图标', async () => {
    await showToast(() => {
      Toast.info('提示信息');
    });

    expect(screen.getByText('提示信息')).toBeInTheDocument();
    expect(screen.getByText('ℹ️')).toBeInTheDocument();
  });

  it('应在指定时间后自动消失', async () => {
    await showToast(() => {
      Toast.show({ message: '自动消失测试', duration: 2000 });
    });

    // 消息应该存在
    expect(screen.getByText('自动消失测试')).toBeInTheDocument();

    // 等待 2000ms 触发消失动画 + 200ms 让移除动画完成
    await advanceTime(2200);

    // 消息应该已消失
    expect(screen.queryByText('自动消失测试')).not.toBeInTheDocument();
  });

  it('默认类型应为 info', async () => {
    await showToast(() => {
      Toast.show({ message: '默认类型' });
    });

    const toastEl = screen.getByText('默认类型').closest('.tk-toast');
    expect(toastEl?.classList.contains('tk-toast--info')).toBe(true);
  });

  it('最大堆叠3条，第4条应挤掉第1条', async () => {
    await showToast(() => {
      Toast.show({ message: '消息1' });
    });
    await showToast(() => {
      Toast.show({ message: '消息2' });
    });
    await showToast(() => {
      Toast.show({ message: '消息3' });
    });
    await showToast(() => {
      Toast.show({ message: '消息4' });
    });

    // 消息1 应被移除（超过 MAX_STACK=3）
    expect(screen.queryByText('消息1')).not.toBeInTheDocument();

    // 消息 2、3、4 应存在
    expect(screen.getByText('消息2')).toBeInTheDocument();
    expect(screen.getByText('消息3')).toBeInTheDocument();
    expect(screen.getByText('消息4')).toBeInTheDocument();
  });
});
