/**
 * SettingsPanel — 设置与存档面板
 *
 * 提供音效、画面等开关设置，以及手动存档功能。
 * P1-02: 集成账号管理入口（AccountSystem）
 *
 * NEW-R5: 使用 SharedPanel 统一弹窗容器，消除重复 overlay/header/close 代码。
 *
 * 数据来源：
 * - engine.getSettingsManager() / engine.settings
 * - engine.getCloudSaveSystem() / engine.cloudSave
 * - engine.getAccountSystem() — 账号管理
 *
 * @module panels/settings/SettingsPanel
 */
import React, { useState } from 'react';
import SharedPanel from '@/components/idle/components/SharedPanel';

// ─── 类型 ────────────────────────────────────
interface SettingsPanelProps {
  engine: any;
  /** 是否显示面板 */
  visible?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
}

// ─── 设置项配置 ──────────────────────────────
interface SettingToggle {
  key: string;
  label: string;
}

const AUDIO_SETTINGS: SettingToggle[] = [
  { key: 'soundEnabled', label: '音效' },
  { key: 'musicEnabled', label: '背景音乐' },
];

const VISUAL_SETTINGS: SettingToggle[] = [
  { key: 'animationEnabled', label: '动画效果' },
  { key: 'particleEnabled', label: '粒子特效' },
];

// ─── 主组件 ──────────────────────────────────
const SettingsPanel: React.FC<SettingsPanelProps> = ({ engine, visible = true, onClose }) => {
  const [message, setMessage] = useState<string | null>(null);
  const [showAccount, setShowAccount] = useState(false);

  // 获取各子系统
  const settingsManager = engine?.getSettingsManager?.() ?? engine?.settings;
  const cloudSave = engine?.getCloudSaveSystem?.() ?? engine?.cloudSave;
  const accountSystem = engine?.getAccountSystem?.();
  const settings = settingsManager?.getState?.();

  /** 切换开关 */
  const handleToggle = (key: string) => {
    try {
      settingsManager?.toggle?.(key);
      setMessage('✅ 设置已更新');
    } catch (e: any) {
      setMessage(e?.message ?? '设置失败');
    }
    setTimeout(() => setMessage(null), 1500);
  };

  /** 手动保存 */
  const handleSave = () => {
    try {
      cloudSave?.save?.();
      setMessage('💾 存档已保存');
    } catch (e: any) {
      setMessage(e?.message ?? '保存失败');
    }
    setTimeout(() => setMessage(null), 1500);
  };

  /** 渲染一组开关 */
  const renderToggleGroup = (items: SettingToggle[]) =>
    items.map((item) => (
      <div key={item.key} style={styles.toggleRow}>
        <span style={styles.toggleLabel}>{item.label}</span>
        <button
          onClick={() => handleToggle(item.key)}
          style={{
            ...styles.toggleBtn,
            background: settings?.[item.key] ? '#4caf50' : '#666',
          }}
        >
          {settings?.[item.key] ? '开' : '关'}
        </button>
      </div>
    ));

  // ── P1-02: 账号管理信息 ──
  const accountSettings = accountSystem?.getSettings?.();
  const bindings = accountSystem?.getBindings?.() ?? [];
  const devices = accountSystem?.getDevices?.() ?? [];
  const isGuest = accountSettings?.isGuest ?? true;

  return (
    <SharedPanel
      visible={visible}
      title="设置"
      icon="⚙️"
      onClose={onClose}
      width="520px"
    >
      <div style={styles.wrap} data-testid="settings-panel">
        {/* 操作反馈消息 */}
        {message && <div style={styles.message}>{message}</div>}

        {/* 音频设置 */}
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>🔊 音频</h4>
          {renderToggleGroup(AUDIO_SETTINGS)}
        </div>

        {/* 画面设置 */}
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>🎨 画面</h4>
          {renderToggleGroup(VISUAL_SETTINGS)}
        </div>

        {/* P1-02: 账号管理 */}
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>👤 账号</h4>
          {accountSystem ? (
            <div>
              <div style={styles.toggleRow}>
                <span style={styles.toggleLabel}>
                  {isGuest ? '游客账号' : '已绑定账号'}
                </span>
                <span style={{ ...styles.toggleLabel, color: isGuest ? '#e67e22' : '#4caf50' }}>
                  {isGuest ? '未绑定' : `${bindings.length}个绑定`}
                </span>
              </div>
              {/* 绑定信息 */}
              {bindings.length > 0 && bindings.map((b: any) => (
                <div key={b.method} style={styles.toggleRow}>
                  <span style={styles.toggleLabel}>
                    {b.method === 'phone' ? '📱 手机' : b.method === 'email' ? '📧 邮箱' : '🔗 第三方'}
                  </span>
                  <span style={styles.toggleLabel}>{b.identifier}</span>
                </div>
              ))}
              {/* 设备信息 */}
              {devices.length > 0 && (
                <div style={styles.toggleRow}>
                  <span style={styles.toggleLabel}>📱 设备数</span>
                  <span style={styles.toggleLabel}>{devices.length}/5</span>
                </div>
              )}
              <button onClick={() => setShowAccount(!showAccount)} style={styles.saveBtn}>
                {showAccount ? '收起详情' : '管理账号'}
              </button>
            </div>
          ) : (
            <div style={styles.toggleRow}>
              <span style={{ ...styles.toggleLabel, color: '#999' }}>账号系统未就绪</span>
            </div>
          )}
        </div>

        {/* 存档管理 */}
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>💾 存档</h4>
          <button onClick={handleSave} style={styles.saveBtn}>
            手动保存
          </button>
        </div>
      </div>
    </SharedPanel>
  );
};

SettingsPanel.displayName = 'SettingsPanel';

export default SettingsPanel;

// ─── 样式 ────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  wrap: {
    padding: 16,
    color: '#e0d5c0',
  },
  message: {
    padding: '8px 12px',
    background: 'rgba(212,165,116,0.2)',
    borderRadius: 'var(--tk-radius-lg)' as any,
    marginBottom: 12,
    fontSize: 13,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 8,
    color: '#d4a574',
  },
  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  toggleLabel: {
    fontSize: 13,
    color: '#e0d5c0',
  },
  toggleBtn: {
    padding: '4px 12px',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--tk-radius-sm)' as any,
    fontSize: 12,
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '8px 16px',
    background: '#d4a574',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: 'var(--tk-radius-md)' as any,
    fontWeight: 'bold',
    fontSize: 13,
    width: '100%',
    cursor: 'pointer',
  },
};
