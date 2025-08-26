// injector_3000.js — Injector 3000 (compact + CSS + API fill) — v1.2
(() => {
    if (!window.CT || !CT.__ready) { console.error('CT core manquant. Injecte ct_core.js d’abord.'); return; }

    // si une instance existe encore affichée, on la rouvre
    if (window.__injector3000 && typeof window.__injector3000.open === 'function') {
        try {
            const stillThere = document.querySelector('.ct-app-injector');
            if (stillThere) { window.__injector3000.open(); return; }
        } catch {}
    }

    // ---------- UI ----------
    const ui = CT.win.create({
        id: 'ct-injector',
        title: 'Injector 3000',
        size: [198, 221],
        pos: [60, 120],
        scroll: 'hidden',
        className: 'ct-app-injector'
    });
    ui.onClose(() => { try { window.__injector3000 = undefined; } catch {} });

    // ---------- CSS ----------
    const EXTRA_CSS = `
  .ct-app-injector .ct-row { gap: 8px; }
  .ct-app-injector .ct-igroup input { padding: 4px 9px; }
  .ct-igroup select {
    border: 0; border-left: 1px solid #223051; background: transparent; color: #eaeefc;
    padding: 4px 4px; outline: none; width: 54px; appearance: none; text-align: center;
  }
  .ct-app-injector .ct-igroup select { width: 37px; }
  .ct-btn { border-radius: 999px; border: 1px solid #2a4b7a; padding: 2px 12px; cursor: pointer; }
  .ct-app-injector .footer { justify-content: flex-end; padding-top: 0px; }
  `;
    const st = document.createElement('style'); st.textContent = EXTRA_CSS; document.head.appendChild(st);

    // ---------- Form ----------
    function makeRow(iconSrc){
        const row = document.createElement('div'); row.className='ct-row';
        const ico = document.createElement('img'); ico.src = iconSrc; ico.style.width='16px'; ico.style.height='16px';
        const grp = document.createElement('div'); grp.className='ct-igroup';
        const inp = document.createElement('input'); inp.type='text'; inp.inputMode='decimal'; inp.placeholder='0';
        const sel = document.createElement('select');
        ['u','k','M','G','T'].forEach(u=>{ const o=document.createElement('option'); o.value=u; o.textContent=u; sel.appendChild(o); });
        sel.value='u';
        grp.append(inp, sel); row.append(ico, grp);
        return { row, inp, sel };
    }

    const rM = makeRow(CT.ico.M);
    const rT = makeRow(CT.ico.T);
    const rP = makeRow(CT.ico.P);
    const rH = makeRow(CT.ico.H);

    const footer = document.createElement('div'); footer.className='ct-row footer';
    const btn = document.createElement('button'); btn.textContent='Injecter'; btn.className='ct-btn ct-btn-primary';
    footer.append(btn);

    ui.body.append(rM.row, rT.row, rP.row, rH.row, footer);

    // ---------- Helpers ----------
    function setField(sel, v){
        const el = document.querySelector(sel); if(!el) return false;
        el.value = String(v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    // ---------- Logic ----------
    function inject(){
        const plan = [
            { s:'#FResM', v: Math.floor(CT.num.to(rM.inp.value) * CT.units.factor(rM.sel.value)) },
            { s:'#FResT', v: Math.floor(CT.num.to(rT.inp.value) * CT.units.factor(rT.sel.value)) },
            { s:'#FResP', v: Math.floor(CT.num.to(rP.inp.value) * CT.units.factor(rP.sel.value)) },
            { s:'#FResH', v: Math.floor(CT.num.to(rH.inp.value) * CT.units.factor(rH.sel.value)) },
        ];
        plan.forEach(p => setField(p.s, p.v));
        try { if (typeof window.FTotal === 'function') window.FTotal(); } catch{}
    }

    btn.onclick = inject;
    [rM.inp, rT.inp, rP.inp, rH.inp].forEach(i => i.addEventListener('keydown', e => { if(e.key==='Enter') inject(); }));

    // ---------- API publique + écouteur d’évènement ----------
    function fill(values = {}){
        const M = Math.max(0, Number(values.M) || 0);
        const T = Math.max(0, Number(values.T) || 0);
        const P = Math.max(0, Number(values.P) || 0);
        const H = Math.max(0, Number(values.H) || 0);

        rM.sel.value = 'u'; rM.inp.value = String(M);
        rT.sel.value = 'u'; rT.inp.value = String(T);
        rP.sel.value = 'u'; rP.inp.value = String(P);
        rH.sel.value = 'u'; rH.inp.value = String(H);

        // notifie les listeners éventuels
        [rM.inp, rT.inp, rP.inp, rH.inp].forEach(inp => {
            inp.dispatchEvent(new Event('input', { bubbles:true }));
            inp.dispatchEvent(new Event('change', { bubbles:true }));
        });
    }

    window.addEventListener('CT:InjectorFill', (e) => {
        try {
            const vals = (e && e.detail) || {};
            ui.bringToFront?.();
            fill(vals);
        } catch {}
    });

    window.__injector3000 = {
        open(){ ui.setSize(198, 221); ui.bringToFront?.(); },
        fill,   // <-- nouvelle API
    };
})();
