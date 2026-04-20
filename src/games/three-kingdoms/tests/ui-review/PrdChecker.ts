/**
 * PrdChecker — UI评测框架PRD需求检查器
 *
 * 解析PRD文档，提取需求清单和验收标准，
 * 并在源码中自动检查每个需求是否有对应实现。
 *
 * @module ui-review/PrdChecker
 */

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** PRD需求项 */
export interface PrdRequirement {
  /** 需求编号，如 "RES-1", "RES-2" */
  id: string;
  /** 所属章节标题 */
  section: string;
  /** 需求描述 */
  description: string;
  /** 验收标准列表 */
  acceptance: string[];
  /** 优先级 */
  priority: string;
}

/** PRD文档 */
export interface PrdDocument {
  /** 模块名称，如 "资源系统", "建筑系统" */
  module: string;
  /** 模块代码，如 "RES", "BLD" */
  moduleCode: string;
  /** 需求列表 */
  requirements: PrdRequirement[];
}

/** 未满足的需求详情 */
export interface UnsatisfiedRequirement {
  /** 需求定义 */
  requirement: PrdRequirement;
  /** 未满足原因 */
  reason: string;
}

/** PRD检查结果 */
export interface PrdCheckResult {
  /** 模块名称 */
  module: string;
  /** 需求总数 */
  totalRequirements: number;
  /** 已满足需求数 */
  satisfiedRequirements: number;
  /** 未满足的需求列表 */
  unsatisfied: UnsatisfiedRequirement[];
  /** 覆盖率百分比 (0~100) */
  coveragePercent: number;
}

// ---------------------------------------------------------------------------
// PRD模块代码 → 搜索关键词映射
// ---------------------------------------------------------------------------

const MODULE_SEARCH_HINTS: Record<string, string[]> = {
  NAV: ['navigation', 'Navigation', 'MainLayout', 'main', 'Tab', 'Scene'],
  RES: ['resource', 'Resource', 'production', 'consume', 'cap', '资源'],
  BLD: ['building', 'Building', 'upgrade', '建筑', 'unlock'],
  ITR: ['interaction', 'Panel', 'Modal', 'Toast', '交互', '面板'],
  SPEC: ['spec', 'theme', 'style', '规范', '配色'],
  HER: ['hero', 'Hero', '武将', 'recruit', 'General'],
  TECH: ['tech', 'Tech', '科技', 'research', 'Technology'],
  CBT: ['combat', 'battle', '战斗', 'Combat', 'Battle'],
  MAP: ['map', 'Map', '地图', 'territory', 'WorldMap'],
  EQP: ['equipment', 'Equipment', '装备', 'weapon'],
  SHP: ['shop', 'Shop', '商店', 'trade', 'Trade'],
  SOC: ['social', 'Social', '社交', 'alliance', 'Alliance'],
  QST: ['quest', 'Quest', '任务', 'mission'],
  ACT: ['activity', 'Activity', '活动', 'event', 'Event'],
  EXP: ['expedition', 'Expedition', '远征'],
  PRS: ['prestige', 'Prestige', '声望', 'reputation'],
  PVP: ['pvp', 'PVP', 'arena', 'Arena', '竞技'],
  MAL: ['mail', 'Mail', '邮件', 'message'],
  NPC: ['npc', 'NPC', '好感度', 'favorability'],
  EVT: ['event', 'Event', '事件'],
  SET: ['setting', 'Setting', '设置'],
};

// ---------------------------------------------------------------------------
// PrdChecker 类
// ---------------------------------------------------------------------------

/**
 * PRD文档需求检查器
 *
 * 解析PRD文档中的需求章节，提取需求项和验收标准，
 * 然后在源码中搜索对应实现。
 */
export class PrdChecker {
  // -------------------------------------------------------------------------
  // 公共方法
  // -------------------------------------------------------------------------

  /**
   * 解析PRD文档的Markdown内容
   *
   * 支持的章节格式：
   * ## [RES-1] 资源类型 {#res-1}
   *
   * @param markdownContent - PRD文档的完整Markdown文本
   * @returns 解析出的PRD文档
   */
  parsePrdDocument(markdownContent: string): PrdDocument {
    const moduleCode = this.extractModuleCode(markdownContent);
    const moduleName = this.extractModuleName(markdownContent);
    const requirements = this.extractRequirements(markdownContent);

    return {
      module: moduleName,
      moduleCode,
      requirements,
    };
  }

