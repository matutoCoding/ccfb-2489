(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))n(s);new MutationObserver(s=>{for(const o of s)if(o.type==="childList")for(const r of o.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&n(r)}).observe(document,{childList:!0,subtree:!0});function t(s){const o={};return s.integrity&&(o.integrity=s.integrity),s.referrerPolicy&&(o.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?o.credentials="include":s.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function n(s){if(s.ep)return;s.ep=!0;const o=t(s);fetch(s.href,o)}})();const Yt="seismic-studio",Wt=1;let yt=null;function Mt(){return yt||(yt=new Promise((i,e)=>{const t=indexedDB.open(Yt,Wt);t.onupgradeneeded=()=>{const n=t.result;n.objectStoreNames.contains("projects")||n.createObjectStore("projects",{keyPath:"id"}),n.objectStoreNames.contains("volumes")||n.createObjectStore("volumes",{keyPath:"projectId"}),n.objectStoreNames.contains("horizons")||n.createObjectStore("horizons",{keyPath:"id"}).createIndex("projectId","projectId",{unique:!1})},t.onsuccess=()=>i(t.result),t.onerror=()=>e(t.error)})),yt}function st(i,e,t){return Mt().then(n=>new Promise((s,o)=>{const r=n.transaction(i,e),a=t(r.objectStore(i));a.onsuccess=()=>s(a.result),a.onerror=()=>o(a.error)}))}function qt(i,e,t){return Mt().then(n=>new Promise((s,o)=>{const r=n.transaction(i,e),a=t(r.objectStore(i)),l=new Array(a.length);let d=0;a.forEach((c,u)=>{c.onsuccess=()=>{l[u]=c.result,++d===a.length&&s(l)},c.onerror=()=>o(c.error)}),a.length===0&&s([])}))}const Tt=()=>st("projects","readonly",i=>i.getAll()),Pt=i=>st("projects","readwrite",e=>e.put(i)),Gt=i=>st("projects","readwrite",e=>e.delete(i)),It=i=>st("volumes","readwrite",e=>e.put(i)),Zt=i=>st("volumes","readonly",e=>e.get(i)),Kt=i=>st("volumes","readwrite",e=>e.delete(i)),Rt=i=>st("horizons","readwrite",e=>e.put(i)),Jt=i=>st("horizons","readwrite",e=>e.delete(i));async function bt(i){const e=await Mt();return new Promise((t,n)=>{const r=e.transaction("horizons","readonly").objectStore("horizons").index("projectId").getAll(i);r.onsuccess=()=>t(r.result),r.onerror=()=>n(r.error)})}async function Qt(i){const e=await bt(i);await qt("horizons","readwrite",t=>e.map(n=>t.delete(n.id))),await Kt(i),await Gt(i)}function te(i){let e=i>>>0;return()=>{e|=0,e=e+1831565813|0;let t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}function ee(i,e){const t=Math.PI*e*i;return(1-2*t*t)*Math.exp(-t*t)}function zt(i={}){const e=i.nx??128,t=i.ny??128,n=i.nz??96,s=i.nLayers??6,o=i.faultThrow??10,r=te(i.seed??20261115),a=[];for(let f=0;f<s;f++)a.push({z0:n*(.14+.72*(f/Math.max(1,s-1)))+(r()-.5)*n*.04,dipX:(r()-.5)*.22,dipY:(r()-.5)*.18,amp:(r()>.5?1:-1)*(.55+.45*r())});const l=e*.58,d=n*.5,c=.35,u=new Float32Array(e*t*n),b=.09;let x=1e-9;for(let f=0;f<n;f++){const g=f;for(let y=0;y<t;y++){let p=e*(y+t*f);for(let T=0;T<e;T++,p++){const B=T>l+(g-d)*c;let N=0;for(const V of a){let j=V.z0+V.dipX*(T-e/2)+V.dipY*(y-t/2);B&&(j+=o);const nt=1+.25*Math.sin(T*.11+V.z0)*Math.cos(y*.09);N+=V.amp*nt*ee(g-j,b)}N+=(r()-.5)*.08,u[p]=N;const R=Math.abs(N);R>x&&(x=R)}}}const m=1/x;for(let f=0;f<u.length;f++)u[f]*=m;return{dims:{nx:e,ny:t,nz:n},data:u}}function ne(i,e,t=2e3){const{nx:n,ny:s,nz:o}=i,r=n*s,a=o*4,l=3600+r*(240+a),d=new ArrayBuffer(l),c=new DataView(d),u=new Uint8Array(d);u.fill(32,0,3200),["C 1 SYNTHETIC SEISMIC VOLUME - SEISMIC STUDIO TEST DATA","C 2 TILTED LAYERS + ONE FAULT, RICKER WAVELET",`C 3 INLINE ${n}  XLINE ${s}  SAMPLES ${o}`,"C 4 FORMAT: IEEE FLOATING POINT, 4 BYTE (CODE 5)","C 5 GENERATED LOCALLY, NO REAL SURVEY DATA"].forEach((f,g)=>{const y=g*80;for(let p=0;p<Math.min(80,f.length);p++)u[y+p]=f.charCodeAt(p)}),c.setInt32(3200,1,!1),c.setInt32(3204,1,!1),c.setUint16(3216,t,!1),c.setUint16(3220,o,!1),c.setUint16(3224,5,!1),c.setUint16(3228,1,!1),c.setInt16(3254,256,!1);let x=3600,m=1;for(let f=0;f<s;f++)for(let g=0;g<n;g++){c.setInt32(x+0,m,!1),c.setInt32(x+8,g+1,!1),c.setInt32(x+188,g+1,!1),c.setInt32(x+192,f+1,!1),c.setUint16(x+114,o,!1),c.setUint16(x+116,t,!1),c.setInt16(x+180,g*25,!1),c.setInt16(x+184,f*25,!1);let y=x+240;const p=g+n*f;for(let T=0;T<o;T++)c.setFloat32(y,e[p+n*s*T],!1),y+=4;x+=240+a,m++}return d}function se(i,e,t,n){if(i===0&&e===0&&t===0&&n===0)return 0;const s=i&128?-1:1,o=(i&127)-64,r=(e<<16|t<<8|n)/16777216;return s*r*Math.pow(16,o)}const ie={1:4,2:4,3:2,5:4,6:8,8:1};async function wt(i,e,t){return i.slice(e,Math.min(t,i.size)).arrayBuffer()}async function oe(i,e,t=16){const n=i.size;if(n<3600)throw new Error("文件太小,不是有效的 SEG-Y(小于 3600 字节文件头)");const s=A=>e?.({phase:"traces",bytesRead:0,totalBytes:n,tracesRead:0,totalTraces:0,message:"",...A});s({phase:"header",message:"读取文件头…"});const o=await wt(i,0,3600),r=new DataView(o);let a="";const l=new Uint8Array(o,0,3200);for(let A=0;A<3200;A++){const w=l[A];a+=w>=32&&w<127?String.fromCharCode(w):" "}const d=r.getUint16(3220,!1),c=r.getUint16(3216,!1),u=r.getUint16(3224,!1),b=ie[u];if(!d||d<=0)throw new Error(`二进制头中每道采样点数无效: ${d}`);if(!b)throw new Error(`不支持的数据格式码: ${u}(支持 1/2/3/5/6/8)`);const x=240+d*b,m=Math.floor((n-3600)/x);if(m<=0)throw new Error("文件中没有完整的地震道");s({phase:"header",message:`扫描 ${m} 道的道头,确定几何…`});const f=new Int32Array(m),g=new Int32Array(m);let y=1/0,p=-1/0,T=1/0,B=-1/0;{const A=Math.max(x,Math.floor(t*1024*1024/x)*x);let w=0;for(let L=3600;L<n&&w<m;L+=A){const O=await wt(i,L,L+A),U=new DataView(O),v=Math.min(Math.floor(O.byteLength/x),m-w);for(let E=0;E<v;E++,w++){const C=E*x,I=U.getInt32(C+188,!1),z=U.getInt32(C+192,!1);f[w]=I,g[w]=z,I<y&&(y=I),I>p&&(p=I),z<T&&(T=z),z>B&&(B=z)}s({phase:"header",bytesRead:L-3600,tracesRead:w,totalTraces:m,message:`扫描道头 ${w}/${m}`}),await new Promise(E=>setTimeout(E,0))}}let N,R,V;if(y===0&&p===0&&T===0&&B===0)V=!1,N=Math.ceil(Math.sqrt(m)),R=Math.ceil(m/N);else if(V=!0,N=p-y+1,R=B-T+1,N*R>m*4)throw new Error(`道头几何异常: ${N}×${R} 网格 vs ${m} 道`);const j=d,nt={nx:N,ny:R,nz:j},Y=new Float32Array(N*R*j);Y.fill(NaN);let K=1/0,J=-1/0;const it=Math.max(x,Math.floor(t*1024*1024/x)*x);let h=0;for(let A=3600;A<n&&h<m;A+=it){const w=await wt(i,A,A+it),L=new DataView(w),O=Math.min(Math.floor(w.byteLength/x),m-h);for(let U=0;U<O;U++,h++){const v=U*x;let E,C;if(V){if(E=f[h]-y,C=g[h]-T,E<0||E>=N||C<0||C>=R)continue}else E=h%N,C=Math.floor(h/N)%R;const I=E+N*C,z=N*R;let M=v+240;for(let D=0;D<j;D++){let _;switch(u){case 1:_=se(L.getUint8(M),L.getUint8(M+1),L.getUint8(M+2),L.getUint8(M+3));break;case 2:_=L.getInt32(M,!1);break;case 3:_=L.getInt16(M,!1);break;case 5:_=L.getFloat32(M,!1);break;case 6:_=L.getFloat64(M,!1);break;default:_=L.getInt8(M);break}M+=b;const k=I+z*D;Y[k]=_,_<K&&(K=_),_>J&&(J=_)}}s({phase:"traces",bytesRead:A-3600,tracesRead:h,totalTraces:m,message:`读取道数据 ${h}/${m}(${(100*h/m).toFixed(1)}%)`}),await new Promise(U=>setTimeout(U,0))}s({phase:"normalize",message:"归一化数据…"});const S=Math.max(Math.abs(K),Math.abs(J))||1;for(let A=0;A<Y.length;A++){const w=Y[A];Y[A]=Number.isNaN(w)?0:w/S}return s({phase:"done",bytesRead:n,tracesRead:m,totalTraces:m,message:"完成"}),{dims:nt,data:Y,minVal:K,maxVal:J,sampleIntervalUs:c,formatCode:u,textHeader:a}}const Nt={colormapId:"seismic-bwr",opacity:[{t:0,o:0},{t:.35,o:.05},{t:.5,o:0},{t:.65,o:.05},{t:1,o:.9}],isoValue:.45,isoEnabled:!1,isoOpacity:.85,sliceX:.5,sliceY:.5,sliceZ:.5,sliceXOn:!1,sliceYOn:!1,sliceZOn:!0,arbOn:!1,arbNormal:[.577,.577,.577],arbOffset:0,lighting:!0,steps:320};function pt(){return Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8)}const ae=i=>{const e=parseInt(i.slice(1),16);return[(e>>16&255)/255,(e>>8&255)/255,(e&255)/255]},P=(i,e)=>({t:i,color:ae(e)}),Ft=[{id:"seismic-bwr",name:"地震 蓝-白-红",builtin:!0,stops:[P(0,"#0b2d8f"),P(.25,"#3f7de0"),P(.5,"#f5f5f5"),P(.75,"#e0523f"),P(1,"#8f0b0b")]},{id:"seismic-rwb",name:"地震 红-白-蓝(反)",builtin:!0,stops:[P(0,"#8f0b0b"),P(.25,"#e0523f"),P(.5,"#f5f5f5"),P(.75,"#3f7de0"),P(1,"#0b2d8f")]},{id:"seismic-bkwr",name:"地震 黑-白-红",builtin:!0,stops:[P(0,"#101010"),P(.35,"#5a5a5a"),P(.5,"#ffffff"),P(.7,"#ff4d2e"),P(1,"#7a0000")]},{id:"gray",name:"灰度",builtin:!0,stops:[P(0,"#000000"),P(1,"#ffffff")]},{id:"viridis",name:"Viridis",builtin:!0,stops:[P(0,"#440154"),P(.25,"#3b528b"),P(.5,"#21918c"),P(.75,"#5ec962"),P(1,"#fde725")]},{id:"rainbow",name:"彩虹",builtin:!0,stops:[P(0,"#0000ff"),P(.25,"#00ffff"),P(.5,"#00ff00"),P(.75,"#ffff00"),P(1,"#ff0000")]},{id:"hot",name:"热铁",builtin:!0,stops:[P(0,"#000000"),P(.35,"#b00000"),P(.7,"#ffb000"),P(1,"#ffffff")]},{id:"spectrum-strata",name:"地层(陆相)",builtin:!0,stops:[P(0,"#1a0f4a"),P(.2,"#2e5fa3"),P(.4,"#3fa08f"),P(.55,"#c8c86a"),P(.75,"#c8863a"),P(1,"#7a2e12")]}],St="seismic-studio.custom-colormaps",Dt="seismic-studio.active-colormap";function At(){try{const i=localStorage.getItem(St);return i?JSON.parse(i):[]}catch{return[]}}function re(i){const e=At().filter(t=>t.id!==i.id);e.push({...i,builtin:!1}),localStorage.setItem(St,JSON.stringify(e))}function le(i){localStorage.setItem(St,JSON.stringify(At().filter(e=>e.id!==i)))}function rt(){return[...Ft,...At()]}function ot(i){return rt().find(e=>e.id===i)??Ft[0]}function vt(){return localStorage.getItem(Dt)||"seismic-bwr"}function Et(i){localStorage.setItem(Dt,i)}function gt(i,e,t=256){const n=new Uint8Array(t*4),s=[...i.stops].sort((l,d)=>l.t-d.t),o=[...e].sort((l,d)=>l.t-d.t),r=l=>{if(l<=s[0].t)return s[0].color;if(l>=s[s.length-1].t)return s[s.length-1].color;for(let d=0;d<s.length-1;d++)if(l>=s[d].t&&l<=s[d+1].t){const c=(l-s[d].t)/Math.max(1e-6,s[d+1].t-s[d].t);return[s[d].color[0]+c*(s[d+1].color[0]-s[d].color[0]),s[d].color[1]+c*(s[d+1].color[1]-s[d].color[1]),s[d].color[2]+c*(s[d+1].color[2]-s[d].color[2])]}return s[0].color},a=l=>{if(o.length===0)return 1;if(l<=o[0].t)return o[0].o;if(l>=o[o.length-1].t)return o[o.length-1].o;for(let d=0;d<o.length-1;d++)if(l>=o[d].t&&l<=o[d+1].t){const c=(l-o[d].t)/Math.max(1e-6,o[d+1].t-o[d].t);return o[d].o+c*(o[d+1].o-o[d].o)}return 1};for(let l=0;l<t;l++){const d=l/(t-1),[c,u,b]=r(d);n[l*4+0]=Math.round(c*255),n[l*4+1]=Math.round(u*255),n[l*4+2]=Math.round(b*255),n[l*4+3]=Math.round(Math.max(0,Math.min(1,a(d)))*255)}return n}function ce(i){return`linear-gradient(to right, ${[...i.stops].sort((t,n)=>t.t-n.t).map(t=>`rgb(${Math.round(t.color[0]*255)},${Math.round(t.color[1]*255)},${Math.round(t.color[2]*255)}) ${(t.t*100).toFixed(1)}%`).join(", ")})`}let Z=null;async function lt(i){const t=(await Tt()).find(s=>s.id===i);if(!t)return null;const n=await Zt(i);return n?(Z={project:t,dims:n.dims,data:new Float32Array(n.buffer),settings:de(i)},localStorage.setItem("seismic-studio.last-project",i),Bt(),Z):null}async function Ct(){if(Z)return Z;const i=localStorage.getItem("seismic-studio.last-project");if(i){const t=await lt(i);if(t)return t}const e=await Tt();return e.length>0?lt(e[e.length-1].id):null}function Bt(){const i=document.getElementById("project-indicator");i&&(i.textContent=Z?`当前工区:${Z.project.name}(${Z.dims.nx}×${Z.dims.ny}×${Z.dims.nz})`:"未打开工区")}function Ot(i){return`seismic-studio.settings.${i}`}function de(i){try{const t=localStorage.getItem(Ot(i));if(t){const n=JSON.parse(t);return{...structuredClone(Nt),...n}}}catch{}const e=structuredClone(Nt);return e.colormapId=vt(),e}let $t=0;function G(){Z&&(clearTimeout($t),$t=window.setTimeout(()=>{Z&&localStorage.setItem(Ot(Z.project.id),JSON.stringify(Z.settings))},300))}function H(i,e=2200){document.querySelectorAll(".toast").forEach(n=>n.remove());const t=document.createElement("div");t.className="toast",t.textContent=i,document.body.appendChild(t),setTimeout(()=>t.remove(),e)}function ct(i,e){const t=URL.createObjectURL(i),n=document.createElement("a");n.href=t,n.download=e,n.click(),setTimeout(()=>URL.revokeObjectURL(t),5e3)}function mt(i){return i<1024?`${i} B`:i<1024**2?`${(i/1024).toFixed(1)} KB`:i<1024**3?`${(i/1024**2).toFixed(1)} MB`:`${(i/1024**3).toFixed(2)} GB`}async function Ut(i){i.innerHTML=`
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
    </div>`;const e=r=>i.querySelector(r);let t=!1;async function n(){const r=(await Tt()).sort((l,d)=>d.created-l.created),a=e("#proj-tbody");a.innerHTML=r.length===0?'<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">还没有工区,先生成一个演示工区或导入 SEG-Y</td></tr>':"";for(const l of r){const d=document.createElement("tr");d.innerHTML=`
        <td>${ue(l.name)}</td>
        <td>${l.dims.nx} × ${l.dims.ny} × ${l.dims.nz}</td>
        <td>${l.source==="demo"?"演示数据":"SEG-Y 导入"}</td>
        <td>${mt(l.byteSize)}</td>
        <td>${new Date(l.created).toLocaleString()}</td>
        <td></td>`;const c=d.lastElementChild,u=(b,x="")=>{const m=document.createElement("button");return m.textContent=b,m.className=x,m.style.marginRight="6px",m.style.padding="3px 10px",c.appendChild(m),m};u("浏览","primary").onclick=async()=>{await lt(l.id),location.hash="#/viewer"},u("层位解释").onclick=async()=>{await lt(l.id),location.hash="#/horizon"},u("导出").onclick=async()=>{await lt(l.id),location.hash="#/export"},u("删除","danger").onclick=async()=>{confirm(`删除工区「${l.name}」及其全部层位?`)&&(await Qt(l.id),H("已删除"),n())},a.appendChild(d)}}e("#btn-demo").onclick=async()=>{const[r,a,l]=e("#demo-size").value.split(",").map(Number),d=(e("#demo-name").value||"演示工区").trim(),c=i.querySelectorAll(".progress-wrap")[0],u=c.querySelector(".progress-bar"),b=i.querySelectorAll(".progress-text")[0];c.style.display="block",b.textContent="生成合成数据体…",u.style.width="30%",await new Promise(y=>setTimeout(y,30));const{dims:x,data:m}=zt({nx:r,ny:a,nz:l});u.style.width="70%",b.textContent="写入 IndexedDB…",await new Promise(y=>setTimeout(y,30));const f=pt(),g={id:f,name:d,created:Date.now(),dims:x,minVal:-1,maxVal:1,source:"demo",byteSize:m.byteLength};await Pt(g),await It({projectId:f,dims:x,buffer:m.buffer}),u.style.width="100%",b.textContent="完成",t||(H(`工区「${d}」已创建`),n())},e("#btn-dl-segy").onclick=()=>{const{dims:r,data:a}=zt({nx:96,ny:96,nz:80,seed:777}),l=ne(r,a);ct(new Blob([l],{type:"application/octet-stream"}),"synthetic_test.sgy"),H("测试 SEG-Y 已下载,可用「导入 SEG-Y」验证解析链路")};let s=null;const o=e("#segy-file");return o.onchange=()=>{s=o.files?.[0]??null,e("#btn-import").disabled=!s,s&&!e("#segy-name").value&&(e("#segy-name").value=s.name.replace(/\.(sgy|segy)$/i,""))},e("#btn-import").onclick=async()=>{if(!s)return;const r=i.querySelectorAll(".progress-wrap")[1],a=r.querySelector(".progress-bar"),l=i.querySelectorAll(".progress-text")[1];r.style.display="block";try{const d=await oe(s,b=>{const x=b.totalTraces?b.tracesRead/b.totalTraces:0;a.style.width=`${(x*100).toFixed(1)}%`,l.textContent=`${b.message} — ${mt(b.bytesRead)} / ${mt(b.totalBytes)}`}),c=pt(),u=(e("#segy-name").value||s.name).trim();await Pt({id:c,name:u,created:Date.now(),dims:d.dims,minVal:d.minVal,maxVal:d.maxVal,sampleIntervalUs:d.sampleIntervalUs,source:"segy",byteSize:d.data.byteLength}),await It({projectId:c,dims:d.dims,buffer:d.data.buffer}),l.textContent=`完成:${d.dims.nx}×${d.dims.ny}×${d.dims.nz}`,H(`工区「${u}」导入完成`),n()}catch(d){l.textContent=`导入失败:${d instanceof Error?d.message:String(d)}`,l.style.color="var(--err)"}},await n(),()=>{t=!0}}function ue(i){return i.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function _t(i,e,t){const n=i.createShader(e);if(i.shaderSource(n,t),i.compileShader(n),!i.getShaderParameter(n,i.COMPILE_STATUS)){const s=i.getShaderInfoLog(n);throw i.deleteShader(n),new Error(`着色器编译失败: ${s}`)}return n}function ht(i,e,t){const n=i.createProgram();if(i.attachShader(n,_t(i,i.VERTEX_SHADER,e)),i.attachShader(n,_t(i,i.FRAGMENT_SHADER,t)),i.linkProgram(n),!i.getProgramParameter(n,i.LINK_STATUS))throw new Error(`着色器链接失败: ${i.getProgramInfoLog(n)}`);return n}function jt(){const i=new Float32Array(16);return i[0]=i[5]=i[10]=i[15]=1,i}function he(i,e){const t=new Float32Array(16);for(let n=0;n<4;n++)for(let s=0;s<4;s++)t[n*4+s]=i[0*4+s]*e[n*4+0]+i[1*4+s]*e[n*4+1]+i[2*4+s]*e[n*4+2]+i[3*4+s]*e[n*4+3];return t}function fe(i,e,t,n){const s=1/Math.tan(i/2),o=new Float32Array(16);return o[0]=s/e,o[5]=s,o[10]=(n+t)/(t-n),o[11]=-1,o[14]=2*n*t/(t-n),o}function me(i,e,t){const n=i[0]-e[0],s=i[1]-e[1],o=i[2]-e[2];let r=Math.hypot(n,s,o)||1;const a=[n/r,s/r,o/r];let l=[t[1]*a[2]-t[2]*a[1],t[2]*a[0]-t[0]*a[2],t[0]*a[1]-t[1]*a[0]];const d=Math.hypot(l[0],l[1],l[2])||1;l=[l[0]/d,l[1]/d,l[2]/d];const c=[a[1]*l[2]-a[2]*l[1],a[2]*l[0]-a[0]*l[2],a[0]*l[1]-a[1]*l[0]],u=jt();return u[0]=l[0],u[4]=l[1],u[8]=l[2],u[1]=c[0],u[5]=c[1],u[9]=c[2],u[2]=a[0],u[6]=a[1],u[10]=a[2],u[12]=-(l[0]*i[0]+l[1]*i[1]+l[2]*i[2]),u[13]=-(c[0]*i[0]+c[1]*i[1]+c[2]*i[2]),u[14]=-(a[0]*i[0]+a[1]*i[1]+a[2]*i[2]),u}function pe(i){const e=new Float32Array(16),t=i;e[0]=t[5]*t[10]*t[15]-t[5]*t[11]*t[14]-t[9]*t[6]*t[15]+t[9]*t[7]*t[14]+t[13]*t[6]*t[11]-t[13]*t[7]*t[10],e[4]=-t[4]*t[10]*t[15]+t[4]*t[11]*t[14]+t[8]*t[6]*t[15]-t[8]*t[7]*t[14]-t[12]*t[6]*t[11]+t[12]*t[7]*t[10],e[8]=t[4]*t[9]*t[15]-t[4]*t[11]*t[13]-t[8]*t[5]*t[15]+t[8]*t[7]*t[13]+t[12]*t[5]*t[11]-t[12]*t[7]*t[9],e[12]=-t[4]*t[9]*t[14]+t[4]*t[10]*t[13]+t[8]*t[5]*t[14]-t[8]*t[6]*t[13]-t[12]*t[5]*t[10]+t[12]*t[6]*t[9],e[1]=-t[1]*t[10]*t[15]+t[1]*t[11]*t[14]+t[9]*t[2]*t[15]-t[9]*t[3]*t[14]-t[13]*t[2]*t[11]+t[13]*t[3]*t[10],e[5]=t[0]*t[10]*t[15]-t[0]*t[11]*t[14]-t[8]*t[2]*t[15]+t[8]*t[3]*t[14]+t[12]*t[2]*t[11]-t[12]*t[3]*t[10],e[9]=-t[0]*t[9]*t[15]+t[0]*t[11]*t[13]+t[8]*t[1]*t[15]-t[8]*t[3]*t[13]-t[12]*t[1]*t[11]+t[12]*t[3]*t[9],e[13]=t[0]*t[9]*t[14]-t[0]*t[10]*t[13]-t[8]*t[1]*t[14]+t[8]*t[2]*t[13]+t[12]*t[1]*t[10]-t[12]*t[2]*t[9],e[2]=t[1]*t[6]*t[15]-t[1]*t[7]*t[14]-t[5]*t[2]*t[15]+t[5]*t[3]*t[14]+t[13]*t[2]*t[7]-t[13]*t[3]*t[6],e[6]=-t[0]*t[6]*t[15]+t[0]*t[7]*t[14]+t[4]*t[2]*t[15]-t[4]*t[3]*t[14]-t[12]*t[2]*t[7]+t[12]*t[3]*t[6],e[10]=t[0]*t[5]*t[15]-t[0]*t[7]*t[13]-t[4]*t[1]*t[15]+t[4]*t[3]*t[13]+t[12]*t[1]*t[7]-t[12]*t[3]*t[5],e[14]=-t[0]*t[5]*t[14]+t[0]*t[6]*t[13]+t[4]*t[1]*t[14]-t[4]*t[2]*t[13]-t[12]*t[1]*t[6]+t[12]*t[2]*t[5],e[3]=-t[1]*t[6]*t[11]+t[1]*t[7]*t[10]+t[5]*t[2]*t[11]-t[5]*t[3]*t[10]-t[9]*t[2]*t[7]+t[9]*t[3]*t[6],e[7]=t[0]*t[6]*t[11]-t[0]*t[7]*t[10]-t[4]*t[2]*t[11]+t[4]*t[3]*t[10]+t[8]*t[2]*t[7]-t[8]*t[3]*t[6],e[11]=-t[0]*t[5]*t[11]+t[0]*t[7]*t[9]+t[4]*t[1]*t[11]-t[4]*t[3]*t[9]-t[8]*t[1]*t[7]+t[8]*t[3]*t[5],e[15]=t[0]*t[5]*t[10]-t[0]*t[6]*t[9]-t[4]*t[1]*t[10]+t[4]*t[2]*t[9]+t[8]*t[1]*t[6]-t[8]*t[2]*t[5];let n=t[0]*e[0]+t[1]*e[4]+t[2]*e[8]+t[3]*e[12];if(Math.abs(n)<1e-12)return jt();n=1/n;for(let s=0;s<16;s++)e[s]*=n;return e}function ve(i){const e=new Uint16Array(i.length),t=new Float32Array(1),n=new Uint32Array(t.buffer);for(let s=0;s<i.length;s++){t[0]=i[s];const o=n[0],r=o>>16&32768;let a=(o>>23&255)-127+15,l=o&8388607;if(a<=0){e[s]=r;continue}if(a>=31){e[s]=r|31743;continue}e[s]=r|a<<10|l>>13}return e}const ge=`#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vNdc;
void main() { vNdc = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }
`,be=`#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vNdc;
out vec4 fragColor;

uniform mat4 uInvVP;
uniform vec3 uCamPos;
uniform vec3 uBoxMin;
uniform vec3 uBoxMax;
uniform sampler3D uVol;
uniform sampler2D uLut;
uniform int uSteps;
uniform float uDensity;
uniform bool uLighting;
uniform vec4 uPlanes[4];   // xyz=法线 w=d,体数据归一化坐标
uniform int uNumPlanes;

float sampleVol(vec3 p) { return texture(uVol, p).r; }

void main() {
  vec4 far4 = uInvVP * vec4(vNdc, 1.0, 1.0);
  vec3 ro = uCamPos;
  vec3 rd = normalize(far4.xyz / far4.w - ro);

  vec3 inv = 1.0 / rd;
  vec3 tA = (uBoxMin - ro) * inv;
  vec3 tB = (uBoxMax - ro) * inv;
  vec3 tmn = min(tA, tB), tmx = max(tA, tB);
  float t0 = max(max(tmn.x, tmn.y), tmn.z);
  float t1 = min(min(tmx.x, tmx.y), tmx.z);
  if (t1 <= t0) discard;
  t0 = max(t0, 0.0);

  // 切片平面与射线的交点,插入排序(最多 4 个)
  float tc[4];
  int nc = 0;
  for (int i = 0; i < 4; i++) {
    if (i >= uNumPlanes) break;
    vec3 n = uPlanes[i].xyz;
    float denom = dot(n, rd);
    if (abs(denom) < 1e-7) continue;
    float t = (uPlanes[i].w - dot(n, ro)) / denom;
    if (t > t0 && t < t1) { tc[nc] = t; nc++; }
  }
  for (int i = 1; i < 4; i++) {
    if (i >= nc) break;
    float key = tc[i];
    int j = i - 1;
    while (j >= 0 && tc[j] > key) { tc[j + 1] = tc[j]; j--; }
    tc[j + 1] = key;
  }

  vec3 boxSize = uBoxMax - uBoxMin;
  float stepLen = (t1 - t0) / float(uSteps);
  vec3 texel = 1.0 / vec3(textureSize(uVol, 0));
  vec3 lightDir = normalize(vec3(0.4, 0.7, 0.6));

  vec4 acc = vec4(0.0);
  int ci = 0;
  float t = t0;
  for (int i = 0; i < 2048; i++) {
    if (i >= uSteps || t > t1) break;
    // 切片(不透明)交点:合成后终止
    while (ci < nc && tc[ci] <= t) {
      vec3 p = ro + rd * tc[ci];
      vec3 uvw = (p - uBoxMin) / boxSize;
      float v = sampleVol(uvw);
      vec3 sc = texture(uLut, vec2(v, 0.5)).rgb;
      acc.rgb += (1.0 - acc.a) * sc;
      acc.a = 1.0;
      ci++;
    }
    if (acc.a > 0.98) break;   // 早停

    vec3 p = ro + rd * t;
    vec3 uvw = (p - uBoxMin) / boxSize;
    float v = sampleVol(uvw);
    vec4 c = texture(uLut, vec2(v, 0.5));
    float a = clamp(c.a * uDensity, 0.0, 1.0);
    if (a > 0.004) {
      vec3 col = c.rgb;
      if (uLighting) {
        vec3 g = vec3(
          sampleVol(uvw + vec3(texel.x, 0.0, 0.0)) - sampleVol(uvw - vec3(texel.x, 0.0, 0.0)),
          sampleVol(uvw + vec3(0.0, texel.y, 0.0)) - sampleVol(uvw - vec3(0.0, texel.y, 0.0)),
          sampleVol(uvw + vec3(0.0, 0.0, texel.z)) - sampleVol(uvw - vec3(0.0, 0.0, texel.z)));
        float gl2 = dot(g, g);
        if (gl2 > 1e-8) {
          float diff = abs(dot(normalize(-g), lightDir));
          col *= 0.45 + 0.55 * diff;
        }
      }
      // 步长不透明度修正(参考步长 1/256 包围盒对角)
      float aa = 1.0 - pow(1.0 - a, stepLen * 256.0);
      acc.rgb += (1.0 - acc.a) * col * aa;
      acc.a += (1.0 - acc.a) * aa;
    }
    t += stepLen;
  }

  vec3 bg = vec3(0.045, 0.055, 0.075);
  fragColor = vec4(acc.rgb + (1.0 - acc.a) * bg, 1.0);
}
`,xe=`#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
uniform mat4 uVP;
out vec3 vNrm;
void main() { vNrm = aNrm; gl_Position = uVP * vec4(aPos, 1.0); }
`,ye=`#version 300 es
precision highp float;
in vec3 vNrm;
out vec4 fragColor;
uniform vec4 uColor;
void main() {
  vec3 n = normalize(vNrm);
  vec3 l = normalize(vec3(0.4, 0.7, 0.6));
  float diff = abs(dot(n, l));
  vec3 h = normalize(l + vec3(0.0, 0.0, 1.0));
  float spec = pow(abs(dot(n, h)), 32.0) * 0.35;
  vec3 col = uColor.rgb * (0.35 + 0.65 * diff) + spec;
  fragColor = vec4(col, uColor.a);
}
`,we=`#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aColor;
uniform mat4 uVP;
uniform float uPointSize;
out vec3 vColor;
void main() {
  vColor = aColor;
  gl_Position = uVP * vec4(aPos, 1.0);
  gl_PointSize = uPointSize;
}
`,Ee=`#version 300 es
precision highp float;
in vec3 vColor;
out vec4 fragColor;
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  if (dot(d, d) > 0.25) discard;
  fragColor = vec4(vColor, 0.95);
}
`,Me=`#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uVP;
void main() { gl_Position = uVP * vec4(aPos, 1.0); }
`,Te=`#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec4 uColor;
void main() { fragColor = uColor; }
`,Se=i=>{const e=parseInt(i.slice(1),16);return[(e>>16&255)/255,(e>>8&255)/255,(e&255)/255]};class Lt{constructor(e){this.volTex=null,this.dims={nx:1,ny:1,nz:1},this.boxMin=[-.5,-.5,-.5],this.boxMax=[.5,.5,.5],this.meshVao=null,this.meshCount=0,this.meshColor=[.9,.7,.3,.85],this.ptsVao=null,this.ptsCount=0,this.yaw=-.7,this.pitch=.55,this.dist=2.2,this.target=[0,0,0],this.fpsEma=60,this.lastTime=0,this.interacting=!1,this.lastInteract=0,this.renderScale=1,this.raf=0,this.destroyed=!1,this.running=!1,this.settings=null,this.onStats=null,this.onCameraChange=null,this.statsTimer=0,this.canvas=e;const t=e.getContext("webgl2",{antialias:!1,depth:!0,preserveDrawingBuffer:!1,alpha:!1});if(!t)throw new Error("当前浏览器不支持 WebGL2");this.gl=t,this.rayProg=ht(t,ge,be),this.meshProg=ht(t,xe,ye),this.ptsProg=ht(t,we,Ee),this.boxProg=ht(t,Me,Te),this.quadVao=t.createVertexArray(),t.bindVertexArray(this.quadVao);const n=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,n),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),t.STATIC_DRAW),t.enableVertexAttribArray(0),t.vertexAttribPointer(0,2,t.FLOAT,!1,0,0),this.boxVao=t.createVertexArray(),t.bindVertexArray(this.boxVao),this.boxBuf=t.createBuffer(),t.bindBuffer(t.ARRAY_BUFFER,this.boxBuf),t.bufferData(t.ARRAY_BUFFER,new Float32Array(24*3),t.DYNAMIC_DRAW),t.enableVertexAttribArray(0),t.vertexAttribPointer(0,3,t.FLOAT,!1,0,0),t.bindVertexArray(null),this.lutTex=t.createTexture(),t.bindTexture(t.TEXTURE_2D,this.lutTex),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE);const s=new Uint8Array(256*4).fill(255);t.texImage2D(t.TEXTURE_2D,0,t.RGBA,256,1,0,t.RGBA,t.UNSIGNED_BYTE,s),this.attachInput()}setVolume(e,t){const n=this.gl;this.dims=e;const{nx:s,ny:o,nz:r}=e,a=Math.max(s,o,r);this.boxMin=[-s/a/2,-r/a/2,-o/a/2],this.boxMax=[s/a/2,r/a/2,o/a/2];const l=new Float32Array(t.length);for(let p=0;p<r;p++){const T=r-1-p;for(let B=0;B<o;B++){const N=s*(B+o*p),R=s*(T+r*B);for(let V=0;V<s;V++)l[V+R]=t[V+N]*.5+.5}}this.volTex&&n.deleteTexture(this.volTex),this.volTex=n.createTexture(),n.bindTexture(n.TEXTURE_3D,this.volTex),n.texParameteri(n.TEXTURE_3D,n.TEXTURE_MIN_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_3D,n.TEXTURE_MAG_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_3D,n.TEXTURE_WRAP_S,n.CLAMP_TO_EDGE),n.texParameteri(n.TEXTURE_3D,n.TEXTURE_WRAP_T,n.CLAMP_TO_EDGE),n.texParameteri(n.TEXTURE_3D,n.TEXTURE_WRAP_R,n.CLAMP_TO_EDGE);try{if(n.texImage3D(n.TEXTURE_3D,0,n.R16F,s,r,o,0,n.RED,n.HALF_FLOAT,ve(l)),n.getError()!==n.NO_ERROR)throw new Error("R16F 上传失败")}catch{const p=new Uint8Array(l.length);for(let T=0;T<l.length;T++)p[T]=Math.round(l[T]*255);n.texImage3D(n.TEXTURE_3D,0,n.R8,s,r,o,0,n.RED,n.UNSIGNED_BYTE,p)}const[d,c,u]=this.boxMin,[b,x,m]=this.boxMax,f=[[d,c,u],[b,c,u],[b,x,u],[d,x,u],[d,c,m],[b,c,m],[b,x,m],[d,x,m]],g=[0,1,1,2,2,3,3,0,4,5,5,6,6,7,7,4,0,4,1,5,2,6,3,7],y=new Float32Array(g.length*3);g.forEach((p,T)=>y.set(f[p],T*3)),n.bindVertexArray(this.boxVao),n.bindBuffer(n.ARRAY_BUFFER,this.boxBuf),n.bufferData(n.ARRAY_BUFFER,y,n.STATIC_DRAW),n.bindVertexArray(null)}setLut(e){const t=this.gl;t.bindTexture(t.TEXTURE_2D,this.lutTex),t.texSubImage2D(t.TEXTURE_2D,0,0,0,256,1,t.RGBA,t.UNSIGNED_BYTE,e)}setIsoMesh(e,t,n="#e0b34d",s=.85){const o=this.gl;this.meshVao&&(o.deleteVertexArray(this.meshVao),this.meshVao=null),this.meshCount=0;const[r,a,l]=Se(n);if(this.meshColor=[r,a,l,s],!e||!t||e.length===0)return;const d=e.length/3,c=new Float32Array(d*6);for(let b=0;b<d;b++)c[b*6+0]=e[b*3+0],c[b*6+1]=e[b*3+1],c[b*6+2]=e[b*3+2],c[b*6+3]=t[b*3+0],c[b*6+4]=t[b*3+1],c[b*6+5]=t[b*3+2];this.meshVao=o.createVertexArray(),o.bindVertexArray(this.meshVao);const u=o.createBuffer();o.bindBuffer(o.ARRAY_BUFFER,u),o.bufferData(o.ARRAY_BUFFER,c,o.STATIC_DRAW),o.enableVertexAttribArray(0),o.vertexAttribPointer(0,3,o.FLOAT,!1,24,0),o.enableVertexAttribArray(1),o.vertexAttribPointer(1,3,o.FLOAT,!1,24,12),o.bindVertexArray(null),this.meshCount=d}setIsoMeshOpacity(e){this.meshColor[3]=e}setHorizonPoints(e,t){const n=this.gl;if(this.ptsVao&&(n.deleteVertexArray(this.ptsVao),this.ptsVao=null),this.ptsCount=0,!e||!t||e.length===0)return;const s=e.length/3,o=new Float32Array(s*6);for(let a=0;a<s;a++)o[a*6+0]=e[a*3+0],o[a*6+1]=e[a*3+1],o[a*6+2]=e[a*3+2],o[a*6+3]=t[a*3+0],o[a*6+4]=t[a*3+1],o[a*6+5]=t[a*3+2];this.ptsVao=n.createVertexArray(),n.bindVertexArray(this.ptsVao);const r=n.createBuffer();n.bindBuffer(n.ARRAY_BUFFER,r),n.bufferData(n.ARRAY_BUFFER,o,n.STATIC_DRAW),n.enableVertexAttribArray(0),n.vertexAttribPointer(0,3,n.FLOAT,!1,24,0),n.enableVertexAttribArray(1),n.vertexAttribPointer(1,3,n.FLOAT,!1,24,12),n.bindVertexArray(null),this.ptsCount=s}gridToWorld(e,t,n){const{nx:s,ny:o,nz:r}=this.dims;return[this.boxMin[0]+e/Math.max(1,s-1)*(this.boxMax[0]-this.boxMin[0]),this.boxMin[1]+(1-n/Math.max(1,r-1))*(this.boxMax[1]-this.boxMin[1]),this.boxMin[2]+t/Math.max(1,o-1)*(this.boxMax[2]-this.boxMin[2])]}attachInput(){const e=this.canvas;let t=!1,n=!1,s=0,o=0;e.addEventListener("pointerdown",r=>{t=!0,n=r.button===2||r.shiftKey,s=r.clientX,o=r.clientY,e.setPointerCapture(r.pointerId),this.interacting=!0,this.lastInteract=performance.now()}),e.addEventListener("pointermove",r=>{if(!t)return;const a=r.clientX-s,l=r.clientY-o;if(s=r.clientX,o=r.clientY,n){const d=this.dist*.0016,c=[Math.cos(this.yaw),0,-Math.sin(this.yaw)],u=[0,1,0];this.target[0]-=c[0]*a*d,this.target[2]-=c[2]*a*d,this.target[1]+=u[1]*l*d}else this.yaw+=a*.008,this.pitch=Math.max(-1.5,Math.min(1.5,this.pitch+l*.008));this.lastInteract=performance.now(),this.onCameraChange?.()}),e.addEventListener("pointerup",()=>{t=!1,this.interacting=!1}),e.addEventListener("pointerleave",()=>{t=!1,this.interacting=!1}),e.addEventListener("wheel",r=>{r.preventDefault(),this.dist=Math.max(.4,Math.min(8,this.dist*(1+Math.sign(r.deltaY)*.1))),this.lastInteract=performance.now(),this.interacting=!0,setTimeout(()=>{this.interacting=!1},120),this.onCameraChange?.()},{passive:!1}),e.addEventListener("contextmenu",r=>r.preventDefault())}camera(){const e=[this.target[0]+this.dist*Math.cos(this.pitch)*Math.sin(this.yaw),this.target[1]+this.dist*Math.sin(this.pitch),this.target[2]+this.dist*Math.cos(this.pitch)*Math.cos(this.yaw)],t=Math.max(.001,this.canvas.width/Math.max(1,this.canvas.height)),n=fe(50*Math.PI/180,t,.02,50),s=me(e,this.target,[0,1,0]),o=he(n,s);return{vp:o,invVp:pe(o),eye:e}}start(){if(this.running)return;this.running=!0,this.lastTime=performance.now();const e=t=>{if(this.destroyed||!this.running)return;const n=Math.max(1,t-this.lastTime);this.lastTime=t;const s=1e3/n;this.fpsEma+=(s-this.fpsEma)*.08,this.updateRenderScale(t),this.render(),this.statsTimer+=n,this.statsTimer>250&&this.onStats&&(this.statsTimer=0,this.onStats({fps:this.fpsEma,renderScale:this.renderScale})),this.raf=requestAnimationFrame(e)};this.raf=requestAnimationFrame(e)}stop(){this.running=!1,cancelAnimationFrame(this.raf)}destroy(){this.destroyed=!0,this.stop(),this.gl.getExtension("WEBGL_lose_context")?.loseContext()}updateRenderScale(e){const t=this.interacting||e-this.lastInteract<250;let n=t?.5:1;!t&&this.fpsEma<20?n=.6:!t&&this.fpsEma<35&&(n=Math.min(n,.8)),this.renderScale+=(n-this.renderScale)*.5,Math.abs(this.renderScale-n)<.02&&(this.renderScale=n)}resize(){const e=Math.min(2,window.devicePixelRatio||1),t=Math.max(8,Math.floor(this.canvas.clientWidth*e*this.renderScale)),n=Math.max(8,Math.floor(this.canvas.clientHeight*e*this.renderScale));(this.canvas.width!==t||this.canvas.height!==n)&&(this.canvas.width=t,this.canvas.height=n)}buildPlanes(){const e=this.settings,t=[];if(!e)return t;const[n,s,o]=this.boxMin,[r,a,l]=this.boxMax;if(e.sliceXOn&&t.push(1,0,0,n+e.sliceX*(r-n)),e.sliceYOn&&t.push(0,0,1,o+e.sliceY*(l-o)),e.sliceZOn&&t.push(0,1,0,s+(1-e.sliceZ)*(a-s)),e.arbOn){const d=e.arbNormal,c=Math.hypot(d[0],d[1],d[2])||1,u=Math.hypot(r-n,a-s,l-o);t.push(d[0]/c,d[1]/c,d[2]/c,e.arbOffset*u*.5)}return t}render(){const e=this.gl;this.resize(),e.viewport(0,0,this.canvas.width,this.canvas.height),e.disable(e.DEPTH_TEST),e.disable(e.BLEND),e.clearColor(.045,.055,.075,1),e.clear(e.COLOR_BUFFER_BIT|e.DEPTH_BUFFER_BIT);const{vp:t,invVp:n,eye:s}=this.camera(),o=this.settings;if(this.volTex&&o){e.useProgram(this.rayProg),e.bindVertexArray(this.quadVao),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_3D,this.volTex),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,this.lutTex);const r=d=>e.getUniformLocation(this.rayProg,d);e.uniform1i(r("uVol"),0),e.uniform1i(r("uLut"),1),e.uniformMatrix4fv(r("uInvVP"),!1,n),e.uniform3fv(r("uCamPos"),s),e.uniform3fv(r("uBoxMin"),this.boxMin),e.uniform3fv(r("uBoxMax"),this.boxMax),e.uniform1i(r("uSteps"),this.interacting?Math.max(96,Math.floor(o.steps/2)):o.steps),e.uniform1f(r("uDensity"),1),e.uniform1i(r("uLighting"),o.lighting?1:0);const a=this.buildPlanes(),l=new Float32Array(16);l.set(a),e.uniform4fv(r("uPlanes"),l),e.uniform1i(r("uNumPlanes"),a.length/4),e.drawArrays(e.TRIANGLES,0,3)}this.meshVao&&this.meshCount>0&&o?.isoEnabled&&(e.useProgram(this.meshProg),e.enable(e.DEPTH_TEST),e.enable(e.BLEND),e.blendFunc(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA),e.uniformMatrix4fv(e.getUniformLocation(this.meshProg,"uVP"),!1,t),e.uniform4fv(e.getUniformLocation(this.meshProg,"uColor"),this.meshColor),e.bindVertexArray(this.meshVao),e.drawArrays(e.TRIANGLES,0,this.meshCount),e.disable(e.BLEND),e.disable(e.DEPTH_TEST)),this.ptsVao&&this.ptsCount>0&&(e.useProgram(this.ptsProg),e.enable(e.BLEND),e.blendFunc(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA),e.uniformMatrix4fv(e.getUniformLocation(this.ptsProg,"uVP"),!1,t),e.uniform1f(e.getUniformLocation(this.ptsProg,"uPointSize"),4),e.bindVertexArray(this.ptsVao),e.drawArrays(e.POINTS,0,this.ptsCount),e.disable(e.BLEND)),e.useProgram(this.boxProg),e.uniformMatrix4fv(e.getUniformLocation(this.boxProg,"uVP"),!1,t),e.uniform4f(e.getUniformLocation(this.boxProg,"uColor"),.45,.55,.7,.6),e.enable(e.BLEND),e.blendFunc(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA),e.bindVertexArray(this.boxVao),e.drawArrays(e.LINES,0,24),e.disable(e.BLEND),e.bindVertexArray(null)}screenshot(){const e=this.renderScale;return this.renderScale=1,this.render(),this.renderScale=e,new Promise(t=>this.canvas.toBlob(n=>t(n),"image/png"))}}function Ae(i){return new Worker(""+new URL("mc.worker-FSyhnii5.js",import.meta.url).href,{type:"module",name:i?.name})}async function Ce(i){const e=await Ct();if(!e)return location.hash="#/projects",()=>{};const t=e.settings;i.innerHTML=`
    <div class="viewer-layout">
      <div class="viewer-canvas-wrap">
        <canvas id="gl-canvas"></canvas>
        <div class="hud" id="hud"></div>
      </div>
      <div class="sidebar">
        <div class="section">
          <h4>传递函数</h4>
          <div class="row"><label>色标</label>
            <select id="sel-colormap" style="flex:1"></select>
          </div>
          <div class="muted" style="margin:4px 0">不透明度曲线(拖动节点,双击添加,右键删除)</div>
          <canvas class="tf-canvas" id="tf-canvas" width="264" height="110"></canvas>
          <div class="row"><label>光照</label><input type="checkbox" id="chk-light" ${t.lighting?"checked":""}/></div>
          <div class="row"><label>步进数</label><input type="range" id="rng-steps" min="96" max="640" step="16" value="${t.steps}"/><span class="val" id="val-steps">${t.steps}</span></div>
        </div>
        <div class="section">
          <h4>正交剖面</h4>
          ${["X","Y","Z"].map(h=>`
          <div class="row">
            <input type="checkbox" id="chk-s${h}" ${t[`slice${h}On`]?"checked":""}/>
            <label style="flex:0 0 20px">${h}</label>
            <input type="range" id="rng-s${h}" min="0" max="1" step="0.005" value="${t[`slice${h}`]}"/>
            <span class="val" id="val-s${h}"></span>
          </div>`).join("")}
        </div>
        <div class="section">
          <h4>任意方向切片</h4>
          <div class="row"><label>启用</label><input type="checkbox" id="chk-arb" ${t.arbOn?"checked":""}/></div>
          <div class="row"><label>倾角</label><input type="range" id="rng-arb-dip" min="0" max="90" step="1" value="45"/><span class="val" id="val-arb-dip">45°</span></div>
          <div class="row"><label>方位</label><input type="range" id="rng-arb-az" min="0" max="360" step="1" value="45"/><span class="val" id="val-arb-az">45°</span></div>
          <div class="row"><label>偏移</label><input type="range" id="rng-arb-off" min="-1" max="1" step="0.01" value="${t.arbOffset}"/><span class="val" id="val-arb-off">${t.arbOffset.toFixed(2)}</span></div>
        </div>
        <div class="section">
          <h4>等值面(Worker)</h4>
          <div class="row"><label>启用</label><input type="checkbox" id="chk-iso" ${t.isoEnabled?"checked":""}/></div>
          <div class="row"><label>阈值</label><input type="range" id="rng-iso" min="-1" max="1" step="0.01" value="${t.isoValue}"/><span class="val" id="val-iso">${t.isoValue.toFixed(2)}</span></div>
          <div class="row"><label>不透明度</label><input type="range" id="rng-iso-op" min="0.1" max="1" step="0.05" value="${t.isoOpacity}"/><span class="val">${t.isoOpacity.toFixed(2)}</span></div>
          <div class="muted" id="iso-status">未启用</div>
        </div>
        <div class="section">
          <h4>层位叠加</h4>
          <div id="horizon-list" class="muted">加载中…</div>
        </div>
        <div class="section">
          <h4>导出</h4>
          <button id="btn-shot" class="primary" style="width:100%">截图(PNG)</button>
        </div>
      </div>
    </div>`;const n=h=>i.querySelector(h),s=n("#gl-canvas"),o=n("#hud"),r=new Lt(s);r.settings=t,r.setVolume(e.dims,e.data);const a=()=>{r.setLut(gt(ot(t.colormapId),t.opacity))};a(),r.onStats=h=>{o.textContent=`FPS ${h.fps.toFixed(0)}  渲染比例 ${(h.renderScale*100).toFixed(0)}%
${e.dims.nx}×${e.dims.ny}×${e.dims.nz}  拖动旋转 / 滚轮缩放 / Shift+拖动平移`,o.classList.toggle("hud-err",h.fps<20)},r.start();const l=n("#sel-colormap");(()=>{l.innerHTML="";for(const h of rt()){const S=document.createElement("option");S.value=h.id,S.textContent=h.name+(h.builtin?"":"(自定义)"),l.appendChild(S)}l.value=t.colormapId||vt()})(),l.onchange=()=>{t.colormapId=l.value,a(),G()};const c=n("#tf-canvas"),u=c.getContext("2d");let b=-1;const x=(h,S)=>({x:h*c.width,y:(1-S)*c.height}),m=(h,S)=>({t:Math.max(0,Math.min(1,h/c.width)),o:Math.max(0,Math.min(1,1-S/c.height))});function f(){u.clearRect(0,0,c.width,c.height);const h=ot(t.colormapId),S=u.createLinearGradient(0,0,c.width,0);for(const w of h.stops)S.addColorStop(w.t,`rgb(${w.color.map(L=>Math.round(L*255)).join(",")})`);u.globalAlpha=.35,u.fillStyle=S,u.fillRect(0,0,c.width,c.height),u.globalAlpha=1;const A=[...t.opacity].sort((w,L)=>w.t-L.t);u.strokeStyle="#4da3ff",u.lineWidth=2,u.beginPath(),A.forEach((w,L)=>{const{x:O,y:U}=x(w.t,w.o);L===0?u.moveTo(O,U):u.lineTo(O,U)}),u.stroke();for(const w of A){const{x:L,y:O}=x(w.t,w.o);u.fillStyle="#fff",u.beginPath(),u.arc(L,O,5,0,Math.PI*2),u.fill(),u.strokeStyle="#4da3ff",u.stroke()}}const g=(h,S)=>{const A=[...t.opacity].sort((w,L)=>w.t-L.t);for(let w=0;w<A.length;w++){const L=x(A[w].t,A[w].o);if(Math.hypot(L.x-h,L.y-S)<9)return{pt:A[w],idx:w}}return null},y=h=>{const S=c.getBoundingClientRect();return{x:(h.clientX-S.left)*(c.width/S.width),y:(h.clientY-S.top)*(c.height/S.height)}};c.addEventListener("pointerdown",h=>{const{x:S,y:A}=y(h),w=g(S,A);w&&(b=t.opacity.indexOf(w.pt),c.setPointerCapture(h.pointerId))}),c.addEventListener("pointermove",h=>{if(b<0)return;const{x:S,y:A}=y(h),{t:w,o:L}=m(S,A);t.opacity[b]={t:w,o:L},f(),a()}),c.addEventListener("pointerup",()=>{b>=0&&(b=-1,G())}),c.addEventListener("dblclick",h=>{const{x:S,y:A}=y(h);if(g(S,A))return;const{t:w,o:L}=m(S,A);t.opacity.push({t:w,o:L}),f(),a(),G()}),c.addEventListener("contextmenu",h=>{h.preventDefault();const{x:S,y:A}=y(h),w=g(S,A);w&&t.opacity.length>2&&(t.opacity.splice(t.opacity.indexOf(w.pt),1),f(),a(),G())}),f(),n("#chk-light").onchange=h=>{t.lighting=h.target.checked,G()},n("#rng-steps").oninput=h=>{t.steps=Number(h.target.value),n("#val-steps").textContent=String(t.steps),G()};for(const h of["X","Y","Z"]){const S=n(`#rng-s${h}`),A=n(`#val-s${h}`),w=h==="X"?"nx":h==="Y"?"ny":"nz",L=()=>{const O=Math.round(t[`slice${h}`]*(e.dims[w]-1));A.textContent=String(O)};n(`#chk-s${h}`).addEventListener("change",O=>{t[`slice${h}On`]=O.target.checked,G()}),S.addEventListener("input",()=>{t[`slice${h}`]=Number(S.value),L(),G()}),L()}const p=()=>{const h=Number(n("#rng-arb-dip").value)*Math.PI/180,S=Number(n("#rng-arb-az").value)*Math.PI/180;t.arbNormal=[Math.sin(h)*Math.cos(S),Math.cos(h),Math.sin(h)*Math.sin(S)],t.arbOffset=Number(n("#rng-arb-off").value),n("#val-arb-dip").textContent=`${n("#rng-arb-dip").value}°`,n("#val-arb-az").textContent=`${n("#rng-arb-az").value}°`,n("#val-arb-off").textContent=t.arbOffset.toFixed(2),G()};{const h=t.arbNormal,S=Math.round(Math.acos(Math.max(-1,Math.min(1,h[1])))*180/Math.PI),A=Math.round((Math.atan2(h[2],h[0])*180/Math.PI+360)%360);n("#rng-arb-dip").value=String(S),n("#rng-arb-az").value=String(A)}n("#chk-arb").addEventListener("change",h=>{t.arbOn=h.target.checked,G()}),n("#rng-arb-dip").addEventListener("input",p),n("#rng-arb-az").addEventListener("input",p),n("#rng-arb-off").addEventListener("input",p),p();const T=new Ae;let B=!1,N=0,R=0;const V=n("#iso-status");T.onmessage=h=>{const S=h.data;if(S.type==="ready")B=!0,t.isoEnabled&&j();else if(S.type==="mesh"){if(S.id!==N)return;const A=new Float32Array(S.positions),w=new Float32Array(S.normals),{nx:L,ny:O,nz:U}=e.dims,v=new Float32Array(A.length),E=new Float32Array(w.length);for(let C=0;C<A.length;C+=3){const I=r.gridToWorld(A[C]*(L-1),A[C+1]*(O-1),A[C+2]*(U-1));v[C]=I[0],v[C+1]=I[1],v[C+2]=I[2],E[C]=w[C],E[C+1]=w[C+2],E[C+2]=w[C+1]}r.setIsoMesh(v,E,"#e0b34d",t.isoOpacity),V.textContent=`阈值 ${t.isoValue.toFixed(2)}:${(S.count/3).toLocaleString()} 个三角形`}},T.onerror=h=>{V.textContent=`Worker 错误:${h.message}`};{const h=e.data.slice();T.postMessage({type:"init",nx:e.dims.nx,ny:e.dims.ny,nz:e.dims.nz,buffer:h.buffer},[h.buffer])}function j(){!B||!t.isoEnabled||(N++,V.textContent=`阈值 ${t.isoValue.toFixed(2)}:计算中…`,T.postMessage({type:"iso",id:N,value:t.isoValue}))}function nt(){clearTimeout(R),R=window.setTimeout(j,150)}n("#chk-iso").addEventListener("change",h=>{t.isoEnabled=h.target.checked,t.isoEnabled?j():(r.setIsoMesh(null,null),V.textContent="未启用"),G()}),n("#rng-iso").addEventListener("input",h=>{t.isoValue=Number(h.target.value),n("#val-iso").textContent=t.isoValue.toFixed(2),nt(),G()}),n("#rng-iso-op").addEventListener("input",h=>{t.isoOpacity=Number(h.target.value),h.target.parentElement.querySelector(".val").textContent=t.isoOpacity.toFixed(2),r.setIsoMeshOpacity(t.isoOpacity),G()});const Y=await bt(e.project.id),K=n("#horizon-list"),J=new Set(Y.map(h=>h.id)),it=()=>{const h=[],S=[];for(const A of Y){if(!J.has(A.id))continue;const w=new Float32Array(A.buffer),L=parseInt(A.color.slice(1),16),O=(L>>16&255)/255,U=(L>>8&255)/255,v=(L&255)/255;for(let E=0;E<e.dims.ny;E++)for(let C=0;C<e.dims.nx;C++){const I=w[C+e.dims.nx*E];if(Number.isNaN(I))continue;const z=r.gridToWorld(C,E,I);h.push(z[0],z[1],z[2]),S.push(O,U,v)}}r.setHorizonPoints(h.length?new Float32Array(h):null,S.length?new Float32Array(S):null)};if(Y.length===0)K.textContent="该工区还没有层位,去「层位解释」页创建";else{K.innerHTML="";for(const h of Y){const S=document.createElement("div");S.className="row",S.innerHTML=`<input type="checkbox" checked/><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${h.color}"></span><span style="font-size:13px">${h.name}</span>`,S.querySelector("input").onchange=A=>{A.target.checked?J.add(h.id):J.delete(h.id),it()},K.appendChild(S)}it()}return n("#btn-shot").onclick=async()=>{const h=await r.screenshot();h&&(ct(h,`${e.project.name}_screenshot.png`),H("截图已导出"))},()=>{T.terminate(),r.destroy()}}const dt=(i,e,t,n,s)=>i[Math.min(e.nx-1,Math.max(0,t))+e.nx*(Math.min(e.ny-1,Math.max(0,n))+e.ny*Math.min(e.nz-1,Math.max(0,s)))];function Le(i,e,t,n,s,o,r,a,l){let d=0,c=0,u=0,b=0,x=0,m=0;for(let y=-l;y<=l;y++){const p=dt(i,e,t,n,s+y),T=dt(i,e,o,r,a+y);d+=p,c+=T,u+=p*p,b+=T*T,x+=p*T,m++}const f=x-d*c/m,g=Math.sqrt((u-d*d/m)*(b-c*c/m));return g<1e-12?0:f/g}function Ht(i,e,t,n,s,o,r,a,l,d,c){let u=-2,b=a;const x=Math.max(d+1,Math.round(a)-l),m=Math.min(e.nz-d-2,Math.round(a)+l);for(let f=x;f<=m;f++){const g=dt(i,e,o,r,f);if(Math.sign(g)!==c&&Math.abs(g)>.05)continue;const p=Le(i,e,t,n,s,o,r,f,d)+.15*Math.abs(g);p>u&&(u=p,b=f)}return{k:b,score:u}}function kt(i,e,t,n,s,o,r){const a=new Float32Array(e.nx).fill(NaN);a[n]=s;const l=Math.sign(dt(i,e,n,t,s))||1;for(const d of[1,-1]){let c=s,u=s,b=n,x=s;for(let m=n+d;m>=0&&m<e.nx;m+=d){let f=c+(c-u);r&&!Number.isNaN(r[m])&&(f=.5*f+.5*r[m]);const g=Ht(i,e,b,t,x,m,t,f,o.searchWin,o.halfWin,l);if(g.score<o.minScore||Math.abs(g.k-c)>o.maxDip)break;a[m]=g.k,u=c,c=g.k,m%4===0&&(b=m,x=g.k)}}return a}function Pe(i,e,t,n,s,o={},r){const a={searchWin:o.searchWin??7,halfWin:o.halfWin??4,maxDip:o.maxDip??6,minScore:o.minScore??.35},l=new Float32Array(e.nx*e.ny).fill(NaN),d=kt(i,e,n,t,s,a);for(let c=0;c<e.nx;c++)l[c+e.nx*n]=d[c];r?.(1/(e.ny+1));for(const c of[1,-1]){let u=d;for(let b=n+c;b>=0&&b<e.ny;b+=c){const x=u[t];if(Number.isNaN(x))break;const m=Math.sign(dt(i,e,t,b-c,Math.round(x)))||1,f=Ht(i,e,t,b-c,Math.round(x),t,b,x,a.searchWin,a.halfWin,m);if(f.score<a.minScore)break;const g=kt(i,e,b,t,f.k,a,u);let y=0;for(let p=0;p<e.nx;p++)Number.isNaN(g[p])||y++;if(y<e.nx*.2)break;for(let p=0;p<e.nx;p++)l[p+e.nx*b]=g[p];u=g,r?.((Math.abs(b-n)+1)/(e.ny-n>n?e.ny-n:n+1)*.5+(c===1?0:.5))}}return r?.(1),l}const Vt=["#ff5d5d","#4dcc7d","#ffb84d","#4da3ff","#c44dff","#4dd0d0"];async function Ie(i){const e=await Ct();if(!e)return location.hash="#/projects",()=>{};const{dims:t,data:n}=e,s=t.nx,o=t.ny,r=t.nz;i.innerHTML=`
    <div class="horizon-layout">
      <div class="horizon-main">
        <div class="horizon-sections">
          <div class="section-cell"><canvas id="sec-inline"></canvas><span class="cell-label" id="lbl-inline"></span></div>
          <div class="section-cell"><canvas id="sec-crossline"></canvas><span class="cell-label" id="lbl-crossline"></span></div>
          <div class="section-cell"><canvas id="sec-timeslice"></canvas><span class="cell-label" id="lbl-timeslice"></span></div>
          <div class="section-cell"><canvas id="sec-3d"></canvas><span class="cell-label">3D 预览(可拖动)</span></div>
        </div>
      </div>
      <div class="sidebar">
        <div class="section">
          <h4>层位</h4>
          <div id="hz-list"></div>
          <div class="row">
            <button id="btn-new-hz" style="flex:1">新建层位</button>
            <button id="btn-del-hz" class="danger">删除</button>
          </div>
          <div class="row"><label>名称</label><input id="hz-name" style="flex:1"/></div>
          <div class="row"><label>颜色</label><input type="color" id="hz-color" style="flex:1;height:28px;padding:2px"/></div>
          <div class="muted" id="hz-stats"></div>
        </div>
        <div class="section">
          <h4>拾取模式</h4>
          <div class="row">
            <button class="mode-btn primary" data-mode="pick" style="flex:1">手动拾取</button>
            <button class="mode-btn" data-mode="seed" style="flex:1">种子点</button>
            <button class="mode-btn" data-mode="erase" style="flex:1">擦除</button>
          </div>
          <div class="muted">在剖面/时间切片上点击操作;种子点显示为白色十字</div>
        </div>
        <div class="section">
          <h4>自动追踪</h4>
          <div class="row"><label>搜索窗</label><input type="range" id="trk-win" min="3" max="15" step="1" value="7"/><span class="val" id="trk-win-v">7</span></div>
          <div class="row"><label>最大倾角</label><input type="range" id="trk-dip" min="2" max="15" step="1" value="6"/><span class="val" id="trk-dip-v">6</span></div>
          <button id="btn-track" class="primary" style="width:100%">从种子点自动追踪</button>
          <div class="muted" id="track-status"></div>
        </div>
        <div class="section">
          <h4>剖面位置</h4>
          <div class="row"><label>Inline(Y)</label><input type="range" id="sl-y" min="0" max="${o-1}" value="${Math.floor(o/2)}"/><span class="val" id="sl-y-v"></span></div>
          <div class="row"><label>Xline(X)</label><input type="range" id="sl-x" min="0" max="${s-1}" value="${Math.floor(s/2)}"/><span class="val" id="sl-x-v"></span></div>
          <div class="row"><label>切片(Z)</label><input type="range" id="sl-z" min="0" max="${r-1}" value="${Math.floor(r/2)}"/><span class="val" id="sl-z-v"></span></div>
        </div>
        <div class="section">
          <div class="muted" id="save-status">已保存(IndexedDB)</div>
        </div>
      </div>
    </div>`;const a=v=>i.querySelector(v);let l=await bt(e.project.id),d=l[0]?.id??null,c=new Float32Array(s*o).fill(NaN),u=[],b="pick",x=Math.floor(s/2),m=Math.floor(o/2),f=Math.floor(r/2),g=!1;const y=gt(ot(e.settings.colormapId),[{t:0,o:1},{t:1,o:1}]);function p(){return l.find(v=>v.id===d)}function T(){const v=p();c=v?new Float32Array(v.buffer.slice(0)):new Float32Array(s*o).fill(NaN),u=[],V()}let B=0;function N(){g=!0,a("#save-status").textContent="未保存…",clearTimeout(B),B=window.setTimeout(R,800)}async function R(){const v=p();!v||!g||(v.buffer=c.slice().buffer,v.updated=Date.now(),await Rt(v),g=!1,a("#save-status").textContent=`已保存 ${new Date().toLocaleTimeString()}`)}function V(){const v=a("#hz-list");v.innerHTML="",l.length===0&&(v.innerHTML='<div class="muted">还没有层位,点击「新建层位」</div>');for(const C of l){const I=document.createElement("div");I.className="cm-item"+(C.id===d?" active":""),I.innerHTML=`<span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${C.color}"></span><span class="cm-name">${C.name}</span>`,I.onclick=()=>{R().then(()=>{d=C.id,T(),h()})},v.appendChild(I)}const E=p();a("#hz-name").value=E?.name??"",a("#hz-color").value=E?.color??"#ff5d5d",j()}function j(){let v=0;for(let E=0;E<c.length;E++)Number.isNaN(c[E])||v++;a("#hz-stats").textContent=p()?`已拾取 ${v.toLocaleString()} / ${(s*o).toLocaleString()} 个CDP(${(100*v/(s*o)).toFixed(1)}%)`:""}a("#btn-new-hz").onclick=async()=>{await R();const v={id:pt(),projectId:e.project.id,name:`层位-${l.length+1}`,color:Vt[l.length%Vt.length],buffer:new Float32Array(s*o).fill(NaN).buffer,updated:Date.now()};await Rt(v),l.push(v),d=v.id,T(),h()},a("#btn-del-hz").onclick=async()=>{const v=p();!v||!confirm(`删除层位「${v.name}」?`)||(await Jt(v.id),l=l.filter(E=>E.id!==v.id),d=l[0]?.id??null,T(),h())},a("#hz-name").addEventListener("change",()=>{const v=p();v&&(v.name=a("#hz-name").value||v.name,g=!0,N(),V())}),a("#hz-color").addEventListener("input",()=>{const v=p();v&&(v.color=a("#hz-color").value,g=!0,N(),h())}),i.querySelectorAll(".mode-btn").forEach(v=>{v.onclick=()=>{b=v.dataset.mode,i.querySelectorAll(".mode-btn").forEach(E=>E.classList.toggle("primary",E===v))}});function nt(v,E){const C=Math.min(2,window.devicePixelRatio||1),I=Math.max(8,Math.floor(v.clientWidth*C)),z=Math.max(8,Math.floor(v.clientHeight*C));(v.width!==I||v.height!==z)&&(v.width=I,v.height=z);const M=v.getContext("2d"),D=E==="inline"?s:E==="crossline"?o:s,_=E==="inline"||E==="crossline"?r:o,k=new ImageData(D,_),q=k.data;for(let $=0;$<_;$++)for(let F=0;F<D;F++){let W;E==="inline"?W=F+s*(m+o*$):E==="crossline"?W=x+s*(F+o*$):W=F+s*($+o*f);const at=Math.max(-1,Math.min(1,n[W])),xt=Math.round((at*.5+.5)*255)*4,ut=(F+D*$)*4;q[ut]=y[xt],q[ut+1]=y[xt+1],q[ut+2]=y[xt+2],q[ut+3]=255}const tt=document.createElement("canvas");tt.width=D,tt.height=_,tt.getContext("2d").putImageData(k,0,0),M.imageSmoothingEnabled=!0,M.drawImage(tt,0,0,I,z);const et=p(),X=I/D,Q=z/_;if(et)if(M.fillStyle=et.color,E==="inline")for(let $=0;$<s;$++){const F=c[$+s*m];Number.isNaN(F)||(M.beginPath(),M.arc($*X,F*Q,2.2*C,0,7),M.fill())}else if(E==="crossline")for(let $=0;$<o;$++){const F=c[x+s*$];Number.isNaN(F)||(M.beginPath(),M.arc($*X,F*Q,2.2*C,0,7),M.fill())}else for(let $=0;$<o;$++)for(let F=0;F<s;F++){const W=c[F+s*$];!Number.isNaN(W)&&Math.abs(W-f)<1.5&&(M.beginPath(),M.arc(F*X,$*Q,2.2*C,0,7),M.fill())}M.strokeStyle="#fff",M.lineWidth=1.5*C;for(const $ of u){let F=-1,W=-1;if(E==="inline"&&$.y===m?(F=$.x*X,W=$.z*Q):E==="crossline"&&$.x===x?(F=$.y*X,W=$.z*Q):E==="timeslice"&&Math.abs($.z-f)<1.5&&(F=$.x*X,W=$.y*Q),F>=0){const at=5*C;M.beginPath(),M.moveTo(F-at,W),M.lineTo(F+at,W),M.moveTo(F,W-at),M.lineTo(F,W+at),M.stroke()}}M.strokeStyle="rgba(255,255,255,0.25)",M.lineWidth=1,M.beginPath(),E==="inline"?(M.moveTo(x*X,0),M.lineTo(x*X,z),M.moveTo(0,f*Q),M.lineTo(I,f*Q)):E==="crossline"?(M.moveTo(m*X,0),M.lineTo(m*X,z),M.moveTo(0,f*Q),M.lineTo(I,f*Q)):(M.moveTo(x*X,0),M.lineTo(x*X,z),M.moveTo(0,m*Q),M.lineTo(I,m*Q)),M.stroke()}const Y=a("#sec-inline"),K=a("#sec-crossline"),J=a("#sec-timeslice");function it(){a("#lbl-inline").textContent=`Inline 剖面 Y=${m}`,a("#lbl-crossline").textContent=`Crossline 剖面 X=${x}`,a("#lbl-timeslice").textContent=`时间切片 Z=${f}`,a("#sl-x").value=String(x),a("#sl-y").value=String(m),a("#sl-z").value=String(f),a("#sl-x-v").textContent=String(x),a("#sl-y-v").textContent=String(m),a("#sl-z-v").textContent=String(f)}function h(){nt(Y,"inline"),nt(K,"crossline"),nt(J,"timeslice"),it(),j(),O()}function S(v,E,C){if(!p()){H("请先新建一个层位");return}const I=v.getBoundingClientRect(),z=(C.clientX-I.left)/I.width,M=(C.clientY-I.top)/I.height;let D=x,_=m,k=f;if(E==="inline"?(D=Math.round(z*(s-1)),k=Math.round(M*(r-1))):E==="crossline"?(_=Math.round(z*(o-1)),k=Math.round(M*(r-1))):(D=Math.round(z*(s-1)),_=Math.round(M*(o-1))),D=Math.max(0,Math.min(s-1,D)),_=Math.max(0,Math.min(o-1,_)),k=Math.max(0,Math.min(r-1,k)),b==="pick")c[D+s*_]=k,N();else if(b==="seed")u.push({x:D,y:_,z:k}),u.length>8&&u.shift(),H(`种子点 (${D}, ${_}, ${k}),共 ${u.length} 个`);else{for(let q=-3;q<=3;q++)for(let tt=-3;tt<=3;tt++){const et=D+tt,X=_+q;et>=0&&et<s&&X>=0&&X<o&&(c[et+s*X]=NaN)}N()}h()}Y.addEventListener("click",v=>S(Y,"inline",v)),K.addEventListener("click",v=>S(K,"crossline",v)),J.addEventListener("click",v=>S(J,"timeslice",v)),a("#sl-x").addEventListener("input",v=>{x=Number(v.target.value),h()}),a("#sl-y").addEventListener("input",v=>{m=Number(v.target.value),h()}),a("#sl-z").addEventListener("input",v=>{f=Number(v.target.value),h()}),a("#trk-win").addEventListener("input",v=>{a("#trk-win-v").textContent=v.target.value}),a("#trk-dip").addEventListener("input",v=>{a("#trk-dip-v").textContent=v.target.value}),a("#btn-track").onclick=async()=>{if(!p()){H("请先新建一个层位");return}if(u.length===0){H("请先用「种子点」模式在剖面上点至少一个种子");return}const v=a("#track-status"),E=a("#btn-track");E.disabled=!0;const C=Number(a("#trk-win").value),I=Number(a("#trk-dip").value);try{for(let z=0;z<u.length;z++){const M=u[z];v.textContent=`追踪种子 ${z+1}/${u.length}…`,await new Promise(k=>setTimeout(k,30));const D=Pe(n,t,M.x,M.y,M.z,{searchWin:C,maxDip:I},k=>{v.textContent=`追踪种子 ${z+1}/${u.length}… ${(k*100).toFixed(0)}%`});let _=0;for(let k=0;k<c.length;k++)Number.isNaN(c[k])&&!Number.isNaN(D[k])&&(c[k]=D[k],_++);v.textContent=`种子 ${z+1} 新增 ${_.toLocaleString()} 个CDP`,h()}N(),v.textContent="追踪完成,已保存",H("自动追踪完成")}finally{E.disabled=!1}};const A=a("#sec-3d"),w=new Lt(A);w.settings={...e.settings,sliceXOn:!1,sliceYOn:!1,sliceZOn:!1,arbOn:!1,isoEnabled:!1},w.setVolume(t,n),w.setLut(gt(ot(e.settings.colormapId),e.settings.opacity)),w.start();let L=0;function O(){clearTimeout(L),L=window.setTimeout(()=>{const v=[],E=[];for(const C of l){const I=C.id===d?c:new Float32Array(C.buffer),z=parseInt(C.color.slice(1),16),M=(z>>16&255)/255,D=(z>>8&255)/255,_=(z&255)/255;for(let k=0;k<o;k++)for(let q=0;q<s;q++){const tt=I[q+s*k];if(Number.isNaN(tt))continue;const et=w.gridToWorld(q,k,tt);v.push(et[0],et[1],et[2]),E.push(M,D,_)}}w.setHorizonPoints(v.length?new Float32Array(v):null,E.length?new Float32Array(E):null)},200)}const U=new ResizeObserver(()=>h());return U.observe(i.querySelector(".horizon-sections")),T(),h(),()=>{U.disconnect(),w.destroy(),R()}}async function Re(i){i.innerHTML=`
    <div class="page">
      <h2>色标编辑</h2>
      <div class="grid2">
        <div class="card">
          <h3>色标库(点击设为当前)</h3>
          <div id="cm-list"></div>
        </div>
        <div class="card">
          <h3>编辑器</h3>
          <div class="muted">拖动控制点调整位置;双击渐变条添加控制点;右键控制点删除(至少保留 2 个)</div>
          <canvas class="cm-canvas" id="cm-editor" width="520" height="120" style="margin:8px 0"></canvas>
          <div class="row">
            <label>选中点颜色</label>
            <input type="color" id="cm-stop-color" style="width:60px;height:28px;padding:2px"/>
            <span class="muted" id="cm-stop-info"></span>
          </div>
          <div class="row">
            <label>名称</label><input id="cm-name" style="flex:1"/>
          </div>
          <div class="row">
            <button class="primary" id="btn-save-cm">保存为自定义色标并启用</button>
            <button class="danger" id="btn-del-cm">删除当前自定义色标</button>
          </div>
        </div>
      </div>
    </div>`;const e=f=>i.querySelector(f),t=e("#cm-editor"),n=t.getContext("2d");let s=structuredClone(ot(vt())),o=null,r=!1;const a=14,l=56;function d(f){return{x:a+f*(t.width-2*a),y:l+30}}function c(f){return`rgb(${f.map(g=>Math.round(g*255)).join(",")})`}function u(){n.clearRect(0,0,t.width,t.height);const f=n.createLinearGradient(a,0,t.width-a,0);for(const g of[...s.stops].sort((y,p)=>y.t-p.t))f.addColorStop(g.t,c(g.color));n.fillStyle=f,n.beginPath(),n.roundRect(a,8,t.width-2*a,l-16,6),n.fill(),n.strokeStyle="#333c49",n.stroke();for(const g of s.stops){const{x:y,y:p}=d(g.t);n.fillStyle=c(g.color),n.beginPath(),n.arc(y,p,9,0,Math.PI*2),n.fill(),n.strokeStyle=g===o?"#4da3ff":"#ffffff",n.lineWidth=g===o?3:1.5,n.stroke(),n.strokeStyle="rgba(255,255,255,0.3)",n.lineWidth=1,n.beginPath(),n.moveTo(y,l),n.lineTo(y,p-9),n.stroke()}e("#cm-stop-info").textContent=o?`位置 ${(o.t*100).toFixed(1)}%`:"未选中控制点",e("#cm-name").value=s.name}function b(f,g){for(const y of s.stops){const p=d(y.t);if(Math.hypot(p.x-f,p.y-g)<12)return y}return null}const x=f=>{const g=t.getBoundingClientRect();return{x:(f.clientX-g.left)*(t.width/g.width),y:(f.clientY-g.top)*(t.height/g.height)}};t.addEventListener("pointerdown",f=>{const{x:g,y}=x(f),p=b(g,y);p&&(o=p,r=!0,t.setPointerCapture(f.pointerId),e("#cm-stop-color").value="#"+p.color.map(T=>Math.round(T*255).toString(16).padStart(2,"0")).join(""),u())}),t.addEventListener("pointermove",f=>{if(!r||!o)return;const{x:g}=x(f);o.t=Math.max(0,Math.min(1,(g-a)/(t.width-2*a))),u()}),t.addEventListener("pointerup",()=>{r=!1}),t.addEventListener("dblclick",f=>{const{x:g,y}=x(f);if(y>l||b(g,y))return;const p=Math.max(0,Math.min(1,(g-a)/(t.width-2*a))),T=[...s.stops].sort((R,V)=>R.t-V.t);let B=[1,1,1];for(let R=0;R<T.length-1;R++)if(p>=T[R].t&&p<=T[R+1].t){const V=(p-T[R].t)/Math.max(1e-6,T[R+1].t-T[R].t);B=[0,1,2].map(j=>T[R].color[j]+V*(T[R+1].color[j]-T[R].color[j]));break}const N={t:p,color:B};s.stops.push(N),o=N,u()}),t.addEventListener("contextmenu",f=>{f.preventDefault();const{x:g,y}=x(f),p=b(g,y);p&&s.stops.length>2&&(s.stops=s.stops.filter(T=>T!==p),o===p&&(o=null),u())}),e("#cm-stop-color").addEventListener("input",()=>{if(!o)return;const f=e("#cm-stop-color").value;o.color=[parseInt(f.slice(1,3),16)/255,parseInt(f.slice(3,5),16)/255,parseInt(f.slice(5,7),16)/255],u()}),e("#btn-save-cm").onclick=()=>{const f=e("#cm-name").value.trim()||"自定义色标",y={id:rt().find(p=>!p.builtin&&p.name===f)?.id??pt(),name:f,stops:[...s.stops].sort((p,T)=>p.t-T.t).map(p=>({...p}))};re(y),Et(y.id),s=structuredClone(y),H(`色标「${f}」已保存并设为当前`),m(),u()},e("#btn-del-cm").onclick=()=>{if(s.builtin||!rt().some(f=>f.id===s.id&&!f.builtin)){H("内置色标不能删除");return}le(s.id),s=structuredClone(rt()[0]),Et(s.id),H("已删除"),m(),u()};function m(){const f=e("#cm-list");f.innerHTML="";const g=vt();for(const y of rt()){const p=document.createElement("div");p.className="cm-item"+(y.id===g?" active":""),p.innerHTML=`
        <div class="cm-swatch" style="background:${ce(y)}"></div>
        <span class="cm-name">${y.name}${y.builtin?"":" (自定义)"}</span>`,p.onclick=()=>{Et(y.id),s=structuredClone(ot(y.id)),o=null,m(),u(),H(`「${y.name}」已设为当前色标`)},f.appendChild(p)}}return m(),u(),()=>{}}async function ze(i){const e=await Ct();if(!e)return location.hash="#/projects",()=>{};const{dims:t,project:n}=e;i.innerHTML=`
    <div class="page">
      <h2>导出 — ${n.name}</h2>
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
            <tr><td>尺寸</td><td>${t.nx} × ${t.ny} × ${t.nz}</td></tr>
            <tr><td>数据量</td><td>${mt(n.byteSize)}</td></tr>
            <tr><td>采样间隔</td><td>${n.sampleIntervalUs?n.sampleIntervalUs/1e3+" ms":"2 ms(默认)"}</td></tr>
            <tr><td>振幅范围</td><td>[${n.minVal.toExponential(2)}, ${n.maxVal.toExponential(2)}]</td></tr>
          </table>
        </div>
      </div>
    </div>`;const s=u=>i.querySelector(u),o=s("#shot-canvas"),r=new Lt(o);r.settings=e.settings,r.setVolume(t,e.data),r.setLut(gt(ot(e.settings.colormapId),e.settings.opacity)),r.start(),s("#btn-shot").onclick=async()=>{const u=await r.screenshot();u&&(ct(u,`${n.name}_screenshot.png`),H("截图已导出"))};const a=await bt(n.id),l=(n.sampleIntervalUs??2e3)/1e3;function d(u){const b=new Float32Array(u.buffer),x=["inline,crossline,z_sample,twt_ms,x_m,y_m"];for(let m=0;m<t.ny;m++)for(let f=0;f<t.nx;f++){const g=b[f+t.nx*m];Number.isNaN(g)||x.push(`${f+1},${m+1},${g.toFixed(2)},${(g*l).toFixed(2)},${f*25},${m*25}`)}return x.join(`
`)}const c=s("#hz-export-list");if(a.length===0)c.innerHTML='<div class="muted">该工区还没有层位,去「层位解释」页拾取</div>',s("#btn-export-all").disabled=!0;else{for(const u of a){const b=new Float32Array(u.buffer);let x=0;for(let g=0;g<b.length;g++)Number.isNaN(b[g])||x++;const m=document.createElement("div");m.className="row",m.innerHTML=`
        <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${u.color}"></span>
        <span style="flex:1;font-size:13px">${u.name}(${x.toLocaleString()} 点)</span>`;const f=document.createElement("button");f.textContent="下载 CSV",f.onclick=()=>{ct(new Blob([d(u)],{type:"text/csv"}),`${n.name}_${u.name}.csv`),H(`层位「${u.name}」已导出`)},m.appendChild(f),c.appendChild(m)}s("#btn-export-all").onclick=()=>{for(const u of a)ct(new Blob([d(u)],{type:"text/csv"}),`${n.name}_${u.name}.csv`);H(`已导出 ${a.length} 个层位`)}}return()=>{r.destroy()}}let ft=null;const Ne={projects:Ut,viewer:Ce,horizon:Ie,colormap:Re,export:ze};async function Xt(){const e=(location.hash.replace(/^#\/?/,"")||"projects").split("/")[0],t=Ne[e]??Ut;ft&&(ft(),ft=null);const n=document.getElementById("app");n.innerHTML="",document.querySelectorAll("#nav a").forEach(s=>{s.classList.toggle("active",s.dataset.route===e)}),ft=await t(n),Bt()}window.addEventListener("hashchange",Xt);Xt();
