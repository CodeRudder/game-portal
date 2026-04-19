/**
 * TimeSource — 可注入的时间源
 *
 * 默认使用 Date.now()，测试时可替换为可控时间。
 * 所有子系统模块应使用此类替代直接调用 Date.now()。
 *
 * @example
 * // 生产环境（默认）
 * const time = new TimeSource();
 * time.now(); // Date.now()
 *
 * // 测试环境
 * const time = new TimeSource(() => mockTime);
 * time.now(); // mockTime()
 *
 * // 固定时间
 * const time = TimeSource.fixed(1000);
 * time.now(); // 1000
 *
 * // 步进时间
 * const time = TimeSource.stepped(0, 1000);
 * time.now(); // 0
 * time.now(); // 1000
 * time.now(); // 2000
 */
export class TimeSource {
  private readonly _now: () => number;

  constructor(now?: () => number) {
    this._now = now ?? (() => Date.now());
  }

  /** 获取当前时间戳（毫秒） */
  now(): number {
    return this._now();
  }

  /** 创建默认 TimeSource（使用 Date.now） */
  static default(): TimeSource {
    return new TimeSource();
  }

  /** 创建固定时间的 TimeSource（测试用） */
  static fixed(timestamp: number): TimeSource {
    return new TimeSource(() => timestamp);
  }

  /** 创建可步进的 TimeSource（测试用） */
  static stepped(initial: number = 0, step: number = 1000): TimeSource {
    let current = initial;
    return new TimeSource(() => {
      const val = current;
      current += step;
      return val;
    });
  }
}
