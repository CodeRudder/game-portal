/**
 * PlanValidator — UI评测框架核心验证器
 *
 * 解析PLAN版本文档，提取功能点清单，并在源码中自动验证每个功能点是否有对应实现。
 *
 * @module ui-review/PlanValidator
 */

/** 功能点定义 */
export interface PlanFeature {
  /** 功能点编号，如 "A1", "B3" */
  id: string;
  /** 所属模块，如 "主界面导航", "资源系统" */
  module: string;
  /** 功能描述 */
  description: string;
  /** 优先级 P0/P1/P2 */
  priority: string;
  /** PRD文档引用链接 */
  prdRef?: string;
  /** UI文档引用链接 */
  uiRef?: string;
}

/** 版本计划 */
export interface VersionPlan {
  /** 版本号，如 "v1.0" */
  version: string;
  /** 版本标题，如 "基业初立" */
  title: string;
  /** 功能点列表 */
  features: PlanFeature[];
  /** 功能点总数 */
  totalFeatures: number;
}

/** 单个功能点的验证详情 */
export interface FeatureValidationDetail {
  /** 功能点定义 */
  feature: PlanFeature;
  /** 验证状态 */
  status: 'verified' | 'missing' | 'partial';
  /** 在源码中找到的证据（文件路径或代码片段） */
  evidence: string[];
}

/** 验证结果 */
export interface PlanValidationResult {
  /** 版本号 */
  version: string;
  /** 功能点总数 */
  totalFeatures: number;
  /** 已验证通过的功能点数 */
  verifiedFeatures: number;
  /** 缺失的功能点ID列表 */
  missingFeatures: string[];
  /** 覆盖率百分比 (0~100) */
  coveragePercent: number;
  /** 每个功能点的详细验证结果 */
  details: FeatureValidationDetail[];
}

const MODULE_CODE_MAP: Record<string, string> = {
  A: '主界面导航',
  B: '资源系统',
  C: '建筑系统',
  D: '全局规范',
  E: '武将系统',
  F: '科技系统',
  G: '关卡系统',
  H: '地图系统',
  I: '战斗系统',
  J: '装备系统',
  K: '商贸系统',
  L: '联盟系统',
  M: '事件系统',
  N: '声望系统',
  O: '远征系统',
  P: '活动系统',
  Q: '任务系统',
  R: '社交系统',
  S: '商店系统',
  T: '邮件系统',
  U: 'NPC系统',
  V: 'PVP竞技',
  W: '设置系统',
  X: '新手引导',
  Y: '传承系统',
  Z: '竖屏适配',
};

