import React from 'react';

const SkillFireIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 攻击类 — 红色六边形背景 */}
    <polygon points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5" fill="rgba(229,57,53,0.12)" stroke="rgba(229,57,53,0.3)" strokeWidth="0.5" />
    <path d="M10,4 Q13,7 13,10 Q13,13 10,16 Q7,13 7,10 Q7,7 10,4 Z" fill="#e65100" stroke="#bf360c" strokeWidth="0.5" />
    <path d="M10,6 Q12,8 12,10 Q12,12 10,14 Q8,12 8,10 Q8,8 10,6 Z" fill="#ff9800" opacity="0.8" />
    <path d="M10,9 Q11,10 11,11 Q11,12 10,13 Q9,12 9,11 Q9,10 10,9 Z" fill="#ffeb3b" opacity="0.7" />
  </svg>
);

/** 剑图标 — 武圣/猛进等攻击技能 */
const SkillSwordIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 攻击类 — 红色六边形背景 */}
    <polygon points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5" fill="rgba(229,57,53,0.12)" stroke="rgba(229,57,53,0.3)" strokeWidth="0.5" />
    <line x1="5" y1="5" x2="13" y2="13" stroke="#c0c0c0" strokeWidth="1.8" strokeLinecap="round" />
    <polygon points="5,3.5 5.8,5 4.2,5" fill="#e0e0e0" />
    <line x1="3" y1="11" x2="8" y2="6" stroke="#8B7355" strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="5.5" cy="5.5" r="0.8" fill="#d4a030" />
    <path d="M12,13 L15,16" stroke="#6b4226" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

/** 盾牌图标 — 八阵图/坚守等防御技能 */
const SkillShieldIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 防御类 — 蓝色圆形背景 */}
    <circle cx="10" cy="10" r="9" fill="rgba(30,136,229,0.1)" stroke="rgba(30,136,229,0.3)" strokeWidth="0.5" />
    <path d="M10,3 L16,5.5 L16,10.5 Q16,15 10,17 Q4,15 4,10.5 L4,5.5 Z" fill="#4a6fa5" stroke="#2e4a7a" strokeWidth="0.6" />
    <path d="M10,5 L14,6.5 L14,9.5 Q14,13 10,15 Q6,13 6,9.5 L6,6.5 Z" fill="none" stroke="#a0c4e8" strokeWidth="0.4" />
    <text x="10" y="12" textAnchor="middle" fontSize="4.5" fill="#d4a030" fontFamily="serif" fontWeight="bold">守</text>
  </svg>
);

/** 书卷图标 — 鬼谋/策略等智力技能 */
const SkillScrollIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 策略类 — 紫色六边形背景 */}
    <polygon points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5" fill="rgba(123,31,162,0.1)" stroke="rgba(123,31,162,0.25)" strokeWidth="0.5" />
    <rect x="5" y="5" width="10" height="10" rx="1" fill="#d4b896" stroke="#8B7355" strokeWidth="0.5" />
    <rect x="4" y="4" width="1.5" height="12" rx="0.5" fill="#b87333" />
    <rect x="14.5" y="4" width="1.5" height="12" rx="0.5" fill="#b87333" />
    <line x1="6.5" y1="8" x2="13.5" y2="8" stroke="#5a4a3a" strokeWidth="0.35" opacity="0.5" />
    <line x1="6.5" y1="10" x2="12.5" y2="10" stroke="#5a4a3a" strokeWidth="0.35" opacity="0.5" />
    <line x1="6.5" y1="12" x2="10.5" y2="12" stroke="#5a4a3a" strokeWidth="0.35" opacity="0.5" />
  </svg>
);

/** 治愈图标 — 仁德/治疗等恢复技能 */
const SkillHealIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 辅助类 — 绿色圆形背景 */}
    <circle cx="10" cy="10" r="9" fill="rgba(67,160,71,0.1)" stroke="rgba(67,160,71,0.3)" strokeWidth="0.5" />
    <line x1="10" y1="5" x2="10" y2="15" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" />
    <line x1="5" y1="10" x2="15" y2="10" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" />
    <circle cx="10" cy="10" r="2" fill="#81c784" opacity="0.5" />
  </svg>
);

