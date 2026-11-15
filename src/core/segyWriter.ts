import { VolumeDims } from '../types';

/**
 * 把数据体写成标准 SEG-Y(rev 0,IEEE float32 = 格式码 5,大端)。
 * 用于生成测试文件,验证导入链路。
 */
export function writeSegy(dims: VolumeDims, data: Float32Array, sampleIntervalUs = 2000): ArrayBuffer {
  const { nx, ny, nz } = dims;
  const nTraces = nx * ny;
  const traceDataBytes = nz * 4;
  const total = 3600 + nTraces * (240 + traceDataBytes);
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);

  // --- 3200 字节文本文件头(EBCDIC 通常,这里写 ASCII 空格填充 + 说明) ---
  u8.fill(0x20, 0, 3200);
  const lines = [
    'C 1 SYNTHETIC SEISMIC VOLUME - SEISMIC STUDIO TEST DATA',
    'C 2 TILTED LAYERS + ONE FAULT, RICKER WAVELET',
    `C 3 INLINE ${nx}  XLINE ${ny}  SAMPLES ${nz}`,
    'C 4 FORMAT: IEEE FLOATING POINT, 4 BYTE (CODE 5)',
    'C 5 GENERATED LOCALLY, NO REAL SURVEY DATA',
  ];
  lines.forEach((ln, i) => {
    const off = i * 80;
    for (let c = 0; c < Math.min(80, ln.length); c++) u8[off + c] = ln.charCodeAt(c);
  });

  // --- 400 字节二进制文件头(大端) ---
  dv.setInt32(3200, 1, false);                 // job id
  dv.setInt32(3204, 1, false);                 // line number
  dv.setUint16(3216, sampleIntervalUs, false); // 采样间隔 µs
  dv.setUint16(3220, nz, false);               // 每道采样点数
  dv.setUint16(3224, 5, false);                // 数据格式码 5 = IEEE float32
  dv.setUint16(3228, 1, false);                // 测量系统:米
  dv.setInt16(3254, 0x0100, false);            // SEG-Y rev 1.0

  // --- 道 ---
  let off = 3600;
  let tracl = 1;
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      // 240 字节道头
      dv.setInt32(off + 0, tracl, false);        // 测线内道顺序号
      dv.setInt32(off + 8, x + 1, false);        // 野外记录道号(备用)
      dv.setInt32(off + 188, x + 1, false);      // inline 号(字节 189-192)
      dv.setInt32(off + 192, y + 1, false);      // crossline 号(字节 193-196)
      dv.setUint16(off + 114, nz, false);        // 本道采样点数
      dv.setUint16(off + 116, sampleIntervalUs, false);
      dv.setInt16(off + 180, x * 25, false);     // 源点 X(示意坐标)
      dv.setInt16(off + 184, y * 25, false);
      // 采样数据(IEEE float32 大端)
      let p = off + 240;
      const base = x + nx * y; // z 层偏移步长 nx*ny
      for (let z = 0; z < nz; z++) {
        dv.setFloat32(p, data[base + nx * ny * z], false);
        p += 4;
      }
      off += 240 + traceDataBytes;
      tracl++;
    }
  }
  return buf;
}
