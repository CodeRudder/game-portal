/**
 * 三国霸业 — 游戏错误边界组件
 *
 * React Error Boundary，捕获子组件渲染异常，
 * 显示友好错误页面而非白屏，并提供重试按钮。
 *
 * @module ui/components/GameErrorBoundary
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface GameErrorBoundaryProps {
  /** 子组件 */
  children: ReactNode;
  /** 自定义错误回退 UI（可选） */
  fallback?: (error: Error, retry: () => void) => ReactNode;
  /** 错误发生时的回调（可选，用于上报） */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────

interface GameErrorBoundaryState {
  /** 是否捕获到错误 */
  hasError: boolean;
  /** 错误对象 */
  error: Error | null;
}

// ─────────────────────────────────────────────
// 默认错误页面样式
// ─────────────────────────────────────────────

const errorPageStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '320px',
    padding: '32px',
    background: 'rgba(13, 17, 23, 0.98)',
    color: '#e8e0d0',
    textAlign: 'center',
  },
  icon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#B8423A',
    marginBottom: '8px',
  },
  message: {
    fontSize: '14px',
    color: '#a0a0a0',
    marginBottom: '8px',
    maxWidth: '400px',
    lineHeight: 1.5,
  },
  detail: {
    fontSize: '12px',
    color: '#666',
    marginBottom: '20px',
    maxWidth: '400px',
    wordBreak: 'break-word' as const,
  },
  retryBtn: {
    padding: '10px 32px',
    border: 'none',
    borderRadius: '6px',
    background: 'linear-gradient(135deg, #d4a574, #C9A84C)',
    color: '#1a1a2e',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s ease',
  },
};

// ─────────────────────────────────────────────
// 默认错误回退 UI
// ─────────────────────────────────────────────

function DefaultFallback({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div style={errorPageStyles.container} role="alert" aria-live="assertive">
      <div style={errorPageStyles.icon}>⚠️</div>
      <div style={errorPageStyles.title}>游戏出现了问题</div>
      <div style={errorPageStyles.message}>
        抱歉，游戏界面发生了错误。请尝试重新加载，如果问题持续存在请联系客服。
      </div>
      <div style={errorPageStyles.detail}>
        {error.message || '未知错误'}
      </div>
      <button style={errorPageStyles.retryBtn} onClick={retry}>
        重新加载
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Error Boundary 组件
// ─────────────────────────────────────────────

/**
 * GameErrorBoundary — 游戏错误边界
 *
 * 捕获子组件树中的渲染异常，防止白屏。
 * 提供友好的错误提示页面和重试按钮。
 *
 * @example
 * ```tsx
 * <GameErrorBoundary onError={(e, info) => logError(e)}>
 *   <GameProvider value={ctx}>
 *     <GameUI />
 *   </GameProvider>
 * </GameErrorBoundary>
 * ```
 */
export class GameErrorBoundary extends Component<
  GameErrorBoundaryProps,
  GameErrorBoundaryState
> {
  constructor(props: GameErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): GameErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 调用外部错误上报回调
    this.props.onError?.(error, errorInfo);

    // 开发环境输出详细错误信息
    if (process.env.NODE_ENV === 'development') {
      console.error('[GameErrorBoundary] 渲染异常:', error);
      console.error('[GameErrorBoundary] 组件堆栈:', errorInfo.componentStack);
    }
  }

  /** 重试：清除错误状态，重新渲染子组件 */
  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // 自定义 fallback 或默认错误页面
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }
      return <DefaultFallback error={this.state.error} retry={this.handleRetry} />;
    }

    return this.props.children;
  }
}
