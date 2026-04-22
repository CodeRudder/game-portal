import React from 'react';

export const TavernIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg data-testid="building-extra-icon-tavern" width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    {/* 旗杆 */}
    <line x1="10" y1="4" x2="10" y2="36" stroke="#6b4226" strokeWidth="2" />
    {/* 旗帜 */}
    <path d="M10,6 L28,8 L26,16 L28,24 L10,22 Z" fill="#6a3d7a" stroke="#8a5d9a" strokeWidth="0.8" />
    {/* 旗帜上的贤字 */}
    {/* 旗帜留空 */}
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

/** 烽火台 — 高塔+火焰+浓烟（橙红色系，64×64） */
export const BeaconTowerIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg data-testid="building-extra-icon-beacon-tower" width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="tk-beacon-fire" cx="0.5" cy="0.7" r="0.5">
        <stop offset="0%" stopColor="#ffeb3b" />
        <stop offset="40%" stopColor="#ff6600" />
        <stop offset="100%" stopColor="#bf360c" stopOpacity="0.3" />
      </radialGradient>
      <linearGradient id="tk-beacon-stone" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#7a7a7a" />
        <stop offset="100%" stopColor="#4a4a4a" />
      </linearGradient>
    </defs>
    {/* 石基 */}
    <rect x="12" y="52" width="40" height="8" rx="1.5" fill="#5a5a5a" stroke="#3a3a3a" strokeWidth="1.2" />
    <line x1="16" y1="55" x2="48" y2="55" stroke="#4a4a4a" strokeWidth="0.5" />
    {/* 梯形塔身 */}
    <path d="M18,52 L22,18 L42,18 L46,52 Z" fill="url(#tk-beacon-stone)" stroke="#3a3a3a" strokeWidth="1.5" />
    {/* 塔身石砖纹理 */}
    <line x1="20" y1="28" x2="44" y2="28" stroke="#5a5a5a" strokeWidth="0.6" />
    <line x1="21" y1="38" x2="43" y2="38" stroke="#5a5a5a" strokeWidth="0.6" />
    <line x1="32" y1="18" x2="32" y2="52" stroke="#5a5a5a" strokeWidth="0.5" />
    {/* 塔身横纹 */}
    <line x1="19" y1="33" x2="44" y2="33" stroke="#5a5a5a" strokeWidth="0.3" opacity="0.5" />
    <line x1="20" y1="43" x2="45" y2="43" stroke="#5a5a5a" strokeWidth="0.3" opacity="0.5" />
    {/* 塔顶平台 */}
    <rect x="18" y="15" width="28" height="4" rx="1" fill="#6a6a6a" stroke="#4a4a4a" strokeWidth="1" />
    {/* 垛口 */}
    <rect x="18" y="10" width="5" height="6" fill="url(#tk-beacon-stone)" stroke="#3a3a3a" strokeWidth="0.6" />
    <rect x="27" y="10" width="5" height="6" fill="url(#tk-beacon-stone)" stroke="#3a3a3a" strokeWidth="0.6" />
    <rect x="36" y="10" width="5" height="6" fill="url(#tk-beacon-stone)" stroke="#3a3a3a" strokeWidth="0.6" />
    <rect x="45" y="10" width="5" height="6" fill="url(#tk-beacon-stone)" stroke="#3a3a3a" strokeWidth="0.6" />
    {/* 火焰 — 顶部 */}
    <path d="M32,2 Q38,6 36,12 Q34,9 32,11 Q30,9 28,12 Q26,6 32,2 Z" fill="url(#tk-beacon-fire)" />
    <path d="M32,4 Q35,7 34,11 Q33,9 32,10 Q31,9 30,11 Q29,7 32,4 Z" fill="#ff9800" opacity="0.8" />
    <path d="M32,6 Q33,8 32.5,10 Q32,9 31.5,10 Q31,8 32,6 Z" fill="#ffeb3b" opacity="0.7" />
    {/* 火星 */}
    <circle cx="26" cy="4" r="1" fill="#ff6600" opacity="0.6" />
    <circle cx="38" cy="6" r="0.8" fill="#ff9800" opacity="0.5" />
    <circle cx="32" cy="0" r="0.6" fill="#ffaa00" opacity="0.4" />
    <circle cx="24" cy="8" r="0.5" fill="#ff4400" opacity="0.4" />
    <circle cx="40" cy="3" r="0.7" fill="#ffeb3b" opacity="0.3" />
    {/* 塔门 */}
    <path d="M26,52 L26,42 Q32,37 38,42 L38,52" fill="#2a1a0a" stroke="#1a0a00" strokeWidth="0.8" />
    {/* 浓烟 */}
    <path d="M28,9 Q26,4 29,1" stroke="#8a7a60" strokeWidth="0.8" fill="none" opacity="0.4" />
    <path d="M36,8 Q38,3 35,0" stroke="#8a7a60" strokeWidth="0.6" fill="none" opacity="0.3" />
    <path d="M32,7 Q30,2 33,-1" stroke="#8a7a60" strokeWidth="0.5" fill="none" opacity="0.25" />
    {/* 台阶 */}
    <rect x="24" y="52" width="16" height="3" rx="0.5" fill="#6b5a14" stroke="#5a4a14" strokeWidth="0.5" />
  </svg>
);