  /**
   * 从文件系统加载PRD文档（Node.js环境）
   *
   * @param moduleCode - 模块代码，如 "RES"
   * @param prdDir - PRD目录的绝对路径
   * @returns PRD文档
   */
  async loadPrd(moduleCode: string, prdDir: string): Promise<PrdDocument> {
    const fs = await import('fs');
    const path = await import('path');

    const files = fs.readdirSync(prdDir);
    const targetFile = files.find(
      (f) => f.startsWith(moduleCode) && f.endsWith('.md')
    );

    if (!targetFile) {
      throw new Error(`PRD document not found for module: ${moduleCode}`);
    }

    const filePath = path.join(prdDir, targetFile);
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parsePrdDocument(content);
  }

  /**
   * 检查PRD需求的满足度
   *
   * 遍历每个需求项，在源码中搜索实现证据，
   * 判断需求是否已满足。
   *
   * @param prd - PRD文档
   * @param sourceFiles - 源码文件路径列表
   * @param sourceContents - 源码文件内容映射
   * @returns 检查结果
   */
  check(
    prd: PrdDocument,
    sourceFiles: string[],
    sourceContents: Map<string, string>
  ): PrdCheckResult {
    const unsatisfied: UnsatisfiedRequirement[] = [];

    for (const req of prd.requirements) {
      const isSatisfied = this.checkRequirement(req, prd.moduleCode, sourceFiles, sourceContents);

      if (!isSatisfied) {
        unsatisfied.push({
          requirement: req,
          reason: `未找到需求 [${req.id}] "${req.description}" 的实现证据`,
        });
      }
    }

    const satisfiedCount = prd.requirements.length - unsatisfied.length;
    const coveragePercent =
      prd.requirements.length > 0
        ? Math.round((satisfiedCount / prd.requirements.length) * 100)
        : 0;

    return {
      module: prd.module,
      totalRequirements: prd.requirements.length,
      satisfiedRequirements: satisfiedCount,
      unsatisfied,
      coveragePercent,
    };
  }

  // -------------------------------------------------------------------------
  // 私有方法 — 文档解析
  // -------------------------------------------------------------------------

