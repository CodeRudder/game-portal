/**
 * ThreeKingdomsSVGIcons — 三国霸业古风 SVG 图标组件
 *
 * 为建筑和资源提供古风风格的内联 SVG 图标。
 * 使用古风色彩体系：深棕/暗金/青铜/朱红/翠绿
 *
 * 建筑图标 (40x40)：
 * - 农田(farm)    → 麦穗+犁 (绿色)
 * - 市集(market)  → 天平+钱袋 (金色)
 * - 兵营(barracks)→ 盾牌+剑 (红色)
 * - 铁匠铺(smithy)→ 镐+铁砧 (灰色)
 * - 书院(academy) → 竹简+毛笔 (蓝色)
 * - 医馆(clinic)  → 药葫芦+草叶 (青色)
 * - 城墙(wall)    → 城垛+盾牌 (深灰)
 * - 招贤馆(tavern)→ 旗帜+卷轴 (紫色)
 *
 * 资源图标 (20x20)：
 * - 粮草(grain)   → 稻穗 (金色)
 * - 铜钱(gold)    → 铜钱 (古铜)
 * - 兵力(troops)  → 兵符 (朱红)
 * - 天命(destiny) → 玉玺 (翠绿)
 *
 * @module components/idle/ThreeKingdomsSVGIcons
 */

import React from 'react';

// ═══════════════════════════════════════════════════════════════
// 建筑图标 SVG 组件 (40×40)
// ═══════════════════════════════════════════════════════════════

/** 农田 — 麦穗+犁 (绿色) */
const FarmIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    {/* 犁身 */}
    <path d="M8,32 L18,18" stroke="#6b4226" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M18,18 L24,18" stroke="#6b4226" strokeWidth="2" strokeLinecap="round" />
    {/* 犁刃 */}
    <path d="M6,34 Q8,30 12,32 Q10,36 6,34" fill="#8B7355" stroke="#6b4226" strokeWidth="0.8" />
    {/* 麦穗 */}
    <line x1="26" y1="34" x2="26" y2="12" stroke="#6b8e5a" strokeWidth="1.5" />
    <ellipse cx="26" cy="10" rx="2.5" ry="4" fill="#8aaa5a" />
    <ellipse cx="23" cy="14" rx="2.5" ry="3.5" fill="#8aaa5a" transform="rotate(-25 23 14)" />
    <ellipse cx="29" cy="14" rx="2.5" ry="3.5" fill="#8aaa5a" transform="rotate(25 29 14)" />
    <ellipse cx="23" cy="20" rx="2" ry="3" fill="#6b8e5a" transform="rotate(-20 23 20)" />
    <ellipse cx="29" cy="20" rx="2" ry="3" fill="#6b8e5a" transform="rotate(20 29 20)" />
    <ellipse cx="26" cy="24" rx="1.8" ry="2.5" fill="#5a7a4a" transform="rotate(-15 26 24)" />
    <ellipse cx="26" cy="24" rx="1.8" ry="2.5" fill="#5a7a4a" transform="rotate(15 26 24)" />
    {/* 土地纹理 */}
    <path d="M4,36 Q12,34 20,36 Q28,38 36,36" stroke="#5a4a2a" strokeWidth="0.8" fill="none" opacity="0.5" />
  </svg>
);

