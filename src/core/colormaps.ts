import { Colormap, ColormapStop, OpacityPoint } from '../types';

const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const s = (t: number, c: string): ColormapStop => ({ t, color: hex(c) });

/** 内置地震常用色标 */
export const BUILTIN_COLORMAPS: Colormap[] = [
  {
    id: 'seismic-bwr', name: '地震 蓝-白-红', builtin: true,
    stops: [s(0, '#0b2d8f'), s(0.25, '#3f7de0'), s(0.5, '#f5f5f5'), s(0.75, '#e0523f'), s(1, '#8f0b0b')],
  },
  {
    id: 'seismic-rwb', name: '地震 红-白-蓝(反)', builtin: true,
    stops: [s(0, '#8f0b0b'), s(0.25, '#e0523f'), s(0.5, '#f5f5f5'), s(0.75, '#3f7de0'), s(1, '#0b2d8f')],
  },
  {
    id: 'seismic-bkwr', name: '地震 黑-白-红', builtin: true,
    stops: [s(0, '#101010'), s(0.35, '#5a5a5a'), s(0.5, '#ffffff'), s(0.7, '#ff4d2e'), s(1, '#7a0000')],
  },
  {
    id: 'gray', name: '灰度', builtin: true,
    stops: [s(0, '#000000'), s(1, '#ffffff')],
  },
  {
    id: 'viridis', name: 'Viridis', builtin: true,
    stops: [s(0, '#440154'), s(0.25, '#3b528b'), s(0.5, '#21918c'), s(0.75, '#5ec962'), s(1, '#fde725')],
  },
  {
    id: 'rainbow', name: '彩虹', builtin: true,
    stops: [s(0, '#0000ff'), s(0.25, '#00ffff'), s(0.5, '#00ff00'), s(0.75, '#ffff00'), s(1, '#ff0000')],
  },
  {
    id: 'hot', name: '热铁', builtin: true,
    stops: [s(0, '#000000'), s(0.35, '#b00000'), s(0.7, '#ffb000'), s(1, '#ffffff')],
  },
  {
    id: 'spectrum-strata', name: '地层(陆相)', builtin: true,
    stops: [s(0, '#1a0f4a'), s(0.2, '#2e5fa3'), s(0.4, '#3fa08f'), s(0.55, '#c8c86a'), s(0.75, '#c8863a'), s(1, '#7a2e12')],
  },
];

const LS_KEY = 'seismic-studio.custom-colormaps';
const LS_ACTIVE = 'seismic-studio.active-colormap';

export function loadCustomColormaps(): Colormap[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveCustomColormap(cm: Colormap): void {
  const all = loadCustomColormaps().filter(c => c.id !== cm.id);
  all.push({ ...cm, builtin: false });
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}

export function deleteCustomColormap(id: string): void {
  localStorage.setItem(LS_KEY, JSON.stringify(loadCustomColormaps().filter(c => c.id !== id)));
}

export function allColormaps(): Colormap[] {
  return [...BUILTIN_COLORMAPS, ...loadCustomColormaps()];
}

export function getColormap(id: string): Colormap {
  return allColormaps().find(c => c.id === id) ?? BUILTIN_COLORMAPS[0];
}

export function getActiveColormapId(): string {
  return localStorage.getItem(LS_ACTIVE) || 'seismic-bwr';
}
export function setActiveColormapId(id: string): void {
  localStorage.setItem(LS_ACTIVE, id);
}

/** 采样色标 → 256×1 RGBA 查找表(alpha 由不透明度曲线给出) */
export function buildLut(cm: Colormap, opacity: OpacityPoint[], size = 256): Uint8Array {
  const lut = new Uint8Array(size * 4);
  const stops = [...cm.stops].sort((a, b) => a.t - b.t);
  const ops = [...opacity].sort((a, b) => a.t - b.t);

  const sampleStops = (t: number): [number, number, number] => {
    if (t <= stops[0].t) return stops[0].color;
    if (t >= stops[stops.length - 1].t) return stops[stops.length - 1].color;
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i].t && t <= stops[i + 1].t) {
        const f = (t - stops[i].t) / Math.max(1e-6, stops[i + 1].t - stops[i].t);
        return [
          stops[i].color[0] + f * (stops[i + 1].color[0] - stops[i].color[0]),
          stops[i].color[1] + f * (stops[i + 1].color[1] - stops[i].color[1]),
          stops[i].color[2] + f * (stops[i + 1].color[2] - stops[i].color[2]),
        ];
      }
    }
    return stops[0].color;
  };
  const sampleOpacity = (t: number): number => {
    if (ops.length === 0) return 1;
    if (t <= ops[0].t) return ops[0].o;
    if (t >= ops[ops.length - 1].t) return ops[ops.length - 1].o;
    for (let i = 0; i < ops.length - 1; i++) {
      if (t >= ops[i].t && t <= ops[i + 1].t) {
        const f = (t - ops[i].t) / Math.max(1e-6, ops[i + 1].t - ops[i].t);
        return ops[i].o + f * (ops[i + 1].o - ops[i].o);
      }
    }
    return 1;
  };

  for (let i = 0; i < size; i++) {
    const t = i / (size - 1);
    const [r, g, b] = sampleStops(t);
    lut[i * 4 + 0] = Math.round(r * 255);
    lut[i * 4 + 1] = Math.round(g * 255);
    lut[i * 4 + 2] = Math.round(b * 255);
    lut[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, sampleOpacity(t))) * 255);
  }
  return lut;
}

/** 色标 CSS 渐变字符串(用于 UI 预览) */
export function colormapCss(cm: Colormap): string {
  const stops = [...cm.stops].sort((a, b) => a.t - b.t)
    .map(st => `rgb(${Math.round(st.color[0] * 255)},${Math.round(st.color[1] * 255)},${Math.round(st.color[2] * 255)}) ${(st.t * 100).toFixed(1)}%`);
  return `linear-gradient(to right, ${stops.join(', ')})`;
}
