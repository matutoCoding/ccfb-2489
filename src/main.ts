import './style.css';
import { renderProjects } from './pages/projects';
import { renderViewer } from './pages/viewer';
import { renderHorizonPage } from './pages/horizon';
import { renderColormapPage } from './pages/colormap';
import { renderExportPage } from './pages/export';
import { updateIndicator } from './core/session';

type Cleanup = () => void;
let cleanup: Cleanup | null = null;

const routes: Record<string, (root: HTMLElement) => Promise<Cleanup>> = {
  projects: renderProjects,
  viewer: renderViewer,
  horizon: renderHorizonPage,
  colormap: renderColormapPage,
  export: renderExportPage,
};

async function route() {
  const hash = location.hash.replace(/^#\/?/, '') || 'projects';
  const name = hash.split('/')[0];
  const page = routes[name] ?? renderProjects;

  // 清理上一页(停止渲染循环 / Worker)
  if (cleanup) { cleanup(); cleanup = null; }

  const app = document.getElementById('app')!;
  app.innerHTML = '';
  document.querySelectorAll('#nav a').forEach(a => {
    a.classList.toggle('active', (a as HTMLElement).dataset.route === name);
  });

  cleanup = await page(app);
  updateIndicator();
}

window.addEventListener('hashchange', route);
route();
