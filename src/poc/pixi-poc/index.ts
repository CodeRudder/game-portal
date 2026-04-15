export { default as PixiPOC } from './PixiPOC';

/**
 * Route registration info for integrating into the app router.
 *
 * Usage in App.tsx:
 * ```tsx
 * import { PixiPOC } from './poc/pixi-poc';
 * // Add inside <Routes>:
 * <Route path="/poc/pixi" element={<PixiPOC />} />
 * ```
 */
export const pixiPocRoute = {
  path: '/poc/pixi',
  component: 'PixiPOC',
  description: 'PixiJS v8 + React + GSAP POC 验证页面',
} as const;