/** 钱庄 — 金库大门+铜钱堆+算盘（金色系，64×64） */
export const MintIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg data-testid="building-extra-icon-mint" width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tk-mint-gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#e8b84a" />
        <stop offset="100%" stopColor="#b8860b" />
      </linearGradient>
    </defs>
    {/* 建筑主体 */}
    <rect x="10" y="24" width="44" height="28" rx="1.5" fill="#8B6914" stroke="#6b5a14" strokeWidth="1.5" />
    {/* 飞檐屋顶 */}
    <path d="M4,26 L32,10 L60,26 Z" fill="url(#tk-mint-gold)" stroke="#8B6914" strokeWidth="1.2" />
    {/* 飞檐翘角 */}
    <path d="M0,26 Q4,21 8,26" stroke="#d4a030" strokeWidth="1.5" fill="none" />
    <path d="M56,26 Q60,21 64,26" stroke="#d4a030" strokeWidth="1.5" fill="none" />
    {/* 屋脊装饰 */}
    <circle cx="32" cy="10" r="2.5" fill="#d4a030" />
    {/* 屋顶铜钱装饰 — 左右 */}
    <circle cx="20" cy="17" r="4" fill="#b87333" stroke="#8B6914" strokeWidth="0.8" />
    <rect x="18.5" y="15.5" width="3" height="3" fill="#6b5a14" rx="0.3" />
    <circle cx="44" cy="17" r="4" fill="#b87333" stroke="#8B6914" strokeWidth="0.8" />
    <rect x="42.5" y="15.5" width="3" height="3" fill="#6b5a14" rx="0.3" />
    {/* 大门 */}
    <path d="M22,52 L22,34 Q32,27 42,34 L42,52" fill="#3a2a1a" stroke="#6b5a14" strokeWidth="1.2" />
    {/* 门钉 */}
    <circle cx="29" cy="40" r="1.2" fill="#d4a030" />
    <circle cx="35" cy="40" r="1.2" fill="#d4a030" />
    <circle cx="29" cy="46" r="1.2" fill="#d4a030" />
    <circle cx="35" cy="46" r="1.2" fill="#d4a030" />
    {/* 门环 */}
    <circle cx="28" cy="43" r="1.5" fill="none" stroke="#d4a030" strokeWidth="0.8" />
    <circle cx="36" cy="43" r="1.5" fill="none" stroke="#d4a030" strokeWidth="0.8" />
    {/* 匾额 — 钱庄 */}
    <rect x="22" y="26" width="20" height="6" rx="1" fill="#3a2a1a" stroke="#d4a030" strokeWidth="0.8" />
    {/* 匾额留空 */}
    {/* 窗户 */}
    <rect x="12" y="34" width="6" height="6" rx="1" fill="#d4a030" opacity="0.3" />
    <line x1="15" y1="34" x2="15" y2="40" stroke="#8B6914" strokeWidth="0.5" />
    <rect x="46" y="34" width="6" height="6" rx="1" fill="#d4a030" opacity="0.3" />
    <line x1="49" y1="34" x2="49" y2="40" stroke="#8B6914" strokeWidth="0.5" />
    {/* 算盘 — 门前左侧 */}
    <rect x="6" y="44" width="12" height="8" rx="1" fill="#8B6914" stroke="#6b5a14" strokeWidth="0.6" />
    <line x1="6" y1="47" x2="18" y2="47" stroke="#d4a030" strokeWidth="0.5" />
    <line x1="6" y1="50" x2="18" y2="50" stroke="#d4a030" strokeWidth="0.5" />
    {/* 算盘珠子 */}
    <circle cx="9" cy="46" r="1" fill="#b87333" />
    <circle cx="12" cy="46" r="1" fill="#b87333" />
    <circle cx="15" cy="46" r="1" fill="#b87333" />
    <circle cx="8" cy="49" r="1" fill="#b87333" />
    <circle cx="11" cy="49" r="1" fill="#b87333" />
    <circle cx="14" cy="49" r="1" fill="#b87333" />
    <circle cx="17" cy="49" r="1" fill="#b87333" />
    {/* 铜钱堆 — 门前右侧 */}
    <circle cx="52" cy="50" r="3" fill="#b87333" stroke="#8B6914" strokeWidth="0.5" />
    <rect x="50.8" y="48.8" width="2.4" height="2.4" fill="#6b5a14" rx="0.2" />
    <circle cx="56" cy="52" r="3" fill="#b87333" stroke="#8B6914" strokeWidth="0.5" />
    <rect x="54.8" y="50.8" width="2.4" height="2.4" fill="#6b5a14" rx="0.2" />
    <circle cx="54" cy="48" r="3" fill="#b87333" stroke="#8B6914" strokeWidth="0.5" />
    <rect x="52.8" y="46.8" width="2.4" height="2.4" fill="#6b5a14" rx="0.2" />
    {/* 台阶 */}
    <rect x="18" y="52" width="28" height="3" rx="0.8" fill="#6b5a14" stroke="#5a4a14" strokeWidth="0.6" />
  </svg>
);