/** 怒吼图标 — 怒吼/号令等范围减益技能 */
const SkillRoarIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 攻击类 — 红色六边形背景 */}
    <polygon points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5" fill="rgba(229,57,53,0.12)" stroke="rgba(229,57,53,0.3)" strokeWidth="0.5" />
    <path d="M8,5 Q10,4 12,5 L13,8 Q13,11 10,13 Q7,11 7,8 Z" fill="#c62828" stroke="#8b1a1a" strokeWidth="0.5" />
    <path d="M8,8 Q10,6 12,8" fill="none" stroke="#1a1a1a" strokeWidth="0.7" />
    <ellipse cx="8.5" cy="7" rx="0.7" ry="0.5" fill="#1a1a1a" />
    <ellipse cx="11.5" cy="7" rx="0.7" ry="0.5" fill="#1a1a1a" />
    <path d="M4,7 Q3,9 4,11" fill="none" stroke="#ff9800" strokeWidth="0.7" opacity="0.6" />
    <path d="M16,7 Q17,9 16,11" fill="none" stroke="#ff9800" strokeWidth="0.7" opacity="0.6" />
    <path d="M3,5.5 Q1,9 3,12.5" fill="none" stroke="#ff9800" strokeWidth="0.5" opacity="0.4" />
    <path d="M17,5.5 Q19,9 17,12.5" fill="none" stroke="#ff9800" strokeWidth="0.5" opacity="0.4" />
  </svg>
);

/** 突进图标 — 单骑/飞将等冲锋技能 */
const SkillChargeIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 攻击类 — 红色六边形背景 */}
    <polygon points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5" fill="rgba(229,57,53,0.12)" stroke="rgba(229,57,53,0.3)" strokeWidth="0.5" />
    <polygon points="15,10 10,6 10,8 4,8 4,12 10,12 10,14" fill="#d4a030" stroke="#8B6914" strokeWidth="0.5" />
    <line x1="3" y1="7" x2="3" y2="13" stroke="#c62828" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    <line x1="1.5" y1="8" x2="1.5" y2="12" stroke="#c62828" strokeWidth="0.6" strokeLinecap="round" opacity="0.3" />
  </svg>
);

/** 魅惑图标 — 倾国/离间等控制技能 */
const SkillCharmIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 策略类 — 紫色圆形背景 */}
    <circle cx="10" cy="10" r="9" fill="rgba(123,31,162,0.1)" stroke="rgba(123,31,162,0.25)" strokeWidth="0.5" />
    <path d="M10,4 Q14,4 15,8 Q16,12 10,16 Q4,12 5,8 Q6,4 10,4 Z" fill="#e91e63" stroke="#880e4f" strokeWidth="0.5" opacity="0.8" />
    <path d="M10,6 Q13,6 13.5,8.5 Q13.5,11 10,13.5 Q6.5,11 6.5,8.5 Q7,6 10,6 Z" fill="#f48fb1" opacity="0.5" />
    <circle cx="8.5" cy="9" r="0.8" fill="#1a1a1a" />
    <circle cx="11.5" cy="9" r="0.8" fill="#1a1a1a" />
    <path d="M8.5,11.5 Q10,13 11.5,11.5" fill="none" stroke="#1a1a1a" strokeWidth="0.5" />
    <path d="M14,4 L15.5,2.5" stroke="#e91e63" strokeWidth="0.5" opacity="0.5" />
    <path d="M15,5.5 L16.5,4.5" stroke="#e91e63" strokeWidth="0.5" opacity="0.4" />
  </svg>
);

/** 蓄力图标 — 隐忍/坚韧等蓄力技能 */
const SkillChargeUpIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 策略类 — 紫色圆形背景 */}
    <circle cx="10" cy="10" r="9" fill="rgba(123,31,162,0.1)" stroke="rgba(123,31,162,0.25)" strokeWidth="0.5" />
    <circle cx="10" cy="10" r="6" fill="none" stroke="#7e57c2" strokeWidth="0.8" />
    <circle cx="10" cy="10" r="3.5" fill="none" stroke="#b388ff" strokeWidth="0.6" />
    <circle cx="10" cy="10" r="1.2" fill="#d4a030" />
    <path d="M10,4 L10,5.5" stroke="#d4a030" strokeWidth="0.8" strokeLinecap="round" />
    <path d="M10,14.5 L10,16" stroke="#d4a030" strokeWidth="0.8" strokeLinecap="round" />
    <path d="M4,10 L5.5,10" stroke="#d4a030" strokeWidth="0.8" strokeLinecap="round" />
    <path d="M14.5,10 L16,10" stroke="#d4a030" strokeWidth="0.8" strokeLinecap="round" />
  </svg>
);

