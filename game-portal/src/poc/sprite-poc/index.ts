export { default as SpritePOC } from './SpritePOC';

/**
 * Route registration info for integrating into the app router.
 *
 * Usage in App.tsx:
 * ```tsx
 * import { SpritePOC } from './poc/sprite-poc';
 * // Add inside <Routes>:
 * <Route path="/poc/sprite-demo" element={<SpritePOC />} />
 * ```
 */
export const spritePocRoute = {
  path: '/poc/sprite-demo',
  component: 'SpritePOC',
  description: 'Kenney Tower Defense 精灵渲染 POC — PixiJS v8 + GSAP',
} as const;