const DESCRIPTION_KEYWORD_MAP: Array<{
  pattern: RegExp;
  keywords: string[];
}> = [
  { pattern: /资源栏|资源图标|资源数值|产出速率/, keywords: ['ResourceBar', 'resource', '资源'] },
  { pattern: /Tab切换|导航Tab|Tab栏/, keywords: ['TabBar', 'tab', 'Tab', '导航'] },
  { pattern: /中央场景|场景区|俯瞰/, keywords: ['SceneArea', 'scene', '场景'] },
  { pattern: /日历|年号|季节|天气/, keywords: ['Calendar', 'calendar', '日历', 'GameCalendar'] },
  { pattern: /资源定义|核心资源|粮草|铜钱|兵力|天命/, keywords: ['resource', 'Resource', '粮草', '铜钱', '兵力', '天命'] },
  { pattern: /产出公式|资源产出|产出速率/, keywords: ['production', 'Production', '产出', 'rate'] },
  { pattern: /资源消耗|消耗场景/, keywords: ['consume', 'Consume', '消耗', 'cost'] },
  { pattern: /存储|上限|容量|溢出/, keywords: ['cap', 'Cap', 'capacity', '上限', '存储'] },
  { pattern: /容量警告|接近上限|变色/, keywords: ['warning', 'Warning', '警告', 'overflow'] },
  { pattern: /天命资源|天命/, keywords: ['destiny', '天命', 'Fate'] },
  { pattern: /粒子效果|粒子动画|飞出/, keywords: ['particle', 'Particle', '粒子'] },
  { pattern: /建筑总览|建筑类型|依赖关系/, keywords: ['building', 'Building', '建筑'] },
  { pattern: /建筑升级|升级机制|等级提升/, keywords: ['upgrade', 'Upgrade', '升级', 'levelUp'] },
  { pattern: /建筑产出|产出明细/, keywords: ['buildingProduction', '产出'] },
  { pattern: /建筑联动|解锁|前置关系/, keywords: ['unlock', 'Unlock', '解锁', 'dependency'] },
  { pattern: /城池俯瞰|建筑列表|筛选栏/, keywords: ['BuildingList', 'building', '俯瞰'] },
  { pattern: /建筑队列|队列槽位|并行升级/, keywords: ['queue', 'Queue', '队列'] },
  { pattern: /升级路线|推荐/, keywords: ['recommend', 'Recommend', '路线'] },
  { pattern: /配色|字体|间距|风格/, keywords: ['theme', 'Theme', 'style', 'Style', 'color'] },
  { pattern: /面板组件|打开|关闭|折叠/, keywords: ['Panel', 'panel', '面板'] },
  { pattern: /弹窗|Modal|类型/, keywords: ['Modal', 'modal', '弹窗', 'Dialog'] },
  { pattern: /Toast|提示|时长|位置/, keywords: ['Toast', 'toast', '提示'] },
  { pattern: /自动保存|localStorage|保存/, keywords: ['save', 'Save', 'localStorage', '保存'] },
  { pattern: /离线收益|离线|补算/, keywords: ['offline', 'Offline', '离线'] },
  { pattern: /武将|招募|英雄/, keywords: ['hero', 'Hero', '武将', 'recruit'] },
  { pattern: /科技|研究|升级/, keywords: ['tech', 'Tech', '科技', 'research'] },
  { pattern: /关卡|战斗|出征/, keywords: ['campaign', 'Campaign', '关卡', 'battle'] },
  { pattern: /地图|领土|城池/, keywords: ['map', 'Map', '地图', 'territory'] },
];

/**
 * PLAN文档验证器
 */
export class PlanValidator {
  // -------------------------------------------------------------------------
  // 公共方法
  // -------------------------------------------------------------------------

  /**
   * 解析PLAN文档的Markdown内容，提取版本计划
   *
   * 支持的表格格式：
   * | # | 功能点 | PRD引用 | UI引用 | 优先级 |
   *
   * @param markdownContent - PLAN文档的完整Markdown文本
   * @returns 解析出的版本计划
   */
  parsePlanDocument(markdownContent: string): VersionPlan {
    const version = this.extractVersion(markdownContent);
    const title = this.extractTitle(markdownContent);
    const features = this.extractFeatures(markdownContent);

    return {
      version,
      title,
      features,
      totalFeatures: features.length,
    };
  }

  /**
   * 从文件系统加载指定版本的PLAN文档（Node.js环境）
   *
   * @param version - 版本号，如 "v1.0"
   * @param plansDir - plans目录的绝对路径
   * @returns 版本计划
   */
  async loadPlan(version: string, plansDir: string): Promise<VersionPlan> {
    const fs = await import('fs');
    const path = await import('path');

    const files = fs.readdirSync(plansDir);
    const targetFile = files.find(
      (f) => f.startsWith(version) && f.endsWith('.md')
    );

    if (!targetFile) {
      throw new Error(`PLAN document not found for version: ${version}`);
    }

    const filePath = path.join(plansDir, targetFile);
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parsePlanDocument(content);
  }