/** 锻兵坊 — 铁砧+锤子+火花+炉火（深红橙色系，64×64） */
export const ForgeIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg data-testid="building-extra-icon-forge" width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="tk-forge-spark" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#ffeb3b" />
        <stop offset="50%" stopColor="#ff6600" />
        <stop offset="100%" stopColor="#bf360c" stopOpacity="0" />
      </radialGradient>
    </defs>
    {/* 简易棚屋 — 斜顶 */}
    <path d="M4,34 L32,14 L60,34 Z" fill="#6b4226" stroke="#4a2a16" strokeWidth="1.5" />
    <line x1="6" y1="34" x2="6" y2="58" stroke="#6b4226" strokeWidth="2" />
    <line x1="58" y1="34" x2="58" y2="58" stroke="#6b4226" strokeWidth="2" />
    {/* 棚顶茅草纹理 */}
    <line x1="14" y1="26" x2="50" y2="26" stroke="#8B6914" strokeWidth="0.5" opacity="0.5" />
    <line x1="10" y1="30" x2="54" y2="30" stroke="#8B6914" strokeWidth="0.5" opacity="0.5" />
    {/* 铁砧 */}
    <path d="M22,44 L42,44 L40,52 L24,52 Z" fill="#5a5a5a" stroke="#3a3a3a" strokeWidth="1.2" />
    <path d="M24,40 L40,40 L42,44 L22,44 Z" fill="#6a6a6a" stroke="#4a4a4a" strokeWidth="1" />
    <rect x="27" y="37" width="10" height="4" rx="1.2" fill="#7a7a7a" />
    {/* 被锻造的兵器 */}
    <path d="M30,36 L32,18 L34,36" fill="#8a8a8a" stroke="#6a6a6a" strokeWidth="0.6" opacity="0.7" />
    <polygon points="32,14 34,18 30,18" fill="#c0c0c0" opacity="0.7" />
    {/* 锤子 */}
    <line x1="44" y1="16" x2="38" y2="36" stroke="#6b4226" strokeWidth="3" strokeLinecap="round" />
    <rect x="40" y="12" width="8" height="7" rx="1.5" fill="#5a5a5a" stroke="#3a3a3a" strokeWidth="0.8" transform="rotate(-15 44 15.5)" />
    {/* 火花效果 */}
    <circle cx="18" cy="30" r="2" fill="url(#tk-forge-spark)" />
    <circle cx="14" cy="24" r="1.2" fill="#ff6600" opacity="0.7" />
    <circle cx="20" cy="20" r="1" fill="#ffaa00" opacity="0.5" />
    <circle cx="12" cy="28" r="0.8" fill="#ff4400" opacity="0.6" />
    <circle cx="24" cy="18" r="0.7" fill="#ffeb3b" opacity="0.4" />
    <circle cx="16" cy="16" r="0.6" fill="#ff6600" opacity="0.3" />
    {/* 炉火 — 左侧 */}
    <path d="M8,46 Q8,36 12,30 Q10,38 16,34 Q14,40 18,38 L18,46 Z" fill="#ff6600" opacity="0.6" />
    <path d="M10,42 Q10,36 12,32 Q11,38 14,36 Q12,40 14,40 L14,42 Z" fill="#ff9800" opacity="0.5" />
    <path d="M11,38 Q11,35 12,33 Q12,37 13,36 L13,38 Z" fill="#ffeb3b" opacity="0.4" />
    {/* 地面 */}
    <path d="M2,58 Q32,55 62,58" stroke="#5a4a2a" strokeWidth="0.8" fill="none" opacity="0.4" />
  </svg>
);

