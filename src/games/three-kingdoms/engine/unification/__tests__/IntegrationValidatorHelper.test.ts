/**
 * IntegrationValidatorHelper 单元测试
 *
 * 覆盖：
 * 1. makeStep — 创建检查步骤
 */

import { makeStep } from '../IntegrationValidatorHelper';

describe('IntegrationValidatorHelper', () => {
  describe('makeStep', () => {
    it('检查通过应返回 passed=true', () => {
      const step = makeStep('step_1', '检查A', () => true, 'Error');
      expect(step.stepId).toBe('step_1');
      expect(step.description).toBe('检查A');
      expect(step.passed).toBe(true);
      expect(step.error).toBeUndefined();
      expect(step.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('检查失败应返回 passed=false 和错误信息', () => {
      const step = makeStep('step_2', '检查B', () => false, 'PREFIX');
      expect(step.passed).toBe(false);
      expect(step.error).toContain('PREFIX');
    });

    it('检查抛异常应捕获错误', () => {
      const step = makeStep('step_3', '检查C', () => {
        throw new Error('boom');
      }, 'PREFIX');
      expect(step.passed).toBe(false);
      expect(step.error).toContain('boom');
    });

    it('非 Error 异常应转为字符串', () => {
      const step = makeStep('step_4', '检查D', () => {
        throw 'string error';
      }, 'PREFIX');
      expect(step.passed).toBe(false);
      expect(step.error).toContain('string error');
    });
  });
});