/** 市集 — 天平+钱袋 (金色) */
const MarketIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    {/* 天平支柱 */}
    <line x1="20" y1="8" x2="20" y2="32" stroke="#8B7355" strokeWidth="2" />
    {/* 天平横杆 */}
    <line x1="8" y1="14" x2="32" y2="14" stroke="#d4a030" strokeWidth="1.8" />
    {/* 天平底座 */}
    <path d="M16,32 L24,32 L22,35 L18,35 Z" fill="#8B7355" />
    {/* 左盘 */}
    <path d="M6,14 Q8,20 14,18" stroke="#d4a030" strokeWidth="1" fill="none" />
    <ellipse cx="10" cy="20" rx="5" ry="1.5" fill="#d4a030" opacity="0.6" />
    {/* 右盘 - 钱袋 */}
    <path d="M26,14 Q28,20 34,18" stroke="#d4a030" strokeWidth="1" fill="none" />
    <ellipse cx="30" cy="20" rx="5" ry="1.5" fill="#d4a030" opacity="0.6" />
    {/* 钱袋 */}
    <path d="M27,22 Q30,18 33,22 Q33,28 30,29 Q27,28 27,22" fill="#b8860b" stroke="#8B6914" strokeWidth="0.8" />
    <path d="M28,18 Q30,16 32,18" stroke="#8B6914" strokeWidth="1" fill="none" />
    <text x="30" y="27" textAnchor="middle" fontSize="5" fill="#ffd700" fontWeight="bold">¥</text>
    {/* 支点装饰 */}
    <circle cx="20" cy="10" r="2" fill="#d4a030" />
  </svg>
);

/** 兵营 — 盾牌+剑 (红色) */
const BarracksIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    {/* 盾牌 */}
    <path d="M12,8 L12,24 Q12,32 20,34 Q28,32 28,24 L28,8 Z" fill="#8b2020" stroke="#c62828" strokeWidth="1.5" />
    <path d="M14,10 L14,23 Q14,30 20,32 Q26,30 26,23 L26,10 Z" fill="#a83232" opacity="0.5" />
    {/* 盾牌纹饰 */}
    <line x1="20" y1="12" x2="20" y2="28" stroke="#d4a030" strokeWidth="1" opacity="0.6" />
    <line x1="15" y1="20" x2="25" y2="20" stroke="#d4a030" strokeWidth="1" opacity="0.6" />
    {/* 剑 */}
    <line x1="30" y1="6" x2="36" y2="30" stroke="#c0c0c0" strokeWidth="2" strokeLinecap="round" />
    <line x1="28" y1="24" x2="34" y2="22" stroke="#8B7355" strokeWidth="2" strokeLinecap="round" />
    <circle cx="33" cy="28" r="1.5" fill="#d4a030" />
    {/* 剑尖 */}
    <polygon points="30,4 31,6 29,6" fill="#e0e0e0" />
  </svg>
);

/** 铁匠铺 — 镐+铁砧 (灰色) */
const SmithyIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    {/* 铁砧 */}
    <path d="M10,28 L30,28 L28,32 L12,32 Z" fill="#5a5a5a" stroke="#3a3a3a" strokeWidth="1" />
    <path d="M14,24 L26,24 L28,28 L12,28 Z" fill="#6a6a6a" stroke="#4a4a4a" strokeWidth="0.8" />
    {/* 铁砧顶部 */}
    <rect x="16" y="22" width="8" height="3" rx="1" fill="#7a7a7a" />
    {/* 镐 */}
    <line x1="6" y1="6" x2="22" y2="22" stroke="#6b4226" strokeWidth="2" strokeLinecap="round" />
    {/* 镐头 */}
    <path d="M4,4 L8,6 L6,8 L2,6 Z" fill="#808080" stroke="#5a5a5a" strokeWidth="0.8" />
    {/* 火花 */}
    <circle cx="24" cy="20" r="1" fill="#ff6600" opacity="0.8" />
    <circle cx="26" cy="18" r="0.8" fill="#ffaa00" opacity="0.6" />
    <circle cx="22" cy="18" r="0.6" fill="#ff4400" opacity="0.7" />
    {/* 底座 */}
    <rect x="14" y="32" width="12" height="2" rx="1" fill="#4a4a4a" />
  </svg>
);

