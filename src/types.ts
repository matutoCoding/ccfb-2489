/** 全局共享类型 */

export interface VolumeDims { nx: number; ny: number; nz: number; }

export interface Project {
  id: string;
  name: string;
  created: number;
  dims: VolumeDims;
  /** 原始数据最小/最大值(归一化前) */
  minVal: number;
  maxVal: number;
  sampleIntervalUs?: number;
  source: 'demo' | 'segy';
  /** 数据体总字节数 */
  byteSize: number;
}

export interface VolumeData {
  projectId: string;
  dims: VolumeDims;
  /** 归一化到 [-1,1] 的振幅,布局: x 最快, z 最慢 → idx = x + nx*(y + ny*z) */
  data: Float32Array;
}

export interface Horizon {
  id: string;
  projectId: string;
  name: string;
  color: string;
  /** nx*ny 网格,每个 (inline=x, crossline=y) 位置一个 z(采样点索引),NaN = 未拾取 */
  grid: Float32Array;
  updated: number;
}

export interface ColormapStop { t: number; color: [number, number, number]; } // t∈[0,1], rgb∈[0,1]
export interface Colormap {
  id: string;
  name: string;
  builtin?: boolean;
  stops: ColormapStop[];
}

/** 传递函数:不透明度曲线控制点 */
export interface OpacityPoint { t: number; o: number; } // t∈[0,1] 振幅位置, o∈[0,1] 不透明度

export interface ViewerSettings {
  colormapId: string;
  opacity: OpacityPoint[];
  isoValue: number;      // [-1,1]
  isoEnabled: boolean;
  isoOpacity: number;
  sliceX: number; sliceY: number; sliceZ: number; // [0,1] 归一化位置
  sliceXOn: boolean; sliceYOn: boolean; sliceZOn: boolean;
  arbOn: boolean;
  arbNormal: [number, number, number];
  arbOffset: number; // [-1,1] 沿法向偏移
  lighting: boolean;
  steps: number;
}

export const DEFAULT_VIEWER_SETTINGS: ViewerSettings = {
  colormapId: 'seismic-bwr',
  opacity: [
    { t: 0.0, o: 0.0 }, { t: 0.35, o: 0.05 }, { t: 0.5, o: 0.0 },
    { t: 0.65, o: 0.05 }, { t: 1.0, o: 0.9 },
  ],
  isoValue: 0.45,
  isoEnabled: false,
  isoOpacity: 0.85,
  sliceX: 0.5, sliceY: 0.5, sliceZ: 0.5,
  sliceXOn: false, sliceYOn: false, sliceZOn: true,
  arbOn: false,
  arbNormal: [0.577, 0.577, 0.577],
  arbOffset: 0,
  lighting: true,
  steps: 320,
};

export function uid(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

export function volIndex(dims: VolumeDims, x: number, y: number, z: number): number {
  return x + dims.nx * (y + dims.ny * z);
}
