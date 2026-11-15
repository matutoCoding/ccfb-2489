import { VolumeDims } from '../types';

export interface SegyProgress {
  phase: 'header' | 'traces' | 'normalize' | 'done';
  bytesRead: number;
  totalBytes: number;
  tracesRead: number;
  totalTraces: number;
  message: string;
}

export interface SegyResult {
  dims: VolumeDims;
  data: Float32Array; // 归一化 [-1,1]
  minVal: number;
  maxVal: number;
  sampleIntervalUs: number;
  formatCode: number;
  textHeader: string;
}

/** IBM 浮点 → IEEE */
function ibmToFloat(b1: number, b2: number, b3: number, b4: number): number {
  if (b1 === 0 && b2 === 0 && b3 === 0 && b4 === 0) return 0;
  const sign = (b1 & 0x80) ? -1 : 1;
  const exponent = (b1 & 0x7f) - 64; // 16 的幂
  const mantissa = ((b2 << 16) | (b3 << 8) | b4) / 0x1000000;
  return sign * mantissa * Math.pow(16, exponent);
}

const FORMAT_BYTES: Record<number, number> = { 1: 4, 2: 4, 3: 2, 5: 4, 6: 8, 8: 1 };

async function readSlice(file: Blob, start: number, end: number): Promise<ArrayBuffer> {
  return file.slice(start, Math.min(end, file.size)).arrayBuffer();
}

/**
 * 分块解析 SEG-Y 文件。
 * @param file      本地文件
 * @param onProgress 进度回调
 * @param chunkMB   每块读取大小(MB)
 */