/** 茶馆 — 两层楼阁+茶幌子+茶壶（翠绿色系，64×64） */
export const TeahouseIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg data-testid="building-extra-icon-teahouse" width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tk-tea-roof" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#5a8a4a" />
        <stop offset="100%" stopColor="#3a6a3a" />
      </linearGradient>
    </defs>
    {/* 二层楼阁主体 */}
    <rect x="12" y="20" width="36" height="16" rx="1" fill="#d4b896" stroke="#8B7355" strokeWidth="1.2" />
    {/* 二层飞檐屋顶 */}
    <path d="M6,22 L30,8 L54,22 Z" fill="url(#tk-tea-roof)" stroke="#2e5d2e" strokeWidth="1.2" />
    {/* 飞檐翘角 */}
    <path d="M3,22 Q6,18 10,22" stroke="#5a8a4a" strokeWidth="1.2" fill="none" />
    <path d="M50,22 Q54,18 57,22" stroke="#5a8a4a" strokeWidth="1.2" fill="none" />
    {/* 二层窗户 */}
    <rect x="18" y="23" width="6" height="6" rx="1" fill="#3a6a3a" opacity="0.4" />
    <line x1="21" y1="23" x2="21" y2="29" stroke="#2e5d2e" strokeWidth="0.4" />
    <rect x="36" y="23" width="6" height="6" rx="1" fill="#3a6a3a" opacity="0.4" />
    <line x1="39" y1="23" x2="39" y2="29" stroke="#2e5d2e" strokeWidth="0.4" />
    {/* 二层匾额 */}
    <rect x="22" y="14" width="16" height="6" rx="1" fill="#3a2a1a" stroke="#d4a030" strokeWidth="0.6" />
    {/* 匾额留空 */}
    {/* 一层主体 */}
    <rect x="10" y="36" width="40" height="16" rx="1" fill="#d4b896" stroke="#8B7355" strokeWidth="1.2" />
    {/* 一层屋顶/挑檐 */}
    <path d="M6,38 L30,30 L54,38 Z" fill="url(#tk-tea-roof)" stroke="#2e5d2e" strokeWidth="0.8" opacity="0.7" />
    {/* 一层大门 */}
    <path d="M22,52 L22,42 Q30,37 38,42 L38,52" fill="#3a2a1a" stroke="#6b5a14" strokeWidth="0.8" />
    {/* 茶幌子 — 右侧悬挂 */}
    <line x1="52" y1="14" x2="52" y2="32" stroke="#6b4226" strokeWidth="1.2" />
    <rect x="49" y="16" width="7" height="14" rx="1" fill="#5a8a4a" stroke="#3a6a3a" strokeWidth="0.6" />
    {/* 茶幌留空 */}
    {/* 茶幌子 — 左侧 */}
    <line x1="8" y1="18" x2="8" y2="32" stroke="#6b4226" strokeWidth="1" />
    <rect x="5" y="20" width="6" height="10" rx="0.8" fill="#5a8a4a" stroke="#3a6a3a" strokeWidth="0.5" />
    {/* 茶幌留空 */}
    {/* 茶壶 — 左下 */}
    <ellipse cx="16" cy="50" rx="5" ry="3" fill="#8a6a4a" stroke="#6b4a2a" strokeWidth="0.8" />
    <path d="M16,46 L16,43" stroke="#6b4a2a" strokeWidth="1" />
    <ellipse cx="16" cy="43" rx="2.5" ry="1.2" fill="#6b4a2a" />
    {/* 壶嘴 */}
    <path d="M21,48 Q24,46 24,44" stroke="#6b4a2a" strokeWidth="1" fill="none" />
    {/* 壶把 */}
    <path d="M11,47 Q8,47 8,50 Q8,53 11,53" stroke="#6b4a2a" strokeWidth="1" fill="none" />
    {/* 蒸汽 */}
    <path d="M14,41 Q13,38 15,36" stroke="#8a7a60" strokeWidth="0.6" fill="none" opacity="0.5" />
    <path d="M17,40 Q18,37 16,35" stroke="#8a7a60" strokeWidth="0.5" fill="none" opacity="0.4" />
    {/* 茶碗 — 右下 */}
    <path d="M42,46 L50,46 L49,52 L43,52 Z" fill="#d4b896" stroke="#8B7355" strokeWidth="0.6" />
    <ellipse cx="46" cy="46" rx="4.5" ry="1.5" fill="#c4a886" stroke="#8B7355" strokeWidth="0.4" />
    {/* 蒸汽 — 茶碗 */}
    <path d="M44,44 Q43,41 45,39" stroke="#8a7a60" strokeWidth="0.5" fill="none" opacity="0.5" />
    <path d="M48,43 Q49,40 47,38" stroke="#8a7a60" strokeWidth="0.4" fill="none" opacity="0.4" />
    {/* 地面 */}
    <path d="M2,58 Q32,55 62,58" stroke="#5a4a2a" strokeWidth="0.8" fill="none" opacity="0.4" />
  </svg>
);