/** 书院 — 竹简+毛笔 (蓝色) */
const AcademyIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    {/* 竹简卷 */}
    <rect x="6" y="12" width="22" height="16" rx="2" fill="#d4b896" stroke="#8B7355" strokeWidth="1" />
    {/* 竹简纹理线 */}
    {[14, 18, 22, 26].map(y => (
      <line key={y} x1="8" y1={y} x2="26" y2={y} stroke="#8B7355" strokeWidth="0.6" opacity="0.5" />
    ))}
    {/* 竹简文字 */}
    <text x="10" y="17" fontSize="4" fill="#3a2a1a" opacity="0.6">子曰</text>
    <text x="10" y="21" fontSize="4" fill="#3a2a1a" opacity="0.6">学而</text>
    <text x="10" y="25" fontSize="4" fill="#3a2a1a" opacity="0.6">时习</text>
    {/* 卷轴端 */}
    <rect x="5" y="11" width="2" height="18" rx="1" fill="#b87333" />
    <rect x="27" y="11" width="2" height="18" rx="1" fill="#b87333" />
    {/* 毛笔 */}
    <line x1="30" y1="6" x2="34" y2="30" stroke="#6b4226" strokeWidth="1.5" strokeLinecap="round" />
    {/* 笔尖 */}
    <path d="M33,28 L35,34 L31,34 Z" fill="#1a1a1a" />
    {/* 笔头装饰 */}
    <line x1="29" y1="7" x2="31" y2="7" stroke="#d4a030" strokeWidth="1.5" />
  </svg>
);

/** 医馆 — 药葫芦+草叶 (青色) */
const ClinicIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    {/* 葫芦 */}
    <ellipse cx="20" cy="22" rx="9" ry="11" fill="#5a8a6a" stroke="#3a6a4a" strokeWidth="1.2" />
    <ellipse cx="20" cy="14" rx="5" ry="5" fill="#5a8a6a" stroke="#3a6a4a" strokeWidth="1" />
    {/* 葫芦腰 */}
    <path d="M15,18 Q20,16 25,18" stroke="#3a6a4a" strokeWidth="0.8" fill="none" />
    {/* 葫芦口 */}
    <rect x="18" y="8" width="4" height="3" rx="1" fill="#6b4226" />
    {/* 十字标记 */}
    <line x1="20" y1="18" x2="20" y2="28" stroke="#d4a030" strokeWidth="1.5" opacity="0.7" />
    <line x1="15" y1="23" x2="25" y2="23" stroke="#d4a030" strokeWidth="1.5" opacity="0.7" />
    {/* 草叶 */}
    <path d="M30,30 Q34,24 32,18" stroke="#4a7a3a" strokeWidth="1.2" fill="none" />
    <path d="M32,18 Q30,20 32,24" stroke="#4a7a3a" strokeWidth="0.8" fill="#5a8a4a" opacity="0.6" />
    <path d="M32,22 Q34,20 36,22" stroke="#4a7a3a" strokeWidth="0.8" fill="#5a8a4a" opacity="0.6" />
    {/* 葫芦高光 */}
    <ellipse cx="17" cy="20" rx="2" ry="4" fill="white" opacity="0.1" />
  </svg>
);

/** 城墙 — 城垛+盾牌 (深灰) */
const WallIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    {/* 城墙主体 */}
    <rect x="4" y="14" width="32" height="20" fill="#5a5a5a" stroke="#3a3a3a" strokeWidth="1.2" />
    {/* 城垛 */}
    {[6, 14, 22, 30].map(x => (
      <rect key={x} x={x} y="8" width="6" height="8" fill="#5a5a5a" stroke="#3a3a3a" strokeWidth="0.8" />
    ))}
    {/* 城门 */}
    <path d="M16,34 L16,24 Q20,20 24,24 L24,34" fill="#3a2a1a" stroke="#2a1a0a" strokeWidth="0.8" />
    {/* 城门装饰 */}
    <circle cx="22" cy="28" r="1" fill="#8B7355" />
    {/* 石砖纹理 */}
    {[18, 24, 30].map(y => (
      <React.Fragment key={y}>
        <line x1="5" y1={y} x2="15" y2={y} stroke="#4a4a4a" strokeWidth="0.4" />
        <line x1="25" y1={y} x2="35" y2={y} stroke="#4a4a4a" strokeWidth="0.4" />
      </React.Fragment>
    ))}
    {/* 盾牌标志 */}
    <path d="M17,15 L17,19 Q17,22 20,23 Q23,22 23,19 L23,15 Z" fill="#8b2020" stroke="#d4a030" strokeWidth="0.6" opacity="0.8" />
  </svg>
);

