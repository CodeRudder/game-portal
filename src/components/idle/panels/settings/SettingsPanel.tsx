/**
 * SettingsPanel — 设置与存档面板
 *
 * 提供音效、画面等开关设置，以及手动存档功能。
 *
 * 数据来源：
 * - engine.getSettingsManager() / engine.settings
 * - engine.getCloudSaveSystem() / engine.cloudSave
 *
 * @module panels/settings/SettingsPanel
 */
import React, { useState } from 'react';

// ─── 类型 ────────────────────────────────────
interface SettingsPanelProps {
  engine: any;
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
const SettingsPanel: React.FC<SettingsPanelProps> = ({ engine }) => {
  const [message, setMessage] = useState<string | null>(null);

  // 获取各子系统
  const settingsManager = engine?.getSettingsManager?.() ?? engine?.settings;
  const cloudSave = engine?.getCloudSaveSystem?.() ?? engine?.cloudSave;
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

  return (
    <div style={styles.wrap} data-testid="settings-panel">
      <h3 style={styles.heading}>设置</h3>

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

      {/* 存档管理 */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>💾 存档</h4>
        <button onClick={handleSave} style={styles.saveBtn}>
          手动保存
        </button>
      </div>
    </div>
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
  heading: {
    fontSize: 16,
    marginBottom: 12,
    color: '#d4a574',
  },
  message: {
    padding: '8px 12px',
    background: 'rgba(212,165,116,0.2)',
    borderRadius: 8,
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
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '8px 16px',
    background: '#d4a574',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: 6,
    fontWeight: 'bold',
    fontSize: 13,
    width: '100%',
    cursor: 'pointer',
  },
};