/** 远程图标 — 烈弓等远程攻击技能 */
const SkillBowIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 攻击类 — 红色六边形背景 */}
    <polygon points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5" fill="rgba(229,57,53,0.12)" stroke="rgba(229,57,53,0.3)" strokeWidth="0.5" />
    <path d="M7,4 Q3,10 7,16" fill="none" stroke="#8b4513" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="7" y1="4" x2="7" y2="16" stroke="#d4a030" strokeWidth="0.5" />
    <line x1="6" y1="10" x2="16" y2="10" stroke="#6b4226" strokeWidth="1" />
    <polygon points="16,10 14,8.5 14,11.5" fill="#c62828" />
    <path d="M8,8.5 L6.5,10 L8,11.5" fill="#a83232" opacity="0.7" />
  </svg>
);

/** 激励图标 — 激励/平衡等增益技能 */
const SkillBuffIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 辅助类 — 绿色圆形背景 */}
    <circle cx="10" cy="10" r="9" fill="rgba(67,160,71,0.1)" stroke="rgba(67,160,71,0.3)" strokeWidth="0.5" />
    <polygon points="10,3 11.5,7 16,7 12.5,10.5 13.5,15 10,12.5 6.5,15 7.5,10.5 4,7 8.5,7" fill="#d4a030" stroke="#8B6914" strokeWidth="0.4" />
    <polygon points="10,5.5 11,8 13.5,8 11.5,10 12,12.5 10,11 8,12.5 8.5,10 6.5,8 9,8" fill="#ffeb3b" opacity="0.5" />
  </svg>
);

/** 吸血图标 — 奸雄等吸血技能 */
const SkillDrainIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M10,2 Q16,4 16,10 Q16,16 10,18 Q4,16 4,10 Q4,4 10,2 Z" fill="#b71c1c" stroke="#7f0000" strokeWidth="0.6" />
    <path d="M10,4 Q14,6 14,10 Q14,14 10,16 Q6,14 6,10 Q6,6 10,4 Z" fill="#e53935" opacity="0.5" />
    <path d="M8,8 L10,5 L12,8 L10,11 Z" fill="#ffeb3b" opacity="0.7" />
    <line x1="10" y1="11" x2="10" y2="14" stroke="#ffeb3b" strokeWidth="0.8" opacity="0.5" />
  </svg>
);

/** 技能图标映射 — 根据技能类型 key 返回对应 SVG */
const SKILL_ICON_MAP: Record<string, React.FC<{ size?: number }>> = {
  fire: SkillFireIcon,
  sword: SkillSwordIcon,
  shield: SkillShieldIcon,
  scroll: SkillScrollIcon,
  heal: SkillHealIcon,
  roar: SkillRoarIcon,
  charge: SkillChargeIcon,
  charm: SkillCharmIcon,
  chargeup: SkillChargeUpIcon,
  bow: SkillBowIcon,
  buff: SkillBuffIcon,
  drain: SkillDrainIcon,
};

/** 技能图标组件 — 根据技能类型 key 渲染对应的 SVG */
export const SkillIcon: React.FC<{ skillType: string; size?: number }> = ({ skillType, size = 20 }) => {
  const IconComponent = SKILL_ICON_MAP[skillType];
  if (IconComponent) {
    return <span data-testid={`combat-icon-skill-${skillType}`}><IconComponent size={size} /></span>;
  }
  // 兜底：通用技能图标
  return (
    <svg data-testid="combat-icon-skill-default" width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="7" fill="#d4a030" opacity="0.3" />
      <text x="10" y="13" textAnchor="middle" fontSize="8" fill="#d4a030">✦</text>
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════
// 装备槽位图标 SVG 组件 (20×20)
// ═══════════════════════════════════════════════════════════════

/** 武器槽图标 */
const EquipWeaponIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <line x1="4" y1="4" x2="13" y2="13" stroke="#c0c0c0" strokeWidth="1.5" strokeLinecap="round" />
    <polygon points="4,2.5 4.8,4 3.2,4" fill="#e0e0e0" />
    <line x1="2" y1="10" x2="7" y2="5" stroke="#8B7355" strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="4" cy="4" r="0.8" fill="#d4a030" />
  </svg>
);

/** 防具槽图标 */
const EquipArmorIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M10,2 L17,5 L17,11 Q17,16 10,18 Q3,16 3,11 L3,5 Z" fill="#5a5a5a" stroke="#3a3a3a" strokeWidth="0.8" />
    <path d="M10,4 L15,6 L15,10 Q15,14 10,16 Q5,14 5,10 L5,6 Z" fill="none" stroke="#8a8a8a" strokeWidth="0.5" />
    <line x1="10" y1="6" x2="10" y2="14" stroke="#8a8a8a" strokeWidth="0.4" opacity="0.5" />
    <line x1="6" y1="9" x2="14" y2="9" stroke="#8a8a8a" strokeWidth="0.4" opacity="0.5" />
  </svg>
);

