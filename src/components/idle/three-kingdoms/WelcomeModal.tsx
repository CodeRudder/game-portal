/**
 * WelcomeModal — 首次启动欢迎弹窗组件
 *
 * 职责：首次进入游戏时展示欢迎信息
 * 从 ThreeKingdomsGame.tsx 拆分出来
 */

import React from 'react';
import Modal from '@/components/idle/common/Modal';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface WelcomeModalProps {
  /** 是否显示 */
  visible: boolean;
  /** 关闭回调 */
  onClose: () => void;
}

// ─────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────

const WelcomeModal: React.FC<WelcomeModalProps> = ({ visible, onClose }) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      type="info"
      title="⚔️ 欢迎来到三国霸业！"
      confirmText="开始游戏"
      onConfirm={onClose}
      onCancel={onClose}
      width="460px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', color: '#e8e0d0', fontSize: '14px' }} data-testid="welcome-modal">
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          乱世纷争，群雄并起。你将作为一方诸侯，招募武将、发展城池，逐鹿天下！
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }} data-testid="welcome-modal-features">
          {([
            { icon: '🏰', label: '建筑', desc: '建造升级城池设施' },
            { icon: '🦸', label: '武将', desc: '招募培养三国名将' },
            { icon: '📜', label: '科技', desc: '研究强化国家实力' },
            { icon: '⚔️', label: '关卡', desc: '征战四方开疆拓土' },
          ]).map(({ icon, label, desc }) => (
            <div key={label} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 'var(--tk-radius-lg)' as any,
            }} data-testid={`welcome-modal-feature-${label}`}>
              <span style={{ fontSize: '20px' }}>{icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{label}</div>
                <div style={{ fontSize: '11px', color: '#999' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: '#888', textAlign: 'center' }}>
          💡 点击底部 Tab 栏切换功能，右上角菜单查看更多玩法
        </p>
      </div>
    </Modal>
  );
};

WelcomeModal.displayName = 'WelcomeModal';

export default WelcomeModal;