/** 招贤馆 — 旗帜+卷轴 (紫色) */
const TavernIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    {/* 旗杆 */}
    <line x1="10" y1="4" x2="10" y2="36" stroke="#6b4226" strokeWidth="2" />
    {/* 旗帜 */}
    <path d="M10,6 L28,8 L26,16 L28,24 L10,22 Z" fill="#6a3d7a" stroke="#8a5d9a" strokeWidth="0.8" />
    {/* 旗帜上的贤字 */}
    <text x="18" y="17" textAnchor="middle" fontSize="8" fill="#d4a030" fontFamily="serif" fontWeight="bold">賢</text>
    {/* 旗帜顶部装饰 */}
    <circle cx="10" cy="4" r="2" fill="#d4a030" />
    {/* 卷轴 */}
    <rect x="22" y="28" width="14" height="8" rx="1" fill="#d4b896" stroke="#8B7355" strokeWidth="0.8" />
    <rect x="21" y="27" width="2" height="10" rx="1" fill="#b87333" />
    <rect x="35" y="27" width="2" height="10" rx="1" fill="#b87333" />
    {/* 卷轴文字 */}
    <line x1="24" y1="31" x2="34" y2="31" stroke="#3a2a1a" strokeWidth="0.5" opacity="0.5" />
    <line x1="24" y1="33" x2="32" y2="33" stroke="#3a2a1a" strokeWidth="0.5" opacity="0.5" />
  </svg>
);

/** 建筑图标映射 — 根据建筑 ID 返回对应的 SVG 组件 */
const BUILDING_ICON_MAP: Record<string, React.FC<{ size?: number }>> = {
  farm: FarmIcon,
  market: MarketIcon,
  barracks: BarracksIcon,
  smithy: SmithyIcon,
  academy: AcademyIcon,
  clinic: ClinicIcon,
  wall: WallIcon,
  tavern: TavernIcon,
};

/** 建筑图标组件 — 根据建筑 ID 渲染对应的 SVG */
export const BuildingIcon: React.FC<{ buildingId: string; size?: number }> = ({ buildingId, size = 40 }) => {
  const IconComponent = BUILDING_ICON_MAP[buildingId];
  if (IconComponent) {
    return <IconComponent size={size} />;
  }
  // 兜底：显示通用建筑图标
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="12" width="24" height="22" rx="2" fill="#8B7355" stroke="#6b5a3a" strokeWidth="1" />
      <path d="M6,14 L20,4 L34,14" fill="none" stroke="#6b4226" strokeWidth="2" />
      <rect x="16" y="24" width="8" height="10" rx="1" fill="#3a2a1a" />
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════
// 资源图标 SVG 组件 (20×20)
// ═══════════════════════════════════════════════════════════════

/** 粮草 — 稻穗 (金色) */
const GrainResourceIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <line x1="10" y1="18" x2="10" y2="4" stroke="#6b8e5a" strokeWidth="1.2" />
    <ellipse cx="10" cy="3" rx="1.5" ry="2.5" fill="#d4a030" />
    <ellipse cx="8" cy="6" rx="1.5" ry="2" fill="#d4a030" transform="rotate(-20 8 6)" />
    <ellipse cx="12" cy="6" rx="1.5" ry="2" fill="#d4a030" transform="rotate(20 12 6)" />
    <ellipse cx="8" cy="10" rx="1.2" ry="1.8" fill="#c49a28" transform="rotate(-15 8 10)" />
    <ellipse cx="12" cy="10" rx="1.2" ry="1.8" fill="#c49a28" transform="rotate(15 12 10)" />
  </svg>
);