  /**
   * 验证功能点覆盖情况
   *
   * 遍历计划中的每个功能点，在源码文件中搜索实现证据，
   * 判断功能点是否已实现。
   *
   * @param plan - 版本计划
   * @param sourceFiles - 源码文件路径列表
   * @param sourceContents - 源码文件内容映射（文件路径 → 内容）
   * @returns 验证结果
   */
  validate(
    plan: VersionPlan,
    sourceFiles: string[],
    sourceContents: Map<string, string>
  ): PlanValidationResult {
    const details: FeatureValidationDetail[] = plan.features.map((feature) => {
      const evidence = this.searchEvidence(feature, sourceFiles, sourceContents);
      const status: 'verified' | 'missing' | 'partial' =
        evidence.length >= 2 ? 'verified' : evidence.length === 1 ? 'partial' : 'missing';

      return { feature, status, evidence };
    });

    const verifiedFeatures = details.filter(
      (d) => d.status === 'verified' || d.status === 'partial'
    ).length;

    const missingFeatures = details
      .filter((d) => d.status === 'missing')
      .map((d) => d.feature.id);

    const coveragePercent =
      plan.totalFeatures > 0
        ? Math.round((verifiedFeatures / plan.totalFeatures) * 100)
        : 0;

    return {
      version: plan.version,
      totalFeatures: plan.totalFeatures,
      verifiedFeatures,
      missingFeatures,
      coveragePercent,
      details,
    };
  }

  // -------------------------------------------------------------------------
  // 私有方法 — 文档解析
  // -------------------------------------------------------------------------

