// injector_3000.js — Injector 3000 (ultra-compact)
(() => {
    // --- anti-double-injection
    if (window.__injector3000 && typeof window.__injector3000.open === 'function') {
        window.__injector3000.open();
        return;
    }
    window.__injector3000 = {};

    // ---------- Helpers ----------
    const toNum = v => {
        if (v === null || v === undefined || v === '') return 0;
        const n = Number(String(v).replace(',', '.'));
        return Number.isFinite(n) ? n : 0;
    };
    const unitFactor = u => {
        switch (String(u || '').trim()) {
            case 'u': return 1;
            case 'k': return 1e3;
            case 'M': return 1e6;
            case 'G': return 1e9;
            case 'T': return 1e12;
            default:  return 1;
        }
    };
    const icon = {
        M: 'https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/ResM.png',
        T: 'https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/ResT.png',
        P: 'https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/ResP.png',
        H: 'https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/ResH.png'
    };

    // ---------- UI ----------
    const css = `
  .ixc-win{position:fixed;top:140px;left:70px;width:248px;min-width:228px;background:#0f1422;color:#eaeefc;
    font:12px/1.25 system-ui,Segoe UI,Arial;z-index:2147483630;border:1px solid #263251;border-radius:10px;
    display:flex;flex-direction:column;resize:both;overflow:hidden;box-shadow:0 10px 28px rgba(0,0,0,.45)}
  .ixc-head{background:#151c2f;padding:4px 6px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #263251}
  .ixc-title{font-weight:700;letter-spacing:.2px;font-size:12px}
  .ixc-actions{display:flex;gap:4px;align-items:center}
  .ixc-ibtn{width:20px;height:20px;border-radius:6px;background:#222b44;border:1px solid #2a365a;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
  .ixc-ibtn:hover{background:#2a365a}
  .ixc-ibtn svg{width:12px;height:12px;stroke:#fff}
  .ixc-body{flex:1;overflow:auto;padding:6px}
  .ixc-row{display:grid;grid-template-columns:18px 1fr 44px;gap:6px;align-items:center;margin:4px 0}
  .ixc-ico{width:16px;height:16px;opacity:.95}
  .ixc-input{height:24px;padding:0 8px;border-radius:8px;border:1px solid #223051;background:#0b1120;color:#eaeefc;width:100%;outline:none}
  .ixc-select{height:24px;padding:0 4px;border-radius:8px;border:1px solid #223051;background:#0b1120;color:#eaeefc;outline:none;
    appearance:none;text-align:center}
  .ixc-footer{display:flex;justify-content:flex-end;margin-top:4px}
  .ixc-btn{height:26px;padding:0 10px;border-radius:999px;border:1px solid #2a365a;background:#18213a;color:#eaeefc;cursor:pointer}
  .ixc-btn:hover{background:#1d2947}
  `;
    const styleEl = document.createElement('style'); styleEl.textContent = css; document.head.appendChild(styleEl);

    const winEl = document.createElement('div'); winEl.className='ixc-win';
    const headEl = document.createElement('div'); headEl.className='ixc-head';
    const titleEl = document.createElement('div'); titleEl.className='ixc-title'; titleEl.textContent='Injector 3000';

    const actions = document.createElement('div'); actions.className='ixc-actions';
    const btnMin = document.createElement('button'); btnMin.className='ixc-ibtn'; btnMin.title='Réduire';
    btnMin.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    const btnClose = document.createElement('button'); btnClose.className='ixc-ibtn'; btnClose.title='Fermer';
    btnClose.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>`;
    actions.append(btnMin, btnClose);
    headEl.append(titleEl, actions);

    const bodyEl = document.createElement('div'); bodyEl.className='ixc-body';

    function makeRow(src){
        const row = document.createElement('div'); row.className='ixc-row';
        const ic  = document.createElement('img'); ic.className='ixc-ico'; ic.src = src; ic.alt='';
        const inp = document.createElement('input'); inp.type='text'; inp.inputMode='decimal'; inp.className='ixc-input'; inp.placeholder='0';
        const sel = document.createElement('select'); sel.className='ixc-select';
        ['u','k','M','G','T'].forEach(u => { const o=document.createElement('option'); o.value=u; o.textContent=u; sel.appendChild(o); });
        sel.value = 'u';
        row.append(ic, inp, sel);
        return { row, inp, sel };
    }

    const rM = makeRow(icon.M);
    const rT = makeRow(icon.T);
    const rP = makeRow(icon.P);
    const rH = makeRow(icon.H);

    const footer = document.createElement('div'); footer.className='ixc-footer';
    const btnInject = document.createElement('button'); btnInject.className='ixc-btn'; btnInject.textContent='Injecter';
    footer.append(btnInject);

    bodyEl.append(rM.row, rT.row, rP.row, rH.row, footer);
    winEl.append(headEl, bodyEl);
    document.body.appendChild(winEl);

    // ---------- Injection ----------
    function setFieldValue(el, val){
        if (!el) return false;
        try{
            el.value = String(val);
            el.dispatchEvent(new Event('input', { bubbles:true }));
            el.dispatchEvent(new Event('change', { bubbles:true }));
            return true;
        }catch{ return false; }
    }
    function inject(){
        const plan = [
            { el: document.querySelector('#FResM'), v: Math.floor(toNum(rM.inp.value) * unitFactor(rM.sel.value)) },
            { el: document.querySelector('#FResT'), v: Math.floor(toNum(rT.inp.value) * unitFactor(rT.sel.value)) },
            { el: document.querySelector('#FResP'), v: Math.floor(toNum(rP.inp.value) * unitFactor(rP.sel.value)) },
            { el: document.querySelector('#FResH'), v: Math.floor(toNum(rH.inp.value) * unitFactor(rH.sel.value)) },
        ];
        plan.forEach(p => setFieldValue(p.el, p.v));
        try { if (typeof window.FTotal === 'function') window.FTotal(); } catch {}
    }
    btnInject.onclick = inject;

    // Enter = inject (sur tous les inputs)
    [rM.inp, rT.inp, rP.inp, rH.inp].forEach(inp => {
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') inject(); });
    });

    // ---------- Déplacement / bornage ----------
    const MARGIN = 8;
    function clampPos(left, top) {
        const w = winEl.offsetWidth, h = winEl.offsetHeight;
        const maxLeft = Math.max(MARGIN, window.innerWidth - w - MARGIN);
        const maxTop  = Math.max(MARGIN, window.innerHeight - h - MARGIN);
        return { left: Math.min(Math.max(left, MARGIN), maxLeft), top: Math.min(Math.max(top, MARGIN), maxTop) };
    }
    function clampSize() {
        const rect = winEl.getBoundingClientRect();
        const maxW = Math.max(228, window.innerWidth  - rect.left - MARGIN);
        const maxH = Math.max(120, window.innerHeight - rect.top  - MARGIN);
        if (rect.width  > maxW) winEl.style.width  = `${maxW}px`;
        if (rect.height > maxH) winEl.style.height = `${maxH}px`;
    }
    function clampAll() {
        const r = winEl.getBoundingClientRect();
        const pos = clampPos(r.left, r.top);
        winEl.style.left = `${pos.left}px`; winEl.style.top  = `${pos.top}px`; clampSize();
    }

    let drag=false, dx=0, dy=0;
    headEl.addEventListener('mousedown',e=>{
        if(e.target.closest('button')) return;
        drag=true;
        const rect = winEl.getBoundingClientRect();
        dx = e.clientX - rect.left; dy = e.clientY - rect.top;
        e.preventDefault();
    });
    document.addEventListener('mousemove',e=>{
        if(!drag) return;
        const left = e.clientX - dx, top = e.clientY - dy;
        const pos = clampPos(left, top);
        winEl.style.left = `${pos.left}px`; winEl.style.top = `${pos.top}px`;
    });
    document.addEventListener('mouseup',()=>drag=false);

    if (window.ResizeObserver) { const ro = new ResizeObserver(() => clampSize()); ro.observe(winEl); }
    winEl.addEventListener('mouseup', clampAll);
    window.addEventListener('resize', clampAll);

    // minimize / restore
    let minimized = false;
    const orig = { width: '', height: '', left: '', top: '' };
    function minimizeWindow(){
        if (minimized) return;
        const r = winEl.getBoundingClientRect();
        orig.width = winEl.style.width; orig.height = winEl.style.height;
        orig.left = winEl.style.left; orig.top = winEl.style.top;
        winEl.style.width = '220px'; winEl.style.height = '34px';
        winEl.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 228)) + 'px';
        winEl.style.top  = Math.max(8, Math.min(r.top,  window.innerHeight - 42)) + 'px';
        bodyEl.style.display='none'; minimized = true;
    }
    function restoreWindow(){
        if (!minimized) return;
        winEl.style.width = orig.width || ''; winEl.style.height = orig.height || '';
        winEl.style.left = orig.left || '70px'; winEl.style.top = orig.top || '140px';
        bodyEl.style.display=''; minimized = false; clampAll();
    }
    btnMin.onclick = ()=>{ minimized ? restoreWindow() : minimizeWindow(); };

    // close
    btnClose.onclick=()=>{
        try{ window.__injector3000=undefined; }catch{}
        winEl.remove(); styleEl.remove();
    };

    // init
    requestAnimationFrame(() => { clampAll(); rM.inp.focus(); });

    // API
    window.__injector3000 = {
        open(){ winEl.style.display='flex'; restoreWindow(); clampAll(); rM.inp.focus(); }
    };
})();
