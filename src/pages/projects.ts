import { listProjects, putProject, putVolume, deleteProjectCascade, ProjectRow } from '../core/db';
import { generateSynthetic } from '../core/synthetic';
import { writeSegy } from '../core/segyWriter';
import { parseSegy } from '../core/segy';
import { uid } from '../types';
import { openProject } from '../core/session';
import { toast, downloadBlob, fmtBytes } from '../ui';

export async function renderProjects(root: HTMLElement): Promise<() => void> {
  root.innerHTML = `
    <div class="page">
      <h2>工区列表</h2>
      <div class="grid2">
        <div class="card">
          <h3>新建演示工区</h3>
          <p class="muted">本地生成合成地震数据体:多层倾斜地层 + 一条断层,Ricker 子波,含噪声。</p>
          <div class="row"><label>尺寸</label>
            <select id="demo-size">
              <option value="128,128,96" selected>128 × 128 × 96(推荐)</option>
              <option value="192,192,128">192 × 192 × 128</option>
              <option value="256,256,160">256 × 256 × 160</option>
              <option value="96,96,64">96 × 96 × 64(低配)</option>
            </select>
          </div>
          <div class="row"><label>名称</label><input id="demo-name" value="演示工区" /></div>
          <div class="row">
            <button class="primary" id="btn-demo">生成并入库</button>
            <button id="btn-dl-segy">下载测试 SEG-Y 文件</button>
          </div>
          <div class="progress-wrap" style="display:none"><div class="progress-bar"></div></div>
          <div class="progress-text"></div>
        </div>
        <div class="card">
          <h3>导入 SEG-Y</h3>
          <p class="muted">本地解析,分块读取(16 MB/块),支持格式码 1/2/3/5/6/8(IBM 浮点 / IEEE / 整型)。文件不离开浏览器。</p>
          <input type="file" id="segy-file" accept=".sgy,.segy,.SGY,.SEGY" />
          <div class="row"><label>名称</label><input id="segy-name" placeholder="默认取文件名" /></div>
          <button class="primary" id="btn-import" disabled>开始导入</button>
          <div class="progress-wrap" style="display:none"><div class="progress-bar"></div></div>
          <div class="progress-text"></div>
        </div>
      </div>
      <h3>已有工区</h3>
      <div class="card" style="padding:0">
        <table class="list">
          <thead><tr>
            <th>名称</th><th>尺寸 (inline×xline×samples)</th><th>来源</th><th>数据量</th><th>创建时间</th><th>操作</th>
          </tr></thead>
          <tbody id="proj-tbody"></tbody>
        </table>
      </div>
    </div>`;

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  let disposed = false;

  async function refreshList() {
    const projects = (await listProjects()).sort((a, b) => b.created - a.created);
    const tbody = $<HTMLTableSectionElement>('#proj-tbody');
    tbody.innerHTML = projects.length === 0
      ? `<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">还没有工区,先生成一个演示工区或导入 SEG-Y</td></tr>`
      : '';
    for (const p of projects) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${esc(p.name)}</td>
        <td>${p.dims.nx} × ${p.dims.ny} × ${p.dims.nz}</td>
        <td>${p.source === 'demo' ? '演示数据' : 'SEG-Y 导入'}</td>
        <td>${fmtBytes(p.byteSize)}</td>
        <td>${new Date(p.created).toLocaleString()}</td>
        <td></td>`;
      const ops = tr.lastElementChild!;
      const mkBtn = (txt: string, cls = '') => {
        const b = document.createElement('button');
        b.textContent = txt; b.className = cls;
        b.style.marginRight = '6px'; b.style.padding = '3px 10px';
        ops.appendChild(b);
        return b;
      };
      mkBtn('浏览', 'primary').onclick = async () => { await openProject(p.id); location.hash = '#/viewer'; };
      mkBtn('层位解释').onclick = async () => { await openProject(p.id); location.hash = '#/horizon'; };
      mkBtn('导出').onclick = async () => { await openProject(p.id); location.hash = '#/export'; };
      mkBtn('删除', 'danger').onclick = async () => {
        if (!confirm(`删除工区「${p.name}」及其全部层位?`)) return;
        await deleteProjectCascade(p.id);
        toast('已删除');
        refreshList();
      };
      tbody.appendChild(tr);
    }
  }

  // ---- 演示工区 ----
  $('#btn-demo').onclick = async () => {
    const [nx, ny, nz] = ($<HTMLSelectElement>('#demo-size').value.split(',').map(Number));
    const name = ($<HTMLInputElement>('#demo-name').value || '演示工区').trim();
    const bar = root.querySelectorAll<HTMLElement>('.progress-wrap')[0];
    const barInner = bar.querySelector<HTMLElement>('.progress-bar')!;
    const text = root.querySelectorAll<HTMLElement>('.progress-text')[0];
    bar.style.display = 'block';
    text.textContent = '生成合成数据体…';
    barInner.style.width = '30%';
    await new Promise(r => setTimeout(r, 30));
    const { dims, data } = generateSynthetic({ nx, ny, nz });
    barInner.style.width = '70%';
    text.textContent = '写入 IndexedDB…';
    await new Promise(r => setTimeout(r, 30));
    const id = uid();
    const row: ProjectRow = {
      id, name, created: Date.now(), dims,
      minVal: -1, maxVal: 1, source: 'demo',
      byteSize: data.byteLength,
    };
    await putProject(row);
    await putVolume({ projectId: id, dims, buffer: data.buffer as ArrayBuffer });
    barInner.style.width = '100%';
    text.textContent = '完成';
    if (!disposed) { toast(`工区「${name}」已创建`); refreshList(); }
  };

  // ---- 测试 SEG-Y 下载 ----
  $('#btn-dl-segy').onclick = () => {
    const { dims, data } = generateSynthetic({ nx: 96, ny: 96, nz: 80, seed: 777 });
    const buf = writeSegy(dims, data);
    downloadBlob(new Blob([buf], { type: 'application/octet-stream' }), 'synthetic_test.sgy');
    toast('测试 SEG-Y 已下载,可用「导入 SEG-Y」验证解析链路');
  };

  // ---- SEG-Y 导入 ----
  let segyFile: File | null = null;
  const fileInput = $<HTMLInputElement>('#segy-file');
  fileInput.onchange = () => {
    segyFile = fileInput.files?.[0] ?? null;
    $<HTMLButtonElement>('#btn-import').disabled = !segyFile;
    if (segyFile && !$<HTMLInputElement>('#segy-name').value) {
      $<HTMLInputElement>('#segy-name').value = segyFile.name.replace(/\.(sgy|segy)$/i, '');
    }
  };
  $('#btn-import').onclick = async () => {
    if (!segyFile) return;
    const bar = root.querySelectorAll<HTMLElement>('.progress-wrap')[1];
    const barInner = bar.querySelector<HTMLElement>('.progress-bar')!;
    const text = root.querySelectorAll<HTMLElement>('.progress-text')[1];
    bar.style.display = 'block';
    try {
      const result = await parseSegy(segyFile, p => {
        const pct = p.totalTraces ? (p.tracesRead / p.totalTraces) : 0;
        barInner.style.width = `${(pct * 100).toFixed(1)}%`;
        text.textContent = `${p.message} — ${fmtBytes(p.bytesRead)} / ${fmtBytes(p.totalBytes)}`;
      });
      const id = uid();
      const name = ($<HTMLInputElement>('#segy-name').value || segyFile.name).trim();
      await putProject({
        id, name, created: Date.now(), dims: result.dims,
        minVal: result.minVal, maxVal: result.maxVal,
        sampleIntervalUs: result.sampleIntervalUs,
        source: 'segy', byteSize: result.data.byteLength,
      });
      await putVolume({ projectId: id, dims: result.dims, buffer: result.data.buffer as ArrayBuffer });
      text.textContent = `完成:${result.dims.nx}×${result.dims.ny}×${result.dims.nz}`;
      toast(`工区「${name}」导入完成`);
      refreshList();
    } catch (err) {
      text.textContent = `导入失败:${err instanceof Error ? err.message : String(err)}`;
      text.style.color = 'var(--err)';
    }
  };

  await refreshList();
  return () => { disposed = true; };
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