  /**
   * 从文档中提取版本号
   * 格式: "# v1.0 基业初立" 或标题行
   */
  private extractVersion(content: string): string {
    const match = content.match(/^#\s+(v[\d.]+)/m);
    return match ? match[1] : 'unknown';
  }

  /**
   * 从文档中提取版本标题
   * 格式: "# v1.0 基业初立" → "基业初立"
   */
  private extractTitle(content: string): string {
    const match = content.match(/^#\s+v[\d.]+\s+(.+)/m);
    return match ? match[1].trim() : 'unknown';
  }

  /**
   * 从PLAN文档中提取所有功能点
   *
   * 解析Markdown表格行，支持以下格式：
   * | 1 | 功能描述 | PRD引用 | UI引用 | P0 |
   * | 6 | 功能描述 | PRD引用 | — | P1 |
   *
   * 同时解析模块标题行 (### 模块X: 名称) 来确定模块归属。
   */
  private extractFeatures(content: string): PlanFeature[] {
    const features: PlanFeature[] = [];
    const lines = content.split('\n');

    let currentModule = '';
    let currentModuleCode = '';
    let featureCounter = 0;

    for (const line of lines) {
      // 匹配模块标题: ### 模块A: 主界面导航 (NAV)
      const moduleMatch = line.match(
        /###\s+模块([A-Z])[:：]\s*(.+?)(?:\s*\([^)]*\))?\s*$/
      );
      if (moduleMatch) {
        currentModuleCode = moduleMatch[1];
        currentModule = moduleMatch[2].trim();
        featureCounter = 0;
        continue;
      }

      // 匹配功能表格行: | 1 | 描述 | 引用 | 引用 | P0 |
      const tableMatch = line.match(
        /^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(P[012])\s*\|/
      );
      if (tableMatch) {
        featureCounter++;
        const num = parseInt(tableMatch[1], 10);
        const description = tableMatch[2].trim();
        const prdRef = this.cleanRef(tableMatch[3]);
        const uiRef = this.cleanRef(tableMatch[4]);
        const priority = tableMatch[5];

        // 生成ID: 模块代码 + 序号
        const id = currentModuleCode
          ? `${currentModuleCode}${featureCounter}`
          : `F${num}`;

        features.push({
          id,
          module: currentModule,
          description,
          priority,
          prdRef: prdRef || undefined,
          uiRef: uiRef || undefined,
        });
      }
    }

    return features;
  }

  /**
   * 清理引用文本，提取有意义的部分
   * "— " → undefined, "[PRD: NAV-1 描述](url)" → "PRD: NAV-1 描述"
   */
  private cleanRef(ref: string): string | undefined {
    const cleaned = ref.trim();
    if (!cleaned || cleaned === '—' || cleaned === '-') {
      return undefined;
    }
    // 提取Markdown链接的显示文本
    const linkMatch = cleaned.match(/\[([^\]]+)\]/);
    return linkMatch ? linkMatch[1] : cleaned;
  }

  // -------------------------------------------------------------------------
  // 私有方法 — 源码搜索
  // -------------------------------------------------------------------------

  /**
   * 在源码中搜索功能点的实现证据
   *
   * 策略：
   * 1. 根据功能描述匹配预定义关键词
   * 2. 在源码文件中搜索这些关键词
   * 3. 返回匹配到的文件路径列表
   *
   * @param feature - 功能点
   * @param sourceFiles - 源码文件路径列表
   * @param sourceContents - 源码文件内容映射
   * @returns 匹配到的文件路径列表（去重）
   */
  private searchEvidence(
    feature: PlanFeature,
    sourceFiles: string[],
    sourceContents: Map<string, string>
  ): string[] {
    const keywords = this.getKeywordsForFeature(feature);
    const evidence: Set<string> = new Set();

    for (const keyword of keywords) {
      for (const filePath of sourceFiles) {
        const content = sourceContents.get(filePath);
        if (!content) continue;

        // 大小写不敏感搜索
        if (content.toLowerCase().includes(keyword.toLowerCase())) {
          evidence.add(filePath);
        }
      }
    }

    return Array.from(evidence);
  }

  /**
   * 根据功能点描述获取搜索关键词
   *
   * 优先使用预定义的关键词映射表，如果无匹配则
   * 从描述中提取核心词汇。
   */
  private getKeywordsForFeature(feature: PlanFeature): string[] {
    // 尝试匹配预定义关键词
    for (const mapping of DESCRIPTION_KEYWORD_MAP) {
      if (mapping.pattern.test(feature.description)) {
        return mapping.keywords;
      }
    }

    // 回退：从描述中提取关键词
    return this.extractKeywordsFromDescription(feature.description);
  }

  /**
   * 从功能描述中提取关键词
   *
   * 移除常见停用词后，提取有意义的中文词汇和英文标识符。
   */
  private extractKeywordsFromDescription(description: string): string[] {
    const stopwords = new Set([
      '的', '和', '与', '或', '在', '为', '对', '是', '有',
      '中', '等', '可', '及', '由', '以', '—', '—',
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for',
    ]);

    // 提取中文词汇（2~4字）和英文标识符
    const chineseWords = description.match(/[\u4e00-\u9fff]{2,4}/g) || [];
    const englishWords = description.match(/[a-zA-Z][a-zA-Z0-9]{2,}/g) || [];

    const keywords: string[] = [];

    for (const word of chineseWords) {
      if (!stopwords.has(word)) {
        keywords.push(word);
      }
    }

    for (const word of englishWords) {
      if (!stopwords.has(word.toLowerCase())) {
        keywords.push(word);
      }
    }

    // 去重并限制数量
    return [...new Set(keywords)].slice(0, 5);
  }

  /**
   * 解析功能点ID为模块代码和序号
   *
   * @param id - 功能点ID，如 "A1", "B3"
   * @returns 模块代码和序号
   */
  parseFeatureId(id: string): { module: string; number: number } {
    const match = id.match(/^([A-Z])(\d+)$/);
    if (!match) {
      return { module: 'unknown', number: 0 };
    }

    const moduleCode = match[1];
    const number = parseInt(match[2], 10);
    const moduleName = MODULE_CODE_MAP[moduleCode] || 'unknown';

    return { module: moduleName, number };
  }
}
