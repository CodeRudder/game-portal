/**
 * ACC 验收测试工具函数
 *
 * 提供统一的测试描述生成、严格断言和可见性检查工具。
 */
export function accTest(id: string, description: string): string {
  return `[${id}] ${description}`;
}

export function assertStrict(condition: boolean, accId: string, message: string): void {
  if (!condition) throw new Error(`FAIL [${accId}]: ${message}`);
}

export function assertVisible(element: HTMLElement | null, accId: string, elementName: string): void {
  if (!element) throw new Error(`FAIL [${accId}]: ${elementName} 元素未找到`);
  if (element.style.display === 'none' || element.style.visibility === 'hidden')
    throw new Error(`FAIL [${accId}]: ${elementName} 元素存在但不可见`);
}

export function assertContainsText(element: HTMLElement | null, accId: string, expectedText: string): void {
  if (!element) throw new Error(`FAIL [${accId}]: 元素未找到，无法检查文本「${expectedText}」`);
  const actual = element.textContent || '';
  if (!actual.includes(expectedText))
    throw new Error(`FAIL [${accId}]: 期望包含文本「${expectedText}」，实际为「${actual}」`);
}
