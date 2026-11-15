import { openLastProject } from '../core/session';
import { listHorizons, HorizonRow } from '../core/db';
import { buildLut, getColormap } from '../core/colormaps';
import { VolumeRenderer } from '../gl/VolumeRenderer';
import { toast, downloadBlob, fmtBytes } from '../ui';

export async function renderExportPage(root: HTMLElement): Promise<() => void> {
  const session = await openLastProject();
  if (!session) {
    location.hash = '#/projects';
    return () => {};
  }
  const { dims, project } = session;

  root.innerHTML = `
    <div class="page">
      <h2>导出 — ${project.name}</h2>
      <div class="grid2">
        <div class="card">
          <h3>截图</h3>
          <div style="position:relative;background:#000;border-radius:8px;overflow:hidden;height:320px">
            <canvas id="shot-canvas" style="width:100%;height:100%;display:block"></canvas>
          </div>
          <div class="muted" style="margin:6px 0">拖动调整视角后点击导出(全分辨率渲染)</div>
          <button class="primary" id="btn-shot">导出截图 PNG</button>
        </div>
        <div class="card">
          <h3>层位 CSV</h3>
          <p class="muted">列:inline, crossline, z_sample, twt_ms, x_m, y_m(坐标按 25 m 道距推算)</p>
          <div id="hz-export-list"></div>
          <button id="btn-export-all" style="margin-top:8px">全部层位打包导出</button>
          <h3 style="margin-top:18px">工区信息</h3>
          <table class="list">
            <tr><td>尺寸</td><td>${dims.nx} × ${dims.ny} × ${dims.nz}</td></tr>
            <tr><td>数据量</td><td>${fmtBytes(project.byteSize)}</td></tr>
            <tr><td>采样间隔</td><td>${project.sampleIntervalUs ? (project.sampleIntervalUs / 1000) + ' ms' : '2 ms(默认)'}</td></tr>
            <tr><td>振幅范围</td><td>[${project.minVal.toExponential(2)}, ${project.maxVal.toExponential(2)}]</td></tr>
          </table>
        </div>
      </div>
    </div>`;

  const $ = <T extends HTMLElement>(q: string) => root.querySelector(q) as T;

  // ---- 3D 预览 ----
  const canvas = $<HTMLCanvasElement>('#shot-canvas');
  const renderer = new VolumeRenderer(canvas);
  renderer.settings = session.settings;
  renderer.setVolume(dims, session.data);
  renderer.setLut(buildLut(getColormap(session.settings.colormapId), session.settings.opacity));
  renderer.start();

  $('#btn-shot').onclick = async () => {
    const blob = await renderer.screenshot();
    if (blob) {
      downloadBlob(blob, `${project.name}_screenshot.png`);
      toast('截图已导出');
    }
  };

  // ---- 层位 CSV ----
  const horizons: HorizonRow[] = await listHorizons(project.id);
  const dtMs = (project.sampleIntervalUs ?? 2000) / 1000;

  function horizonCsv(h: HorizonRow): string {
    const grid = new Float32Array(h.buffer);
    const lines = ['inline,crossline,z_sample,twt_ms,x_m,y_m'];
    for (let y = 0; y < dims.ny; y++) {
      for (let x = 0; x < dims.nx; x++) {
        const z = grid[x + dims.nx * y];
        if (Number.isNaN(z)) continue;
        lines.push(`${x + 1},${y + 1},${z.toFixed(2)},${(z * dtMs).toFixed(2)},${x * 25},${y * 25}`);
      }
    }
    return lines.join('\n');
  }

  const listEl = $('#hz-export-list');
  if (horizons.length === 0) {
    listEl.innerHTML = '<div class="muted">该工区还没有层位,去「层位解释」页拾取</div>';
    $<HTMLButtonElement>('#btn-export-all').disabled = true;
  } else {
    for (const h of horizons) {
      const grid = new Float32Array(h.buffer);
      let cnt = 0;
      for (let i = 0; i < grid.length; i++) if (!Number.isNaN(grid[i])) cnt++;
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${h.color}"></span>
        <span style="flex:1;font-size:13px">${h.name}(${cnt.toLocaleString()} 点)</span>`;
      const btn = document.createElement('button');
      btn.textContent = '下载 CSV';
      btn.onclick = () => {
        downloadBlob(new Blob([horizonCsv(h)], { type: 'text/csv' }), `${project.name}_${h.name}.csv`);
        toast(`层位「${h.name}」已导出`);
      };
      row.appendChild(btn);
      listEl.appendChild(row);
    }
    $('#btn-export-all').onclick = () => {
      for (const h of horizons) {
        downloadBlob(new Blob([horizonCsv(h)], { type: 'text/csv' }), `${project.name}_${h.name}.csv`);
      }
      toast(`已导出 ${horizons.length} 个层位`);
    };
  }

  return () => { renderer.destroy(); };
}
