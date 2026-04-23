import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * 三国霸业 — 游戏错误边界
 *
 * 捕获引擎初始化/渲染过程中的未处理异常，
 * 显示友好的错误信息而非白屏。
 */
export class GameErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ThreeKingdoms] 游戏崩溃:', error);
    console.error('[ThreeKingdoms] 组件栈:', errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    // 清除损坏的存档
    try {
      localStorage.removeItem('three-kingdoms-save');
      localStorage.removeItem('tk-save');
    } catch {}
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || '未知错误';
      const isStorageError = errorMsg.includes('localStorage') || errorMsg.includes('JSON');

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#0a0a1a',
          color: '#e0e0e0',
          fontFamily: 'Inter, sans-serif',
          padding: '20px',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚔️</div>
          <h2 style={{ color: '#ff6b6b', marginBottom: '12px' }}>三国霸业加载失败</h2>
          <p style={{ color: '#aaa', marginBottom: '8px', maxWidth: '500px', textAlign: 'center' }}>
            {isStorageError
              ? '存档数据损坏，请清除存档后重试。'
              : '游戏引擎初始化时发生错误。'}
          </p>
          <details style={{ marginBottom: '16px', maxWidth: '600px', width: '100%' }}>
            <summary style={{ cursor: 'pointer', color: '#888', fontSize: '12px' }}>
              错误详情
            </summary>
            <pre style={{
              background: '#1a1a2e',
              padding: '12px',
              borderRadius: '8px',
              overflow: 'auto',
              fontSize: '11px',
              color: '#ff6b6b',
              maxHeight: '200px',
              marginTop: '8px',
            }}>
              {errorMsg}
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
          <div style={{ display: 'flex', gap: '12px' }}>
            {isStorageError && (
              <button
                onClick={this.handleReset}
                style={{
                  padding: '10px 24px',
                  background: '#ff6b6b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                🗑️ 清除存档并重试
              </button>
            )}
            <button
              onClick={this.handleReload}
              style={{
                padding: '10px 24px',
                background: '#4a90d9',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              🔄 刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
