/**
 * 独立地图编辑器入口
 *
 * 启动方式: npx vite --config vite-map-editor.config.ts
 * 或: npx vite map-editor.html
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { MapEditorStandalone } from './components/idle/panels/map/editor/MapEditorStandalone';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <MapEditorStandalone />
  </React.StrictMode>
);
