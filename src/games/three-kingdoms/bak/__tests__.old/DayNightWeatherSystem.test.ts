/**
 * DayNightWeatherSystem 单元测试
 */
import { describe, it, expect } from 'vitest';
import {
  DayNightWeatherSystem,
  type TimeOfDay,
  type WeatherType,
} from '../DayNightWeatherSystem';

describe('DayNightWeatherSystem', () => {
  const system = new DayNightWeatherSystem();

  // ── 1. 时段判断 ──────────────────────────────────────────
  describe('getTimeOfDay', () => {
    const cases: [number, TimeOfDay][] = [
      [6, 'dawn'],
      [8, 'morning'],
      [12, 'noon'],
      [15, 'afternoon'],
      [18, 'dusk'],
      [20, 'night'],
      [3, 'night'],
      [0, 'night'],
    ];
    cases.forEach(([hour, expected]) => {
      it(`hour=${hour} → ${expected}`, () => {
        expect(system.getTimeOfDay(hour)).toBe(expected);
      });
    });
  });

  // ── 2. 环境色参数 ────────────────────────────────────────
  describe('getAmbientParams', () => {
    it('dawn (hour=6) → 浅橙 0xffa07a, alpha=0.15', () => {
      const params = system.getAmbientParams(6);
      expect(params.color).toBe(0xffa07a);
      expect(params.alpha).toBeCloseTo(0.15);
    });

    it('night (hour=21) → 暗蓝 0x191970, alpha=0.4', () => {
      const params = system.getAmbientParams(21);
      expect(params.color).toBe(0x191970);
      expect(params.alpha).toBeCloseTo(0.4);
    });

    it('noon (hour=12) → 白色 0xffffff, alpha=0', () => {
      const params = system.getAmbientParams(12);
      expect(params.color).toBe(0xffffff);
      expect(params.alpha).toBeCloseTo(0);
    });
  });

  // ── 3. 天气随机变化 ──────────────────────────────────────
  describe('updateWeather', () => {
    it('未超时保持当前天气', () => {
      const s = new DayNightWeatherSystem();
      const before = s.getState().weather;
      const after = s.updateWeather(1); // 只过 1 秒，不会触发变化
      expect(after).toBe(before);
    });
  });

  // ── 4. 天气粒子参数 ──────────────────────────────────────
  describe('getWeatherParticles', () => {
    it('clear 天气无粒子', () => {
      const s = new DayNightWeatherSystem();
      s.update(0, 12);
      const p = s.getWeatherParticles();
      expect(p.type).toBe('none');
      expect(p.count).toBe(0);
    });

    it('rain 天气有雨滴粒子', () => {
      const s = new DayNightWeatherSystem();
      // 强制序列化恢复 rain 天气
      s.deserialize({ weather: 'rain', weatherTimer: 0, weatherDuration: 600 });
      s.update(0, 12);
      const p = s.getWeatherParticles();
      expect(p.type).toBe('rain');
      expect(p.count).toBe(100);
      expect(p.speed).toBeGreaterThan(0);
    });
  });

  // ── 5. 时段描述 ──────────────────────────────────────────
  describe('getTimeDescription', () => {
    it('返回中文描述', () => {
      const s = new DayNightWeatherSystem();
      s.update(0, 6); // dawn
      expect(s.getTimeDescription()).toBe('黎明');
    });
  });

  // ── 6. 天气描述 ──────────────────────────────────────────
  describe('getWeatherDescription', () => {
    it('clear → 晴朗', () => {
      const s = new DayNightWeatherSystem();
      s.update(0, 12);
      expect(s.getWeatherDescription()).toBe('晴朗');
    });
  });

  // ── 7. 序列化 / 反序列化 ─────────────────────────────────
  describe('serialize / deserialize', () => {
    it('序列化后反序列化恢复状态', () => {
      const s1 = new DayNightWeatherSystem();
      s1.update(0, 21); // night
      s1.deserialize({
        weather: 'storm' as WeatherType,
        weatherTimer: 100,
        weatherDuration: 500,
      });
      s1.update(0, 21);

      const data = s1.serialize();
      const s2 = new DayNightWeatherSystem();
      s2.deserialize(data as Record<string, unknown>);

      expect(s2.getState().weather).toBe('storm');
      expect(s2.getState().hour).toBeCloseTo(21);
      expect(s2.getState().timeOfDay).toBe('night');
    });
  });
});
