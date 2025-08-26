// resources_bar.js (compact "Stocks" sans sb-where)
(() => {
    // --- anti double injection
    if (window.__stocksBar && typeof window.__stocksBar.open === 'function') {
        window.__stocksBar.open();
        return;
    }
    window.__stocksBar = {};

    // ---------- Helpers ----------
    const toNum = v => {
        if (v === null || v === undefined || v === '') return 0;
        const n = Number(String(v).replace(',', '.'));
        return Number.isFinite(n) ? n : 0;
    };
    const abbr = (n) => {
        if (!Number.isFinite(n)) return '';
        const sign = n < 0 ? '-' : '';
        n = Math.abs(n);
        const units = ['','k','M','G','T'];
        let u = 0;
        while (n >= 1000 && u < units.length - 1) { n /= 1000; u++; }
        const val = n >= 100 ? Math.round(n) : (n >= 10 ? Math.round(n*10)/10 : Math.round(n*100)/100);
        return `${sign}${val}${units[u]}`;
    };
    const icon = {
        M: 'https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/ResM.png',
        T: 'https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/ResT.png',
        P: 'https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/ResP.png'
    };

    // ---------- Lecture des sources ----------
    function sumStocksFrom(obj){
        if (!obj || typeof obj !== 'object') return {M:0,T:0,P:0};
        let M=0,T=0,P=0;
        try{
            Object.entries(obj).forEach(([k,v])=>{
                if (typeof k !== 'string' || !k.includes(':')) return;
                if (!v || typeof v !== 'object') return;
                M += toNum(v.ResM);
                T += toNum(v.ResT);
                P += toNum(v.ResP);
            });
        }catch{}
        return {M,T,P};
    }
    function getGlobalTotals(){
        const c = sumStocksFrom(window.Colonies || {});
        const s = sumStocksFrom(window.Secteurs || {});
        return { M: c.M + s.M, T: c.T + s.T, P: c.P + s.P };
    }

    // Ressources locales depuis Planete['Ressources']
    function readResObject(ro){
        const M = toNum(ro?.M ?? ro?.ResM ?? ro?.Metal ?? ro?.Met);
        const T = toNum(ro?.T ?? ro?.ResT ?? ro?.Tritium ?? ro?.Tri);
        const P = toNum(ro?.P ?? ro?.ResP ?? ro?.PhotoP ?? ro?.Photopiles ?? ro?.PP);
        return {M,T,P};
    }
    function getCurrent(){
        const p = (window.planete || window.Planete || {}) || {};
        const r = p.Ressources ?? p['Ressources'];
        let cur = {M:0,T:0,P:0};
        if (r && typeof r === 'object') cur = readResObject(r);
        else cur = { M: toNum(p.ResM), T: toNum(p.ResT), P: toNum(p.ResP) };
        return cur;
    }

    // ---------- UI ----------
    const css = `
  .sb-win{position:fixed;top:16px;left:16px;min-width:260px;max-width:420px;background:#0f1422;color:#eaeefc;
    font:13px/1.25 system-ui,Segoe UI,Arial;z-index:2147483646;border:1px solid #263251;border-radius:10px;
    display:flex;flex-direction:column;box-shadow:0 10px 28px rgba(0,0,0,.45);user-select:none}
  .sb-head{background:#151c2f;padding:6px 8px;border-bottom:1px solid #263251;display:flex;align-items:center;justify-content:space-between;cursor:move}
  .sb-title{font-weight:700;letter-spacing:.2px;font-size:13px}
  .sb-actions{display:flex;gap:6px;align-items:center}
  .sb-ibtn{width:24px;height:24px;border-radius:7px;background:#222b44;border:1px solid #2a365a;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
  .sb-ibtn:hover{background:#2a365a}
  .sb-ibtn svg{width:14px;height:14px;stroke:#fff}
  .sb-body{padding:6px 8px}
  .sb-row{display:flex;align-items:center;gap:6px;margin:4px 0}
  .sb-label{opacity:.8;font-size:12px;min-width:58px}
  .sb-pill{display:inline-flex;align-items:center;gap:6px;background:#0b1120;border:1px solid #223051;border-radius:8px;
    padding:4px 6px;min-width:86px;justify-content:flex-start}
  .sb-pill img{width:14px;height:14px}
  `;
    const styleEl = document.createElement('style'); styleEl.textContent = css; document.head.appendChild(styleEl);

    const winEl = document.createElement('div'); winEl.className='sb-win';
    const headEl = document.createElement('div'); headEl.className='sb-head';
    const titleEl = document.createElement('div'); titleEl.className='sb-title'; titleEl.textContent='Stocks';

    // Actions (refresh + close)
    const headActions = document.createElement('div'); headActions.className='sb-actions';

    const btnRefresh = document.createElement('button'); btnRefresh.className='sb-ibtn'; btnRefresh.title='Rafraîchir';
    btnRefresh.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="23 4 23 10 17 10"></polyline>
      <polyline points="1 20 1 14 7 14"></polyline>
      <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10"></path>
      <path d="M20.49 15a9 9 0 0 1-14.13 3.36L1 14"></path>
    </svg>`;
    const btnClose = document.createElement('button'); btnClose.className='sb-ibtn'; btnClose.title='Fermer';
    btnClose.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>`;

    headActions.append(btnRefresh, btnClose);
    headEl.append(titleEl, headActions);

    const bodyEl = document.createElement('div'); bodyEl.className='sb-body';

    const rowGlobal = document.createElement('div'); rowGlobal.className='sb-row';
    rowGlobal.innerHTML = `
    <span class="sb-label">Globaux</span>
    <span class="sb-pill sb-gm"><img src="${icon.M}" alt=""><span class="val">—</span></span>
    <span class="sb-pill sb-gt"><img src="${icon.T}" alt=""><span class="val">—</span></span>
    <span class="sb-pill sb-gp"><img src="${icon.P}" alt=""><span class="val">—</span></span>
  `;

    const rowCurrent = document.createElement('div'); rowCurrent.className='sb-row';
    rowCurrent.innerHTML = `
    <span class="sb-label">Courant</span>
    <span class="sb-pill sb-cm"><img src="${icon.M}" alt=""><span class="val">—</span></span>
    <span class="sb-pill sb-ct"><img src="${icon.T}" alt=""><span class="val">—</span></span>
    <span class="sb-pill sb-cp"><img src="${icon.P}" alt=""><span class="val">—</span></span>
  `;

    bodyEl.append(rowGlobal, rowCurrent);
    winEl.append(headEl, bodyEl);
    document.body.appendChild(winEl);

    // ---------- Rendu ----------
    function render(){
        const g = getGlobalTotals();
        rowGlobal.querySelector('.sb-gm .val').textContent = abbr(g.M);
        rowGlobal.querySelector('.sb-gt .val').textContent = abbr(g.T);
        rowGlobal.querySelector('.sb-gp .val').textContent = abbr(g.P);

        const c = getCurrent();
        rowCurrent.querySelector('.sb-cm .val').textContent = abbr(c.M);
        rowCurrent.querySelector('.sb-ct .val').textContent = abbr(c.T);
        rowCurrent.querySelector('.sb-cp .val').textContent = abbr(c.P);
    }

    // ---------- Drag ----------
    let drag=false, dx=0, dy=0;
    headEl.addEventListener('mousedown',e=>{
        if (e.target.closest('button')) return; // pas de drag sur les boutons
        drag=true;
        const rect = winEl.getBoundingClientRect();
        dx = e.clientX - rect.left;
        dy = e.clientY - rect.top;
        e.preventDefault();
    });
    document.addEventListener('mousemove',e=>{
        if(!drag) return;
        const left = Math.max(8, Math.min(e.clientX - dx, window.innerWidth  - winEl.offsetWidth  - 8));
        const top  = Math.max(8, Math.min(e.clientY - dy, window.innerHeight - winEl.offsetHeight - 8));
        winEl.style.left = `${left}px`;
        winEl.style.top  = `${top}px`;
    });
    document.addEventListener('mouseup',()=>drag=false);

    // ---------- Actions ----------
    btnClose.onclick = ()=>{
        try{ window.__stocksBar = undefined; }catch{}
        clearInterval(timer);
        winEl.remove(); styleEl.remove();
    };
    btnRefresh.onclick = ()=> render();

    // ---------- Refresh périodique léger ----------
    let timer = setInterval(render, 3000);
    window.addEventListener('beforeunload', ()=>clearInterval(timer));

    // ---------- Init ----------
    render();

    // API
    window.__stocksBar = {
        open(){ winEl.style.display='flex'; render(); }
    };
})();
