// carte_scanner_v1.js — CarteSys Scanner (V1 : CdR + Épaves uniquement)

(() => {
    // --- anti-double-injection
    if (window.__carteScanner && typeof window.__carteScanner.open === 'function') {
        window.__carteScanner.open();
        return;
    }
    window.__carteScanner = {};

    // --- dépendance core
    if (!window.CT || !CT.__ready) {
        console.error('CT core manquant. Injecte ct_core.js d’abord.');
        return;
    }

    // ---------- Utils ----------
    const NAMES_SYS = ['SYS','Sys','sys'];

    const toNum = v => {
        if (v == null || v === '') return 0;
        const n = Number(String(v).replace(',', '.'));
        return Number.isFinite(n) ? n : 0;
    };

    const abbr = n => {
        if (!Number.isFinite(n)) return '';
        const sign = n < 0 ? '-' : '';
        n = Math.abs(n);
        const u = ['','k','M','G','T'];
        let i = 0;
        while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
        const v = n >= 100 ? Math.round(n) : (n >= 10 ? Math.round(n*10)/10 : Math.round(n*100)/100);
        return `${sign}${v}${u[i]}`;
    };

    // Accepte Array ou objet “type tableau” avec Data/indices numériques
    function isSysShape(obj){
        try{
            if (!obj || typeof obj !== 'object') return false;
            if (Array.isArray(obj)) return Number.isFinite(obj.length) && obj.length >= 1;
            return !!obj.Data || Object.keys(obj).some(k => /^\d+$/.test(k));
        }catch{ return false; }
    }

    // ---------- Recherche de frames ----------
    function findProgramme(){
        const topWin = window.top || window;
        try{
            for (let i=0;i<topWin.frames.length;i++){
                const f = topWin.frames[i];
                try{ if (f.name === 'Programme') return f; }catch{}
            }
        }catch{}
        try{
            const q = [topWin]; const seen = new Set();
            while(q.length){
                const w = q.shift();
                if (!w || seen.has(w)) continue;
                seen.add(w);
                try{
                    const href = w.location?.href || '';
                    if (/\/CelestusV2\/Programme\//.test(href)) return w;
                }catch{}
                try{ for (let i=0;i<w.frames.length;i++) q.push(w.frames[i]); }catch{}
            }
        }catch{}
        return null;
    }

    function getSysFromFrame(w){
        for (const k of NAMES_SYS){
            try{
                if (k in w && isSysShape(w[k])) return { holder:w, varName:k };
            }catch{}
        }
        return null;
    }

    function locateSysHolder(){
        const topWin = window.top || window;

        let f = getSysFromFrame(window);
        if (f) return { ...f, origin:'Interface' };

        const prog = findProgramme();
        if (prog){
            f = getSysFromFrame(prog);
            if (f) return { ...f, origin:'Programme' };
        }

        f = getSysFromFrame(topWin);
        if (f) return { ...f, origin:'top' };

        try{
            const q = [topWin]; const seen = new Set();
            while(q.length){
                const w = q.shift();
                if (!w || seen.has(w)) continue;
                seen.add(w);
                const hit = getSysFromFrame(w);
                if (hit) return { ...hit, origin: w.name || 'frame' };
                try{ for (let i=0;i<w.frames.length;i++) q.push(w.frames[i]); }catch{}
            }
        }catch{}
        return { holder:null, varName:'', origin:'' };
    }

    function programmeHref(){
        const p = findProgramme();
        try { return p?.location?.href || ''; } catch { return ''; }
    }

    const isCarteSysURL = href => /\/CelestusV2\/Programme\/CarteSys\.php\b/.test(String(href||''));

    // ---------- Analyse de Sys (V1 : CdR + Épaves uniquement) ----------
    function analyzeSys(sys){
        const entries = [];
        if (!sys || typeof sys !== 'object') return { entries, sysName:'' };

        let sysName = '';
        try { sysName = String(sys.Data?.Nom || ''); } catch{}

        const max = Array.isArray(sys) ? Math.max(16, Number(sys.length||0)) : 16;

        for (let i=0;i<max;i++){
            const slot = sys[i];
            if (!Array.isArray(slot) || slot.length===0) continue;

            let cdrM=0, cdrT=0, cdrP=0, epaves=0;

            slot.forEach(o=>{
                if (!o || typeof o !== 'object') return;
                cdrM += toNum(o.CdRM);
                cdrT += toNum(o.CdRT);
                cdrP += toNum(o.CdRP);
                epaves += toNum(o.Epaves);
            });

            // On n’affiche la ligne que s’il y a quelque chose (>0)
            if ((cdrM+cdrT+cdrP)>0 || epaves>0){
                entries.push({
                    pos: i+1,
                    cdrM, cdrT, cdrP,
                    epaves
                });
            }
        }
        return { entries, sysName };
    }

    // ---------- UI ----------
    const ui = CT.win.create({
        id: 'ct-carte-scanner',
        title: 'La Gitanie',
        size: [420, 300],
        pos: [48, 86],
        scroll: 'auto',
        className: 'ct-app-carte-scanner'
    });

    const CSS = `
  .ct-app-carte-scanner .gx-head{display:flex;justify-content:space-between;align-items:center;margin:4px 0 8px}
  .ct-app-carte-scanner .gx-badge{display:inline-block;padding:2px 8px;border-radius:999px;border:1px solid #2a365a;background:#151c2f}
  .ct-app-carte-scanner .gx-list{display:flex;flex-direction:column;gap:6px}
  .ct-app-carte-scanner .gx-row{display:flex;gap:8px;align-items:flex-start;border:1px solid #223051;background:#0b1120;border-radius:10px;padding:6px 8px}
  .ct-app-carte-scanner .gx-pos{min-width:56px;font-weight:700;opacity:.95}
  .ct-app-carte-scanner .gx-items{display:flex;flex-wrap:wrap;gap:6px}
  .ct-app-carte-scanner .gx-chip{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:999px;background:#121a31;border:1px solid #223051}
  .ct-app-carte-scanner .gx-muted{opacity:.7}
  `;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    ui.onClose(()=>{ try{st.remove();}catch{} try{stopReloc?.();}catch{} try{stopSysObs?.();}catch{} try{window.__carteScanner=undefined;}catch{} });

    const head = document.createElement('div'); head.className = 'gx-head';
    const sysNameEl = document.createElement('span'); sysNameEl.className = 'gx-badge'; sysNameEl.textContent = '—';
    const statusEl = document.createElement('span'); statusEl.className = 'gx-badge gx-muted'; statusEl.textContent = 'En attente…';
    head.append(sysNameEl, statusEl);

    const list = document.createElement('div'); list.className = 'gx-list';
    ui.body.append(head, list);

    function renderEmpty(msg){
        list.innerHTML = `<div class="gx-row"><div class="gx-pos">—</div><div class="gx-items gx-muted">${msg||'Aucun élément détecté.'}</div></div>`;
    }

    // ---------- Cycle de rendu ----------
    let sysHolder = null;   // fenêtre qui possède Sys
    let sysVar = '';        // 'Sys' / 'SYS' / 'sys'
    let stopReloc = null;   // observeur relocalisation
    let stopSysObs = null;  // observeur sur Sys (deep)

    const readSys = () => {
        try { return sysHolder ? sysHolder[sysVar] : null; } catch { return null; }
    };

    function renderFromSys(){
        const sys = readSys();
        if (!isSysShape(sys)) {
            sysNameEl.textContent = '—';
            statusEl.textContent = 'SYS indisponible';
            renderEmpty('SYS indisponible');
            return;
        }
        const { entries, sysName } = analyzeSys(sys);
        sysNameEl.textContent = sysName ? `Système : ${sysName}` : 'Système';
        statusEl.textContent = `Détections : ${entries.length}`;

        if (!entries.length){ renderEmpty('Rien de notable.'); return; }

        list.innerHTML = entries.map(e=>{
            const chips = [];
            if (e.cdrM || e.cdrT || e.cdrP){
                const parts = [];
                if (e.cdrM) parts.push(`M:${abbr(e.cdrM)}`);
                if (e.cdrT) parts.push(`T:${abbr(e.cdrT)}`);
                if (e.cdrP) parts.push(`P:${abbr(e.cdrP)}`);
                chips.push(`<span class="gx-chip">CdR ${parts.join(' ')}</span>`);
            }
            if (e.epaves) chips.push(`<span class="gx-chip">Épaves: ${abbr(e.epaves)}</span>`);
            return `<div class="gx-row">
        <div class="gx-pos">Pos ${e.pos}</div>
        <div class="gx-items">${chips.join('')}</div>
      </div>`;
        }).join('');
    }

    function startSysObserver(){
        stopSysObs?.();
        stopSysObs = CT.observe(
            () => { try { return JSON.stringify(readSys()); } catch { return ''; } },
            renderFromSys,
            { interval: 1300, signature:'deep' }
        );
        renderFromSys();
    }

    function relocateSys(){
        const href = programmeHref();
        const onCarte = isCarteSysURL(href);

        const need = (!sysHolder || !isSysShape(readSys()) || onCarte);
        if (need){
            const found = locateSysHolder();
            sysHolder = found.holder || null;
            sysVar    = found.varName || '';
            if (!sysHolder || !sysVar){
                statusEl.textContent = onCarte ? 'CarteSys : SYS introuvable' : 'Hors CarteSys';
                renderEmpty(onCarte ? 'SYS pas encore injecté…' : 'Ouvre CarteSys pour scanner.');
                stopSysObs?.();
                return;
            }
            startSysObserver();
        }
    }

    // Observe régulièrement : changement d’URL Programme + (re)localisation de Sys
    stopReloc = CT.observe(
        () => `${programmeHref()}|${Date.now()>>14}`, // tick ~1s
        relocateSys,
        { interval: 1200 }
    );

    // Première passe
    relocateSys();
    ui.bringToFront?.();

    // API
    window.__carteScanner = { open(){ ui.bringToFront?.(); renderFromSys(); } };
})();