  /**
   * 从文档中提取模块代码
   * 格式: "# [RES] 资源系统 — 玩法设计 (PRD)" → "RES"
   */
  private extractModuleCode(content: string): string {
    const match = content.match(/^#\s+\[([A-Z]+)\]/m);
    return match ? match[1] : 'unknown';
  }

  /**
   * 从文档中提取模块名称
   * 格式: "# [RES] 资源系统 — 玩法设计 (PRD)" → "资源系统"
   */
  private extractModuleName(content: string): string {
    const match = content.match(/^#\s+\[[A-Z]+\]\s*(.+?)(?:\s*[—\-])/m);
    return match ? match[1].trim() : 'unknown';
  }

  /**
   * 从PRD文档中提取所有需求项
   *
   * 解析 ## [XXX-N] 标题格式的章节，每个章节为一个需求项。
   * 提取章节标题中的编号、描述，以及章节内的验收标准。
   */
  private extractRequirements(content: string): PrdRequirement[] {
    const requirements: PrdRequirement[] = [];
    const lines = content.split('\n');

    let currentReq: Partial<PrdRequirement> | null = null;
    let currentSection = '';
    let inAcceptanceBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 匹配需求章节标题: ## [RES-1] 资源类型 {#res-1}
      const sectionMatch = line.match(
        /^##\s+\[([A-Z]+-\d+)\]\s*(.+?)(?:\s*\{[^}]*\})?\s*$/
      );

      if (sectionMatch) {
        // 保存上一个需求
        if (currentReq && currentReq.id) {
          requirements.push({
            id: currentReq.id,
            section: currentReq.section || '',
            description: currentReq.description || '',
            acceptance: currentReq.acceptance || [],
            priority: currentReq.priority || 'P1',
          });
        }

        currentReq = {
          id: sectionMatch[1],
          section: sectionMatch[2].trim(),
          description: sectionMatch[2].trim(),
          acceptance: [],
          priority: 'P1',
        };
        currentSection = sectionMatch[2].trim();
        inAcceptanceBlock = false;
        continue;
      }

      if (!currentReq) continue;

      // 匹配功能描述段落 (### 功能描述 之后的文字)
      const descMatch = line.match(/^###\s+功能描述/);
      if (descMatch) {
        // 向前查找第一个非空、非标题、非引用的行作为描述
        for (let j = i + 1; j < lines.length; j++) {
          const lookAhead = lines[j].trim();
          if (!lookAhead) continue; // 跳过空行
          if (lookAhead.startsWith('#')) break; // 遇到标题停止
          if (lookAhead.startsWith('>')) continue; // 跳过引用行
          currentReq.description = lookAhead;
          break;
        }
        continue;
      }

      // 匹配验收标准标记
      if (line.includes('验收标准') || line.includes('验收')) {
        inAcceptanceBlock = true;
        continue;
      }

      // 收集验收标准（- [ ] 或 - 开头的列表项）
      if (inAcceptanceBlock || currentReq.acceptance!.length === 0) {
        const listMatch = line.match(/^\s*[-*]\s+(?:\[[ x]\]\s*)?(.+)/);
        if (listMatch && currentReq.acceptance) {
          const item = listMatch[1].trim();
          // 只收集有意义的内容，跳过纯引用行
          if (item.length > 5 && !item.startsWith('🎨') && !item.startsWith('→')) {
            currentReq.acceptance.push(item);
          }
        }
      }

      // 遇到新的 ## 标题时结束验收标准收集
      if (line.startsWith('## ') && !sectionMatch) {
        inAcceptanceBlock = false;
      }
    }

    // 保存最后一个需求
    if (currentReq && currentReq.id) {
      requirements.push({
        id: currentReq.id,
        section: currentReq.section || '',
        description: currentReq.description || '',
        acceptance: currentReq.acceptance || [],
        priority: currentReq.priority || 'P1',
      });
    }

    return requirements;
  }

  // -------------------------------------------------------------------------
  // 私有方法 — 需求检查
  // -------------------------------------------------------------------------

  /**
   * 检查单个需求是否满足
   *
   * 策略：
   * 1. 从需求描述和章节标题中提取关键词
   * 2. 在源码中搜索这些关键词
   * 3. 至少有一个描述关键词在至少一个文件中匹配则视为满足
   *
   * 注意：不使用模块级别的宽泛提示词作为独立匹配条件，
   * 避免所有同模块需求都误判为已满足。
   */
  private checkRequirement(
    req: PrdRequirement,
    moduleCode: string,
    sourceFiles: string[],
    sourceContents: Map<string, string>
  ): boolean {
    // 从需求描述和章节中提取具体关键词
    const descKeywords = this.extractDescriptionKeywords(req.description);
    const sectionKeywords = this.extractDescriptionKeywords(req.section);

    // 合并描述和章节关键词（去重）
    const keywords = [...new Set([...descKeywords, ...sectionKeywords])];

    if (keywords.length === 0) return false;

    // 至少有一个关键词匹配即可
    for (const keyword of keywords) {
      if (this.searchKeyword(keyword, sourceFiles, sourceContents)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 在源码中搜索关键词
   *
   * @param keyword - 搜索关键词
   * @param sourceFiles - 源码文件路径列表
   * @param sourceContents - 源码文件内容映射
   * @returns 是否找到匹配
   */
  private searchKeyword(
    keyword: string,
    sourceFiles: string[],
    sourceContents: Map<string, string>
  ): boolean {
    const lowerKeyword = keyword.toLowerCase();

    for (const filePath of sourceFiles) {
      const content = sourceContents.get(filePath);
      if (!content) continue;

      if (content.toLowerCase().includes(lowerKeyword)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 从描述文本中提取搜索关键词
   *
   * 提取有意义的中文词汇和英文标识符。
   */
  private extractDescriptionKeywords(text: string): string[] {
    const keywords: string[] = [];

    // 提取中文关键词（2~4字）
    const chineseWords = text.match(/[\u4e00-\u9fff]{2,4}/g) || [];
    keywords.push(...chineseWords);

    // 提取英文标识符
    const englishWords = text.match(/[a-zA-Z][a-zA-Z0-9]{2,}/g) || [];
    keywords.push(...englishWords);

    return [...new Set(keywords)];
  }
}
