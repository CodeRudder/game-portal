/**
 * Toast 单元测试
 *
 * 测试场景：
 * - 显示消息文本
 * - 4种类型（success/warning/danger/info）样式不同
 * - 自动消失（setTimeout）
 * - 手动关闭（点击X）
 *
 * 注意：Toast 使用命令式 API（Toast.show / Toast.success 等），
 * 通过 createRoot 直接渲染到 DOM，不使用 React 组件树。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import { Toast, ToastType, ToastConfig } from '../Toast';

// ── Mock CSS ──
vi.mock('../Toast.css', () => ({}));

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 清理 DOM 中可能残留的 toast 容器
    const existing = document.querySelector('.tk-toast-portal');
    if (existing) existing.remove();
  });

  afterEach(() => {
    vi.useRealTimers();
    // 清理
    const existing = document.querySelector('.tk-toast-portal');
    if (existing) existing.remove();
  });

  it('应显示消息文本', () => {
    Toast.show({ message: '测试消息' });

    expect(screen.getByText('测试消息')).toBeInTheDocument();
  });

  it('4种类型应有不同的CSS类名', () => {
    const types: ToastType[] = ['success', 'warning', 'danger', 'info'];

    for (const type of types) {
      Toast.show({ message: `${type}消息`, type });
    }

    // 验证每种类型的 CSS 类名
    for (const type of types) {
      const toastEl = screen.getByText(`${type}消息`).closest('.tk-toast');
      expect(toastEl?.classList.contains(`tk-toast--${type}`)).toBe(true);
    }
  });

  it('success类型应显示✅图标', () => {
    Toast.success('操作成功');

    expect(screen.getByText('操作成功')).toBeInTheDocument();
    expect(screen.getByText('✅')).toBeInTheDocument();
  });

  it('warning类型应显示⚠️图标', () => {
    Toast.warning('注意警告');

    expect(screen.getByText('注意警告')).toBeInTheDocument();
    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });

  it('danger类型应显示❌图标', () => {
    Toast.danger('危险操作');

    expect(screen.getByText('危险操作')).toBeInTheDocument();
    expect(screen.getByText('❌')).toBeInTheDocument();
  });

  it('info类型应显示ℹ️图标', () => {
    Toast.info('提示信息');

    expect(screen.getByText('提示信息')).toBeInTheDocument();
    expect(screen.getByText('ℹ️')).toBeInTheDocument();
  });

  it('应在指定时间后自动消失', () => {
    Toast.show({ message: '自动消失测试', duration: 2000 });

    // 消息应该存在
    expect(screen.getByText('自动消失测试')).toBeInTheDocument();

    // 快进 2000ms 触发消失动画
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // 再快进 200ms 让移除动画完成
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // 消息应该已消失
    expect(screen.queryByText('自动消失测试')).not.toBeInTheDocument();
  });

  it('默认类型应为 info', () => {
    Toast.show({ message: '默认类型' });

    const toastEl = screen.getByText('默认类型').closest('.tk-toast');
    expect(toastEl?.classList.contains('tk-toast--info')).toBe(true);
  });

  it('默认持续时间应为 3000ms', () => {
    Toast.show({ message: '默认时长' });

    // 快进 2999ms，消息应仍存在
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.getByText('默认时长')).toBeInTheDocument();

    // 快进到 3000ms，触发消失
    act(() => {
      vi.advanceTimersByTime(1);
    });
    // 消失动画开始
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('默认时长')).not.toBeInTheDocument();
  });

  it('最大堆叠3条，第4条应挤掉第1条', () => {
    Toast.show({ message: '消息1' });
    Toast.show({ message: '消息2' });
    Toast.show({ message: '消息3' });
    Toast.show({ message: '消息4' });

    // 消息1 应被移除（超过 MAX_STACK=3）
    expect(screen.queryByText('消息1')).not.toBeInTheDocument();

    // 消息 2、3、4 应存在
    expect(screen.getByText('消息2')).toBeInTheDocument();
    expect(screen.getByText('消息3')).toBeInTheDocument();
    expect(screen.getByText('消息4')).toBeInTheDocument();
  });
});
