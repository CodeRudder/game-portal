/**
 * Navigator API 类型扩展
 *
 * 补充 Web API 中尚未纳入 TypeScript 标准类型定义的属性。
 * 这些 API 是浏览器实验性功能，通过 Device Memory API 提供。
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory
 */
export {};

declare global {
  interface Navigator {
    /**
     * 设备内存大小（GB），近似值。
     * 仅在支持 Device Memory API 的浏览器中可用。
     * 值为 0.25, 0.5, 1, 2, 4, 8 之一（向上取整报告）。
     */
    readonly deviceMemory?: number;
  }
}