/** 铜钱 — 方孔铜钱 (古铜) */
const GoldResourceIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="8" fill="#b87333" stroke="#8B6914" strokeWidth="1" />
    <circle cx="10" cy="10" r="6" fill="none" stroke="#d4a030" strokeWidth="0.6" />
    <rect x="8" y="8" width="4" height="4" fill="#3a2a0a" rx="0.5" />
    <circle cx="10" cy="10" r="8.5" fill="none" stroke="#d4a030" strokeWidth="0.3" />
  </svg>
);

/** 兵力 — 兵符 (朱红) */
const TroopsResourceIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 虎符左半 */}
    <path d="M4,6 Q6,4 8,6 L8,14 Q6,16 4,14 Z" fill="#c62828" stroke="#8b2020" strokeWidth="0.6" />
    {/* 虎符右半 */}
    <path d="M12,6 Q14,4 16,6 L16,14 Q14,16 12,14 Z" fill="#a83232" stroke="#8b2020" strokeWidth="0.6" />
    {/* 虎符纹路 */}
    <line x1="6" y1="8" x2="6" y2="12" stroke="#d4a030" strokeWidth="0.5" opacity="0.7" />
    <line x1="14" y1="8" x2="14" y2="12" stroke="#d4a030" strokeWidth="0.5" opacity="0.7" />
    {/* 连接处 */}
    <line x1="9" y1="7" x2="11" y2="7" stroke="#6b4226" strokeWidth="0.5" strokeDasharray="1 1" />
    <line x1="9" y1="13" x2="11" y2="13" stroke="#6b4226" strokeWidth="0.5" strokeDasharray="1 1" />
  </svg>
);

/** 天命 — 玉玺 (翠绿) */
const DestinyResourceIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 玉玺底部 */}
    <rect x="4" y="10" width="12" height="7" rx="1" fill="#4a8a5a" stroke="#3a6a4a" strokeWidth="0.8" />
    {/* 玉玺把手 */}
    <rect x="7" y="4" width="6" height="7" rx="2" fill="#5a9a6a" stroke="#3a6a4a" strokeWidth="0.8" />
    {/* 玉玺印文 */}
    <text x="10" y="15" textAnchor="middle" fontSize="4" fill="#d4a030" fontFamily="serif" fontWeight="bold">命</text>
    {/* 高光 */}
    <rect x="8" y="5" width="1.5" height="4" rx="0.5" fill="white" opacity="0.15" />
  </svg>
);

/** 资源图标映射 */
const RESOURCE_ICON_MAP: Record<string, React.FC<{ size?: number }>> = {
  grain: GrainResourceIcon,
  gold: GoldResourceIcon,
  troops: TroopsResourceIcon,
  destiny: DestinyResourceIcon,
};

/** 资源图标组件 — 根据资源 ID 渲染对应的 SVG */
export const ResourceIcon: React.FC<{ resourceId: string; size?: number }> = ({ resourceId, size = 20 }) => {
  const IconComponent = RESOURCE_ICON_MAP[resourceId];
  if (IconComponent) {
    return <IconComponent size={size} />;
  }
  // 兜底：显示通用资源图标
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="7" fill="#8B7355" stroke="#6b5a3a" strokeWidth="1" />
      <text x="10" y="13" textAnchor="middle" fontSize="8" fill="#d4a030">?</text>
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════
// 建筑升级进度条组件
// ═══════════════════════════════════════════════════════════════

/**
 * BuildingProgressBar — 建筑升级进度条
 *
 * 显示当前等级 → 下一等级的进度。
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
    <div style={{ width, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <div style={{
        width: '100%', height,
        borderRadius: Math.floor(height / 2),
        background: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          borderRadius: Math.floor(height / 2),
          background: `linear-gradient(90deg, ${barColor}, ${barColor}dd)`,
          transition: 'width 0.5s ease',
        }} />
      </div>
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
