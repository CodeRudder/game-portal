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
 * 
 * 关键设计决策：
 * - 不使用 vi.useFakeTimers()，因为它阻止 React 微任务刷新
 * - 不在测试间移除 DOM 容器，因为 Toast 模块的 containerEl/root 是模块级变量
 * - activeToasts 是模块级状态，测试间会累积（模拟真实使用场景）
 * - 使用长 duration 避免测试中途 toast 自动消失
 * - "最大堆叠3条"测试在所有其他测试之后运行，验证堆叠逻辑
 */

import { describe, it, expect, vi } from 'vitest';
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

// Helper: advance real time and flush React renders
async function advanceTime(ms: number) {
  await act(async () => {
    await new Promise(r => setTimeout(r, ms));
  });
}

describe('Toast', () => {
  it('应显示消息文本', async () => {
    await showToast(() => {
      Toast.show({ message: '测试消息_hello', duration: 300000 });
    });

    expect(screen.getByText('测试消息_hello')).toBeInTheDocument();
  });

  it('success类型应显示✅图标', async () => {
    await showToast(() => {
      Toast.success('操作成功_ok', 300000);
    });

    expect(screen.getByText('操作成功_ok')).toBeInTheDocument();
    expect(screen.getByText('✅')).toBeInTheDocument();
  });

  it('warning类型应显示⚠️图标', async () => {
    await showToast(() => {
      Toast.warning('注意警告_warn', 300000);
    });

    expect(screen.getByText('注意警告_warn')).toBeInTheDocument();
    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });

  it('danger类型应显示❌图标', async () => {
    await showToast(() => {
      Toast.danger('危险操作_err', 300000);
    });

    expect(screen.getByText('危险操作_err')).toBeInTheDocument();
    expect(screen.getByText('❌')).toBeInTheDocument();
  });

  it('info类型应显示ℹ️图标', async () => {
    await showToast(() => {
      Toast.info('提示信息_tip', 300000);
    });

    expect(screen.getByText('提示信息_tip')).toBeInTheDocument();
    expect(screen.getByText('ℹ️')).toBeInTheDocument();
  });

  it('默认类型应为 info', async () => {
    await showToast(() => {
      Toast.show({ message: '默认类型_msg', duration: 300000 });
    });

    const toastEl = screen.getByText('默认类型_msg').closest('.tk-toast');
    expect(toastEl?.classList.contains('tk-toast--info')).toBe(true);
  });

  it('4种类型应有不同的CSS类名', async () => {
    // 注意：activeToasts 可能有之前测试残留的 toast，
    // 但只要我们添加的 toast 不超过 MAX_STACK(3)，它们应该都存在
    const types: ToastType[] = ['success', 'warning', 'danger'];

    for (const type of types) {
      await showToast(() => {
        Toast.show({ message: `type_${type}_test`, type, duration: 300000 });
      });
    }

    // 验证这 3 种类型的 CSS 类名
    for (const type of types) {
      const toastEl = screen.getByText(`type_${type}_test`).closest('.tk-toast');
      expect(toastEl?.classList.contains(`tk-toast--${type}`)).toBe(true);
    }

    // 再验证 info 类型
    await showToast(() => {
      Toast.show({ message: 'type_info_test', type: 'info', duration: 300000 });
    });
    // info 会挤掉之前最早的一条，但 info 本身应该存在
    const infoEl = screen.getByText('type_info_test').closest('.tk-toast');
    expect(infoEl?.classList.contains('tk-toast--info')).toBe(true);
  });

  it('应在指定时间后自动消失', async () => {
    await showToast(() => {
      Toast.show({ message: '自动消失_vanish', duration: 100 });
    });

    // 消息应该存在
    expect(screen.getByText('自动消失_vanish')).toBeInTheDocument();

    // 等待 duration(100ms) + exit animation(200ms) + buffer
    await advanceTime(500);

    // 消息应该已消失
    expect(screen.queryByText('自动消失_vanish')).not.toBeInTheDocument();
  });

  it('最大堆叠3条，第4条应挤掉第1条', async () => {
    await showToast(() => {
      Toast.show({ message: 'stack_AAA', duration: 300000 });
    });
    await showToast(() => {
      Toast.show({ message: 'stack_BBB', duration: 300000 });
    });
    await showToast(() => {
      Toast.show({ message: 'stack_CCC', duration: 300000 });
    });
    await showToast(() => {
      Toast.show({ message: 'stack_DDD', duration: 300000 });
    });

    // stack_AAA 应被移除（超过 MAX_STACK=3）
    expect(screen.queryByText('stack_AAA')).not.toBeInTheDocument();

    // stack_BBB、CCC、DDD 应存在
    expect(screen.getByText('stack_BBB')).toBeInTheDocument();
    expect(screen.getByText('stack_CCC')).toBeInTheDocument();
    expect(screen.getByText('stack_DDD')).toBeInTheDocument();
  });
});