export async function parseSegy(
  file: Blob,
  onProgress?: (p: SegyProgress) => void,
  chunkMB = 16,
): Promise<SegyResult> {
  const totalBytes = file.size;
  if (totalBytes < 3600) throw new Error('文件太小,不是有效的 SEG-Y(小于 3600 字节文件头)');

  const report = (p: Partial<SegyProgress>) => onProgress?.({
    phase: 'traces', bytesRead: 0, totalBytes, tracesRead: 0, totalTraces: 0, message: '', ...p,
  } as SegyProgress);

  // ---- 文件头 ----
  report({ phase: 'header', message: '读取文件头…' });
  const headBuf = await readSlice(file, 0, 3600);
  const hd = new DataView(headBuf);
  // 文本头(尝试按 ASCII 显示,EBCDIC 会显示为乱码但不影响解析)
  let textHeader = '';
  const h8 = new Uint8Array(headBuf, 0, 3200);
  for (let i = 0; i < 3200; i++) {
    const c = h8[i];
    textHeader += (c >= 32 && c < 127) ? String.fromCharCode(c) : ' ';
  }

  const ns = hd.getUint16(3220, false);
  const sampleIntervalUs = hd.getUint16(3216, false);
  const formatCode = hd.getUint16(3224, false);
  const bytesPerSample = FORMAT_BYTES[formatCode];
  if (!ns || ns <= 0) throw new Error(`二进制头中每道采样点数无效: ${ns}`);
  if (!bytesPerSample) throw new Error(`不支持的数据格式码: ${formatCode}(支持 1/2/3/5/6/8)`);

  const traceBytes = 240 + ns * bytesPerSample;
  const totalTraces = Math.floor((totalBytes - 3600) / traceBytes);
  if (totalTraces <= 0) throw new Error('文件中没有完整的地震道');

  // ---- 第一遍:扫描道头确定工区几何(inline/crossline 范围) ----
  report({ phase: 'header', message: `扫描 ${totalTraces} 道的道头,确定几何…` });
  const inlArr = new Int32Array(totalTraces);
  const xlnArr = new Int32Array(totalTraces);
  let minInl = Infinity, maxInl = -Infinity, minXln = Infinity, maxXln = -Infinity;
  {
    // 道头只需每道前 240 字节,但跨块读取简单起见按整块读
    const chunkBytes = Math.max(traceBytes, Math.floor(chunkMB * 1024 * 1024 / traceBytes) * traceBytes);
    let t = 0;
    for (let start = 3600; start < totalBytes && t < totalTraces; start += chunkBytes) {
      const buf = await readSlice(file, start, start + chunkBytes);
      const dv = new DataView(buf);
      const nInChunk = Math.min(Math.floor(buf.byteLength / traceBytes), totalTraces - t);
      for (let i = 0; i < nInChunk; i++, t++) {
        const off = i * traceBytes;
        const inl = dv.getInt32(off + 188, false);
        const xln = dv.getInt32(off + 192, false);
        inlArr[t] = inl; xlnArr[t] = xln;
        if (inl < minInl) minInl = inl; if (inl > maxInl) maxInl = inl;
        if (xln < minXln) minXln = xln; if (xln > maxXln) maxXln = xln;
      }
      report({
        phase: 'header', bytesRead: start - 3600, tracesRead: t, totalTraces,
        message: `扫描道头 ${t}/${totalTraces}`,
      });
      await new Promise(r => setTimeout(r, 0)); // 让出主线程刷新 UI
    }
  }

  // 几何:若道头 inline/xline 全为 0,退化为按顺序填充的方阵
  let nx: number, ny: number, useHeaders: boolean;
  if (minInl === 0 && maxInl === 0 && minXln === 0 && maxXln === 0) {
    useHeaders = false;
    nx = Math.ceil(Math.sqrt(totalTraces));
    ny = Math.ceil(totalTraces / nx);
  } else {
    useHeaders = true;
    nx = maxInl - minInl + 1;
    ny = maxXln - minXln + 1;
    if (nx * ny > totalTraces * 4) throw new Error(`道头几何异常: ${nx}×${ny} 网格 vs ${totalTraces} 道`);
  }
  const nz = ns;
  const dims: VolumeDims = { nx, ny, nz };

  // ---- 第二遍:读取采样数据 ----
  const raw = new Float32Array(nx * ny * nz);
  raw.fill(NaN);
  let minVal = Infinity, maxVal = -Infinity;
  const chunkBytes2 = Math.max(traceBytes, Math.floor(chunkMB * 1024 * 1024 / traceBytes) * traceBytes);
  let t = 0;
  for (let start = 3600; start < totalBytes && t < totalTraces; start += chunkBytes2) {
    const buf = await readSlice(file, start, start + chunkBytes2);
    const dv = new DataView(buf);
    const nInChunk = Math.min(Math.floor(buf.byteLength / traceBytes), totalTraces - t);
    for (let i = 0; i < nInChunk; i++, t++) {
      const off = i * traceBytes;
      let x: number, y: number;
      if (useHeaders) {
        x = inlArr[t] - minInl; y = xlnArr[t] - minXln;
        if (x < 0 || x >= nx || y < 0 || y >= ny) continue;
      } else {
        x = t % nx; y = Math.floor(t / nx) % ny;
      }
      const colBase = x + nx * y;
      const zStride = nx * ny;
      let p = off + 240;
      for (let z = 0; z < nz; z++) {
        let v: number;
        switch (formatCode) {
          case 1: v = ibmToFloat(dv.getUint8(p), dv.getUint8(p + 1), dv.getUint8(p + 2), dv.getUint8(p + 3)); break;
          case 2: v = dv.getInt32(p, false); break;
          case 3: v = dv.getInt16(p, false); break;
          case 5: v = dv.getFloat32(p, false); break;
          case 6: v = dv.getFloat64(p, false); break;
          default: v = dv.getInt8(p); break;
        }
        p += bytesPerSample;
        const idx = colBase + zStride * z;
        raw[idx] = v;
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    }
    report({
      phase: 'traces', bytesRead: start - 3600, tracesRead: t, totalTraces,
      message: `读取道数据 ${t}/${totalTraces}(${(100 * t / totalTraces).toFixed(1)}%)`,
    });
    await new Promise(r => setTimeout(r, 0));
  }

  // ---- 归一化到 [-1,1],缺失道填 0 ----
  report({ phase: 'normalize', message: '归一化数据…' });
  const scale = Math.max(Math.abs(minVal), Math.abs(maxVal)) || 1;
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    raw[i] = Number.isNaN(v) ? 0 : v / scale;
  }
  report({ phase: 'done', bytesRead: totalBytes, tracesRead: totalTraces, totalTraces, message: '完成' });

  return { dims, data: raw, minVal, maxVal, sampleIntervalUs, formatCode, textHeader };
}