/** 坐骑槽图标 */
const EquipMountIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M4,14 L6,8 L8,6 L10,7 L12,6 L14,8 L16,14" fill="none" stroke="#8b4513" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="6" y1="14" x2="5" y2="17" stroke="#8b4513" strokeWidth="1" strokeLinecap="round" />
    <line x1="14" y1="14" x2="15" y2="17" stroke="#8b4513" strokeWidth="1" strokeLinecap="round" />
    <circle cx="14" cy="6" r="1.5" fill="#8b4513" />
    <path d="M4,10 Q2,8 4,7" fill="none" stroke="#6b8e5a" strokeWidth="0.8" opacity="0.6" />
  </svg>
);

/** 装备槽图标映射 */
const EQUIP_ICON_MAP: Record<string, React.FC<{ size?: number }>> = {
  weapon: EquipWeaponIcon,
  armor: EquipArmorIcon,
  mount: EquipMountIcon,
};

/** 装备槽图标组件 */
export const EquipSlotIcon: React.FC<{ slotType: string; size?: number }> = ({ slotType, size = 20 }) => {
  const IconComponent = EQUIP_ICON_MAP[slotType];
  if (IconComponent) {
    return <span data-testid={`combat-icon-equip-${slotType}`}><IconComponent size={size} /></span>;
  }
  return (
    <svg data-testid="combat-icon-equip-default" width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="12" height="12" rx="2" fill="none" stroke="#8B7355" strokeWidth="0.8" strokeDasharray="2 2" />
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════
// 建筑升级进度条组件
// ═══════════════════════════════════════════════════════════════

/**
 * BuildingProgressBar — 建筑升级进度条（竹简卷轴样式）
 *
 * 显示当前等级 → 下一等级的进度。
 * 使用竹简卷轴古风样式，进度条用竹节纹理。
 * 颜色随进度变化：红(0-30%) → 黄(30-70%) → 绿(70-100%)
 */
export const BuildingProgressBar: React.FC<{
  currentLevel: number;
  progress: number; // 0~1
  width?: number;
  height?: number;
}> = ({ currentLevel, progress, width = 110, height = 4 }) => {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const pct = Math.floor(clampedProgress * 100);

  // 进度条颜色
  let barColor = '#a85241'; // 红
  if (pct >= 70) barColor = '#4a7a3a'; // 绿
  else if (pct >= 30) barColor = '#d4a030'; // 黄

  return (
    <div data-testid="combat-icon-building-progress" style={{ width, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* 竹简卷轴进度条 */}
      <div style={{
        width: '100%', height,
        borderRadius: Math.floor(height / 2),
        background: 'rgba(139,115,85,0.15)',
        overflow: 'hidden',
        border: '0.5px solid rgba(139,115,85,0.2)',
        position: 'relative',
      }}>
        {/* 竹节纹理背景 */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(139,115,85,0.08) 8px, rgba(139,115,85,0.08) 9px)',
        }} />
        {/* 进度填充 */}
        <div style={{
          width: `${pct}%`, height: '100%',
          borderRadius: Math.floor(height / 2),
          background: `linear-gradient(90deg, ${barColor}, ${barColor}dd)`,
          transition: 'width 0.5s ease',
          position: 'relative',
        }}>
          {/* 竹节高光 */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.15), transparent)',
            borderRadius: Math.floor(height / 2),
          }} />
        </div>
      </div>
      {/* 等级标签 */}
      <div style={{
        fontSize: 8, color: '#8a7a60',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>Lv.{currentLevel}</span>
        <span>Lv.{currentLevel + 1}</span>
      </div>
    </div>
  );
};