/** 粮仓 — 圆顶仓廪+粮袋堆+斗量（棕黄色系） */
export const GranaryIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg data-testid="building-extra-icon-granary" width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tk-granary-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#c49a28" />
        <stop offset="100%" stopColor="#8B6914" />
      </linearGradient>
    </defs>
    {/* 圆顶仓廪主体 */}
    <rect x="8" y="16" width="20" height="16" rx="1" fill="url(#tk-granary-body)" stroke="#6b5a14" strokeWidth="1" />
    {/* 圆顶 */}
    <path d="M6,18 L18,6 L30,18 Z" fill="#b8860b" stroke="#8B6914" strokeWidth="0.8" />
    {/* 飞檐 */}
    <path d="M4,18 Q6,15 9,18" stroke="#d4a030" strokeWidth="0.6" fill="none" />
    <path d="M27,18 Q30,15 32,18" stroke="#d4a030" strokeWidth="0.6" fill="none" />
    {/* 仓门 */}
    <rect x="14" y="24" width="8" height="8" rx="0.5" fill="#3a2a1a" stroke="#6b5a14" strokeWidth="0.6" />
    <line x1="18" y1="24" x2="18" y2="32" stroke="#6b5a14" strokeWidth="0.4" />
    <circle cx="17" cy="28" r="0.6" fill="#d4a030" />
    <circle cx="19" cy="28" r="0.6" fill="#d4a030" />
    {/* 仓廪横纹 */}
    <line x1="8" y1="20" x2="28" y2="20" stroke="#a08a65" strokeWidth="0.4" opacity="0.5" />
    <line x1="8" y1="24" x2="14" y2="24" stroke="#a08a65" strokeWidth="0.4" opacity="0.5" />
    <line x1="22" y1="24" x2="28" y2="24" stroke="#a08a65" strokeWidth="0.4" opacity="0.5" />
    {/* 仓顶装饰 */}
    <circle cx="18" cy="7" r="1.5" fill="#d4a030" />
    {/* 粮袋堆 — 右侧 */}
    <path d="M30,34 Q30,28 33,26 Q36,28 36,34 Z" fill="#d4b896" stroke="#8B7355" strokeWidth="0.6" />
    <line x1="33" y1="27" x2="33" y2="34" stroke="#8B7355" strokeWidth="0.3" />
    <path d="M32,34 Q32,30 34,28.5 Q36,30 36,34 Z" fill="#c49a28" opacity="0.4" />
    {/* 小粮袋 — 右下 */}
    <rect x="28" y="30" width="4" height="4" rx="1" fill="#d4b896" stroke="#8B7355" strokeWidth="0.4" />
    <line x1="28" y1="32" x2="32" y2="32" stroke="#8B7355" strokeWidth="0.3" />
    {/* 斗量 — 左下 */}
    <path d="M4,30 L8,28 L12,30 L10,36 L6,36 Z" fill="#8B6914" stroke="#6b5a14" strokeWidth="0.5" />
    <line x1="4" y1="30" x2="12" y2="30" stroke="#6b5a14" strokeWidth="0.4" />
    {/* 斗内粮食 */}
    <ellipse cx="8" cy="30" rx="3" ry="1" fill="#d4a030" opacity="0.6" />
    {/* 麦穗装饰 — 仓顶 */}
    <line x1="12" y1="8" x2="12" y2="4" stroke="#6b8e5a" strokeWidth="0.8" />
    <ellipse cx="12" cy="3.5" rx="1.2" ry="2" fill="#8aaa5a" />
    <line x1="24" y1="8" x2="24" y2="5" stroke="#6b8e5a" strokeWidth="0.8" />
    <ellipse cx="24" cy="4.5" rx="1" ry="1.8" fill="#8aaa5a" />
    {/* 地面 */}
    <path d="M2,36 Q20,34 38,36" stroke="#5a4a2a" strokeWidth="0.6" fill="none" opacity="0.4" />
  </svg>
);

/** 建筑图标映射 — 根据建筑 ID 返回对应的 SVG 组件 */
