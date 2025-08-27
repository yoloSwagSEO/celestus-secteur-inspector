// colonies_manager.js — CT.win + colonne Fav (checkbox à droite) + menu colonnes FIX (affichage/toggle + z-index)
// .cx-pm = manque d'énergie (ResET < ResEU) ; .cx-pop = manque de population (ResHU > ResHT)
// Colonne "Population" (used/dispo) à gauche de "Production", valeur rouge si dépassement, affichage abrégé via abbr()
(() => {
    // --- anti-double-injection
    if (window.__coloniesManager && typeof window.__coloniesManager.open === 'function') {
        window.__coloniesManager.open();
        return;
    }
    window.__coloniesManager = {};

    // --- dépendance core
    if (!window.CT || !CT.__ready) {
        console.error('CT core manquant. Injecte ct_core.js d’abord.');
        return;
    }

    // ---------- Helpers ----------
    const toNum = v => {
        if (v === null || v === undefined || v === '') return null;
        const n = Number(String(v).replace(',', '.'));
        return Number.isFinite(n) ? n : null;
    };
    const abbr = (n) => {
        if (n === null || n === undefined || !Number.isFinite(n)) return '';
        const sign = n < 0 ? '-' : '';
        n = Math.abs(n);
        const units = ['','k','M','G','T'];
        let u = 0;
        while (n >= 1000 && u < units.length - 1) { n /= 1000; u++; }
        const val = n >= 100 ? Math.round(n) : (n >= 10 ? Math.round(n*10)/10 : Math.round(n*100)/100);
        return `${sign}${val}${units[u]}`;
    };
    const fmtRemain = ms => {
        let s = Math.max(0, Math.floor(ms/1000));
        const d = Math.floor(s / 86400); s -= d*86400;
        const h = Math.floor(s / 3600);  s -= h*3600;
        const m = Math.floor(s / 60);    s -= m*60;
        const parts = [];
        if (d > 0) parts.push(`${d}j`);
        if (h > 0) parts.push(`${h}h`);
        if (m > 0) parts.push(`${m}min`);
        parts.push(`${s}s`);
        return parts.join(' ');
    };
    const icon = {
        M: CT.ico?.M || 'https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/ResM.png',
        T: CT.ico?.T || 'https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/ResT.png',
        P: CT.ico?.P || 'https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/ResP.png',
        TC: CT.ico?.TC || 'https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/TC.png',
    };
    const thumb = id => `https://horizon.celestus.fr/CelestusV2/Interface/Decors/Planetes/thumbnails/${id}.png`;

    function hasCompetence(id){
        try{
            const j = (window.Joueur || {});
            const arr = j.Competences ?? j['Competences'] ?? [];
            if (!Array.isArray(arr)) return false;
            const sid = String(id);
            return arr.some(v => v != null && String(v).trim() === sid);
        }catch{ return false; }
    }

    // ---------- Fav store ----------
    const FAV_KEY = 'favorites:v1';
    function getFavs(){
        try{ const v = CT.store.get(FAV_KEY, []); return Array.isArray(v)?v:[]; }catch{ return []; }
    }
    function isFav(kind, id){
        const key = `${kind}:${id}`;
        return getFavs().some(f => `${f.kind}:${f.id}` === key);
    }
    function addFav(entry){
        const cur = getFavs();
        const key = `${entry.kind}:${entry.id}`;
        if (!cur.some(f => `${f.kind}:${f.id}` === key)) {
            cur.push(entry);
            try{ CT.store.set(FAV_KEY, cur); window.dispatchEvent(new CustomEvent('ct:fav:changed')); }catch{}
        }
    }
    function removeFav(kind, id){
        const key = `${kind}:${id}`;
        const next = getFavs().filter(f => `${f.kind}:${f.id}` !== key);
        try{ CT.store.set(FAV_KEY, next); window.dispatchEvent(new CustomEvent('ct:fav:changed')); }catch{}
    }

    function sid() {
        try { return (window.Joueur && window.Joueur.Session) ? window.Joueur.Session : ''; } catch { return ''; }
    }

    // ---------- Définitions vaisseaux ----------
    const SHIP_DEFS = (() => {
        const defs = new Map();
        const src = window.Vaisseaux || {};
        try {
            Reflect.ownKeys(src).forEach(k => {
                try { const v = src[k]; const code = String((v?.Code ?? k) || ''); if (code) defs.set(code, v); } catch {}
            });
        } catch {}
        return defs;
    })();
    const MODULE_CODES = new Set(['M1','M4','M1M','M1MH','M1T','M1TH']);

    // ---------- Mappings Bâtiments ----------
    const BUILDING_CODES = [
        'BatAS','BatAc','BatCI','BatCO','BatCR','BatCS','BatCa','BatE','BatGF','BatH','BatM','BatMC',
        'BatME','BatP','BatPM','BatRa','BatSP','BatT','BatTE','BatTech','BatTechB','BatUC'
    ];
    function buildBatNameMap() {
        const src = window.Batiments || {};
        const m = new Map();
        try {
            BUILDING_CODES.forEach(code => {
                const v = src[code];
                const name = (v && typeof v === 'object')
                    ? (v.Nom ?? (Array.isArray(v) ? v[0]?.Nom : undefined))
                    : undefined;
                m.set(code, String(name || code));
            });
        } catch {}
        return m;
    }
    let BAT_NAMES = buildBatNameMap();

    // ---------- Lecture Colonies ----------
    function computeFleet(c){
        let total = 0;
        const breakdown = [];
        const addShip = (code, qty) => {
            const n = toNum(qty) || 0; if (!n) return;
            if (!SHIP_DEFS.has(code)) return;
            total += n;
            const def = SHIP_DEFS.get(code) || {};
            const name = def.Nom || def.NomC || def.NomCourt || code;
            const it = breakdown.find(x => x.code === code);
            if (it) it.qty += n; else breakdown.push({ code, name, qty: n });
        };
        try{
            if (Array.isArray(c.ListeVais)) {
                c.ListeVais.forEach(it=>{
                    if (!it) return;
                    if (typeof it === 'object') {
                        const code = String(it.Code ?? it.code ?? it[0] ?? '');
                        const qty  = toNum(it.Nb ?? it.nb ?? it.Qte ?? it.qty ?? it[1] ?? it.Nombre ?? it.nombre);
                        if (code) addShip(code, qty);
                    }
                });
            }
        }catch{}
        try{
            Object.entries(c).forEach(([code, val])=>{
                if (!val) return;
                const n = toNum(val); if (!n) return;
                const cc = String(code);
                if (MODULE_CODES.has(cc)) return;
                if (!SHIP_DEFS.has(cc)) return;
                addShip(cc, n);
            });
        }catch{}
        breakdown.sort((a,b)=>b.qty-a.qty);
        return { total, breakdown };
    }

    let rows = [];
    function buildRowsFromWindow(){
        BAT_NAMES = buildBatNameMap();
        const raw = (window.Colonies ?? {});
        const newRows = [];

        const HAS_COMP_26 = hasCompetence(26);

        Object.entries(raw).forEach(([key, v]) => {
            if (typeof key !== 'string' || !key.includes(':')) return;
            const c = {}; try { for (const kk in v) c[kk] = v[kk]; } catch {}

            const ID = c.ID ? String(c.ID) : '';
            const Nom = c.Nom ? String(c.Nom) : '';
            const Adresse = c.Adresse ? String(c.Adresse) : key;
            const IMG = c.IMG ? String(c.IMG) : '';
            const Type = c.Type ? String(c.Type) : '';

            const PlaceU = toNum(c.PlaceU) || 0;
            const PlaceTBase = toNum(c.PlaceT) || 0;
            const BatMC = toNum(c.BatMC) || 0;
            const perMeta = HAS_COMP_26 ? 60 : 50;
            const PlaceTAdj = PlaceTBase + BatMC * perMeta;

            const ProdM = toNum(c.ProdM);
            const ProdT = toNum(c.ProdT);
            const ProdP = toNum(c.ProdP);
            const ResM  = toNum(c.ResM);
            const ResT  = toNum(c.ResT);
            const ResP  = toNum(c.ResP);

            // Statuts énergie / population
            const ResET = toNum(c.ResET) || 0; // énergie totale
            const ResEU = toNum(c.ResEU) || 0; // énergie utilisée
            const ResHT = toNum(c.ResHT) || 0; // population dispo
            const ResHU = toNum(c.ResHU) || 0; // population utilisée

            const TC = toNum(c.TC);

            const ConstBat  = c.ConstBat ? String(c.ConstBat) : '';
            const ConstTemps = toNum(c.ConstTemps);
            let buildName = ''; let buildLevel = null; let endTs = null;
            if (ConstBat) {
                buildName = (buildBatNameMap().get(ConstBat)) || ConstBat;
                const curLvl = toNum(c[ConstBat]);
                buildLevel = (curLvl||0) + 1;
                if (Number.isFinite(ConstTemps)) endTs = ConstTemps * 1000;
            }

            const levels = {};
            BUILDING_CODES.forEach(code => { levels[code] = toNum(c[code]) || 0; });

            const fleet = computeFleet(c);

            newRows.push({
                RowKey: key,
                ID, Nom, Adresse, IMG, Type,
                PlaceU, PlaceT: PlaceTAdj, PlaceTBase, BatMC, perMeta,
                ProdM, ProdT, ProdP,
                ResM, ResT, ResP,
                ResET, ResEU, ResHT, ResHU,
                TC,
                ConstBat, buildName, buildLevel, endTs,
                FleetTotal: fleet.total,
                FleetBreakdown: fleet.breakdown,
                ...levels
            });
        });

        rows = newRows;
    }

    // ---------- UI (via CT.win) ----------
    const ui = CT.win.create({
        id: 'ct-colonies',
        title: 'Colonies Manager',
        size: [1280, 600],
        pos: [70, 90],
        scroll: 'auto',
        className: 'ct-app-colonies'
    });
    ui.onClose(()=> {
        try{ if (countdownTimer) clearInterval(countdownTimer); }catch{}
        try{ st.remove(); colMenuEl.remove(); tipEl.remove(); }catch{}
        try{ window.__coloniesManager = undefined; }catch{}
    });

    // CSS spécifique
    const CSS = `
  .ct-app-colonies .cx-controls{display:flex;justify-content:space-between;align-items:center;margin:8px 0 12px}
  .ct-app-colonies .cx-left{display:flex;gap:10px;align-items:center}
  .ct-app-colonies .cx-right{display:flex;gap:10px;align-items:center}
  .ct-app-colonies .cx-input{padding:8px 10px;border-radius:999px;border:1px solid #2a365a;background:#0b1120;color:#eaeefc;min-width:260px}
  .ct-app-colonies .cx-btn{padding:8px 12px;border-radius:999px;border:1px solid #2a365a;background:#18213a;color:#eaeefc;cursor:pointer}
  .ct-app-colonies .cx-btn:hover{background:#1d2947}

  .ct-app-colonies .cx-table{width:100%;border-collapse:separate;border-spacing:0}
  .ct-app-colonies .cx-table thead th{position:sticky;top:0;background:#151c2f;border-bottom:1px solid #263251;padding:10px 8px;text-align:center;z-index:1}
  .ct-app-colonies .cx-table tbody tr{position:relative}
  .ct-app-colonies .cx-table tbody td{border-bottom:1px solid #1a233c;padding:10px 8px;vertical-align:middle;text-align:center;background:transparent}

  .ct-app-colonies .cx-thumb{width:60px;height:48px;border-radius:8px;object-fit:cover;border:1px solid #223051}
  .ct-app-colonies .cx-imgwrap{display:flex;align-items:center;gap:6px;justify-content:center}
  .ct-app-colonies .cx-rac{display:inline-block;height:48px;width:18px;background:url('https://horizon.celestus.fr/CelestusV2/Interface/Skin/Boutons/RacPlanete.png') center/contain no-repeat;border-radius:4px}
  .ct-app-colonies .cx-green{color:#53e08f;font-weight:700}
  .ct-app-colonies .cx-red{color:#ff6b6b;font-weight:700}
  .ct-app-colonies .cx-badge{display:inline-block;padding:2px 6px;border-radius:6px;background:#1a2240;border:1px solid #2f3d6a}

  .ct-app-colonies .cx-actions a{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;background:#1a2240;border:1px solid #2f3d6a;margin-right:6px}
  .ct-app-colonies .cx-actions a:hover{background:#202a52}
  .ct-app-colonies .cx-actions img{width:18px;height:18px}

  /* MENU COLONNES */
  .ct-app-colonies .cx-colmenu{
    position:fixed;
    background:#151c2f;border:1px solid #3a4a7a;border-radius:10px;
    padding:10px;display:none;flex-direction:column;gap:6px;z-index:2147483647;
    box-shadow:0 12px 30px rgba(0,0,0,.5);
    max-height:70vh; overflow-y:auto;
  }
  .ct-app-colonies .cx-colmenu label{white-space:nowrap;display:flex;gap:8px;align-items:center}

  .ct-app-colonies .cx-addrname{display:flex;flex-direction:column;align-items:flex-start}
  .ct-app-colonies .cx-addrname .nm{display:inline-flex;gap:8px;align-items:center;font-weight:700;margin-bottom:3px}
  .ct-app-colonies .cx-has-tip{cursor:help}

  .ct-app-colonies .cx-chip{display:inline-block;padding:1px 6px;border-radius:999px;font-size:12px;line-height:18px;border:1px solid transparent}
  .ct-app-colonies .cx-chip-pm{background:rgba(98,176,255,.12);border-color:rgba(98,176,255,.4);color:#a9d6ff}

  /* .cx-pm = manque d'énergie */
  .ct-app-colonies .cx-pm{
    background:linear-gradient(90deg, rgba(98,176,255,.10) 0%, rgba(98,176,255,.04) 40%, rgba(0,0,0,0) 100%);
    box-shadow: inset 3px 0 0 rgba(62,164,255,.95);
  }

  /* .cx-pop = manque de population */
  .ct-app-colonies .cx-pop{
    background: linear-gradient(90deg, rgb(255 98 98 / 10%) 0%, rgba(98, 176, 255, .04) 40%, rgba(0, 0, 0, 0) 100%);
    box-shadow: inset 3px 0 0 rgb(255 62 62 / 95%);
  }

  /* Fav checkbox compact (colonne à droite) */
  .ct-app-colonies .cx-favcell{width:42px}
  .ct-app-colonies .cx-favcheck{display:inline-flex;align-items:center;justify-content:center}
  .ct-app-colonies .cx-favcheck input{width:16px;height:16px;cursor:pointer}
  `;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

    // Tooltip
    const tipEl = document.createElement('div');
    tipEl.style.cssText = `
    position:fixed; z-index:2147483647; display:none; max-width:340px;
    background:#0f1422; border:1px solid #3a4a7a; border-radius:10px;
    box-shadow:0 10px 30px rgba(0,0,0,.5); padding:10px; color:#eaeefc; font:12px/1.35 system-ui,Segoe UI,Arial;
  `;
    const tipList = document.createElement('div'); tipEl.appendChild(tipList);
    document.body.appendChild(tipEl);
    function showTip(html, x, y){
        tipList.innerHTML = html;
        tipEl.style.display = 'block';
        const r = tipEl.getBoundingClientRect();
        let left = x + 12, top = y + 12;
        if (left + r.width > window.innerWidth - 8) left = Math.max(8, x - r.width - 12);
        if (top + r.height > window.innerHeight - 8) top = Math.max(8, y - r.height - 12);
        tipEl.style.left = `${left}px`; tipEl.style.top  = `${top}px`;
    }
    function hideTip(){ tipEl.style.display = 'none'; }

    // Controls
    const controlsEl = document.createElement('div'); controlsEl.className='cx-controls';
    const leftEl = document.createElement('div'); leftEl.className='cx-left';
    const rightEl = document.createElement('div'); rightEl.className='cx-right';

    const searchEl = document.createElement('input'); searchEl.className='cx-input'; searchEl.placeholder='Recherche nom/adresse…';
    leftEl.append(searchEl);

    const btnRefresh = document.createElement('button'); btnRefresh.className='cx-btn'; btnRefresh.title='Rafraîchir'; btnRefresh.textContent='🔄';
    const btnCsv = document.createElement('button'); btnCsv.className='cx-btn'; btnCsv.textContent='📥 Export CSV';
    const btnCols = document.createElement('button'); btnCols.className='cx-btn'; btnCols.textContent='⚙ Colonnes';
    const btnDbg = document.createElement('button'); btnDbg.className='cx-btn'; btnDbg.textContent='🐞 Debug';
    rightEl.append(btnRefresh, btnCsv, btnCols, btnDbg);
    controlsEl.append(leftEl, rightEl);

    // --- Persistences colonnes
    const COLS_LS_KEY = 'colonies_cols_v6';

    function buildLabel(code){ return (BAT_NAMES.get(code) || code); }
    const headers = [
        {label:'', key:'IMG', show:true, menuLabel:'Image/Ciblage', csvLabel:'IMG'},
        {label:'Adresse', key:'Adresse', show:true, menuLabel:'Adresse', csvLabel:'Adresse'},
        {label:'Construction en cours', key:'Build', show:true, menuLabel:'Construction', csvLabel:'Construction'},
        ...BUILDING_CODES.map(code => ({
            label: (buildLabel(code)), key: code, show:false, menuLabel: buildLabel(code), csvLabel: buildLabel(code)
        })),
        {labelHTML:`<img src="${icon.TC}" alt="TC" title="Technocité" width="16" height="16">`,
            key:'TC', show:true, menuLabel:'Technocité', csvLabel:'TC'},
        {label:'Cases', key:'Cases', show:true, menuLabel:'Cases', csvLabel:'Cases'},
        {label:'Population', key:'Pop', show:true, menuLabel:'Population', csvLabel:'Population'},
        {label:'Production', key:'ProdGroup', show:true, menuLabel:'Production', csvLabel:'Production'},
        {label:'Stock', key:'StockGroup', show:true, menuLabel:'Stock', csvLabel:'Stock'},
        {label:'Flotte', key:'Flotte', show:true, menuLabel:'Flotte', csvLabel:'Flotte'},
        {label:'Action', key:'Action', show:true, menuLabel:'Action', csvLabel:'Action'},
        {label:'Fav', key:'Fav', show:true, menuLabel:'Favori (checkbox)', csvLabel:'Fav'},
    ];

    function saveCols(){
        try{
            const map = {};
            headers.forEach(h => { map[h.key] = !!h.show; });
            localStorage.setItem(COLS_LS_KEY, JSON.stringify(map));
        }catch{}
    }
    function loadCols(){
        try{
            const raw = localStorage.getItem(COLS_LS_KEY);
            if (!raw) return;
            const map = JSON.parse(raw);
            headers.forEach(h=>{
                if (Object.prototype.hasOwnProperty.call(map, h.key)) {
                    h.show = !!map[h.key];
                }
            });
        }catch{}
    }
    loadCols();

    // Table (thead mappé par key -> th)
    const tableEl = document.createElement('table'); tableEl.className='cx-table';
    const theadEl = document.createElement('thead'); const trh = document.createElement('tr');
    const thByKey = new Map();
    headers.forEach(h=>{
        const th = document.createElement('th');
        th.dataset.key = h.key;
        if (h.labelHTML) th.innerHTML = h.labelHTML; else th.textContent = h.label || '';
        if (h.key === 'Fav') th.classList.add('cx-favcell');
        trh.appendChild(th);
        thByKey.set(h.key, th);
    });
    theadEl.appendChild(trh);
    const tbodyEl = document.createElement('tbody');
    tableEl.append(theadEl, tbodyEl);

    function applyHeaderVisibility(){
        headers.forEach(h=>{
            const th = thByKey.get(h.key);
            if (!th) return;
            if (h.labelHTML) th.innerHTML = h.labelHTML; else th.textContent = h.label || '';
            th.style.display = h.show ? '' : 'none';
        });
    }

    // ===== MENU COLONNES (FIX) =====
    const colMenuEl = document.createElement('div');
    colMenuEl.className='cx-colmenu';
    colMenuEl.style.position = 'fixed';
    colMenuEl.style.display = 'none';
    colMenuEl.style.zIndex = '2147483647';
    ui.root.appendChild(colMenuEl);

    function buildColMenu(){
        headers.forEach(h=>{ if (BUILDING_CODES.includes(h.key)) h.label = buildLabel(h.key); });

        colMenuEl.innerHTML = '';
        headers.forEach((h)=>{
            const lbl=document.createElement('label');
            const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=h.show;
            cb.onchange=()=>{ h.show = cb.checked; saveCols(); applyHeaderVisibility(); render(); };
            const nameForMenu = h.menuLabel || h.label || h.key;
            lbl.append(cb, document.createTextNode(' '+nameForMenu));
            colMenuEl.appendChild(lbl);
        });

        const r = btnCols.getBoundingClientRect();
        let top = r.bottom + 8;
        let left = r.left;
        colMenuEl.style.display = 'flex';
        const mr = colMenuEl.getBoundingClientRect();
        if (left + mr.width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - mr.width - 8);
        if (top + mr.height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - mr.height - 8);
        colMenuEl.style.left = left+'px';
        colMenuEl.style.top  = top+'px';
    }
    const hideColMenu = () => { colMenuEl.style.display='none'; };

    // ---------- Rendu ----------
    function render(){
        applyHeaderVisibility();
        tbodyEl.innerHTML='';
        const q = (searchEl.value||'').trim().toLowerCase();

        const filtered = rows.filter(r=>{
            if (!q) return true;
            return (r.Nom||'').toLowerCase().includes(q) || (r.Adresse||'').toLowerCase().includes(q);
        });

        filtered.forEach(r=>{
            const tr = document.createElement('tr');

            // Highlights
            if ((r.ResET || 0) < (r.ResEU || 0)) tr.classList.add('cx-pm');   // manque d'énergie
            if ((r.ResHT || 0) < (r.ResHU || 0)) tr.classList.add('cx-pop');  // manque de population

            headers.forEach(h=>{
                if (!h.show) return;
                const td = document.createElement('td');
                if (h.key === 'Fav') td.classList.add('cx-favcell');

                switch(h.key){
                    case 'IMG': {
                        const wrap = document.createElement('div'); wrap.className='cx-imgwrap';
                        const aRac = document.createElement('a');
                        aRac.className = 'cx-rac';
                        aRac.href = `javascript:RemplirChampsPlanete('racourcis_colonies','${String(r.RowKey).replace(/'/g,"\\'")}')`;
                        aRac.title = 'Cibler la planète';
                        wrap.appendChild(aRac);
                        if (r.IMG) {
                            const im = document.createElement('img');
                            im.className='cx-thumb';
                            im.src = thumb(r.IMG);
                            wrap.appendChild(im);
                        }
                        td.appendChild(wrap);
                        break;
                    }
                    case 'Adresse': {
                        const div = document.createElement('div');
                        div.className = 'cx-addrname';
                        const nm = document.createElement('span'); nm.className='nm';
                        nm.textContent = r.Nom || '';
                        if ((r.Type||'').toUpperCase() === 'PM') {
                            const chip = document.createElement('span');
                            chip.className = 'cx-chip cx-chip-pm';
                            chip.textContent = 'PM';
                            nm.appendChild(chip);
                        }
                        const link = document.createElement('a'); link.href = `../Programme/Planete.php?ID=${r.ID||''}&Serv=1`; link.target='Programme';
                        link.textContent = r.Adresse || '';
                        div.append(nm, link);
                        td.appendChild(div);
                        break;
                    }
                    case 'Build': {
                        if (!r.ConstBat || !r.endTs) {
                            td.textContent = '—';
                        } else {
                            const container = document.createElement('div');
                            const lvlStr = (r.buildLevel!=null) ? String(r.buildLevel) : '';
                            const name = r.buildName || r.ConstBat;
                            const topLine = document.createElement('div');
                            topLine.innerHTML = `<span class="cx-green">${lvlStr}</span> ${name}`;
                            const eta = document.createElement('div');
                            eta.className = 'cx-badge';
                            eta.dataset.endTs = String(r.endTs);
                            const remain = Math.max(0, r.endTs - Date.now());
                            eta.textContent = fmtRemain(remain);
                            container.append(topLine, eta);
                            td.appendChild(container);
                        }
                        break;
                    }
                    case 'TC': {
                        td.textContent = (r.TC!=null) ? String(r.TC) : '';
                        break;
                    }
                    case 'Cases': {
                        const u = r.PlaceU||0, t = r.PlaceT||1;
                        const p = t>0 ? Math.round((u/t)*100) : 0;
                        td.textContent = `${u}/${t} (${p}%)`;
                        if (p > 95) td.classList.add('cx-red');
                        break;
                    }
                    case 'Pop': {
                        const used = r.ResHU || 0;
                        const total = r.ResHT || 0;
                        td.textContent = `${abbr(used)}/${abbr(total)}`;
                        if (used > total) td.classList.add('cx-red');
                        break;
                    }
                    case 'ProdGroup':
                        td.innerHTML = `
              <div><img src="${icon.M}" width="14"> ${r.ProdM!=null?abbr(r.ProdM)+'/h':''}</div>
              <div><img src="${icon.T}" width="14"> ${r.ProdT!=null?abbr(r.ProdT)+'/h':''}</div>
              <div><img src="${icon.P}" width="14"> ${r.ProdP!=null?abbr(r.ProdP)+'/j':''}</div>`;
                        break;
                    case 'StockGroup':
                        td.innerHTML = `
              <div><img src="${icon.M}" width="14"> ${abbr(r.ResM)}</div>
              <div><img src="${icon.T}" width="14"> ${abbr(r.ResT)}</div>
              <div><img src="${icon.P}" width="14"> ${abbr(r.ResP)}</div>`;
                        break;
                    case 'Flotte': {
                        const totalF = r.FleetTotal || 0;
                        td.textContent = abbr(totalF);
                        td.dataset.tipHtml = (r.FleetBreakdown && r.FleetBreakdown.length)
                            ? r.FleetBreakdown.map(it => `<div style="display:flex;justify-content:space-between;gap:12px;"><span>${it.name}</span><span>${it.qty}</span></div>`).join('')
                            : `<div style="display:flex;justify-content:space-between;gap:12px;"><span>Aucun vaisseau</span><span>0</span></div>`;
                        td.classList.add('cx-has-tip');
                        break;
                    }
                    case 'Action': {
                        const S = sid();
                        td.className='cx-actions';
                        td.innerHTML = `
              <a target="Programme" title="Flottes" href="../Programme/Flottes.php?S_id=${S}&IDCible=${r.ID}">
                <img src="https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/UIcoFlotte.png" alt="">
              </a>
              <a target="Programme" title="Récolter" href="../Programme/UniversOrdres.php?S_id=${S}&Ordre=recolter&IDCible=${r.ID}">
                <img src="https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/UIcoRecolter.png" alt="">
              </a>
              <a target="Programme" title="Ordinateur" href="../Programme/UniversOrdres.php?S_id=${S}&Ordre=ordinateur&IDCible=${r.ID}">
                <img src="https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/UIcoOrdinateur.png" alt="">
              </a>`;
                        break;
                    }
                    case 'Fav': {
                        const wrap = document.createElement('div'); wrap.className='cx-favcheck';
                        const cb = document.createElement('input'); cb.type='checkbox';
                        cb.checked = isFav('colony', r.ID);
                        cb.title = cb.checked ? 'Retirer des favoris' : 'Ajouter aux favoris';
                        cb.onchange = () => {
                            if (cb.checked) addFav({ kind:'colony', id:r.ID, rowKey:r.RowKey, adresse:r.Adresse, nom:r.Nom, img:r.IMG });
                            else removeFav('colony', r.ID);
                        };
                        wrap.appendChild(cb);
                        td.appendChild(wrap);
                        break;
                    }
                    default: {
                        if (BUILDING_CODES.includes(h.key)) {
                            const lvl = toNum(r[h.key]) || 0;
                            td.textContent = String(lvl);
                        } else {
                            td.textContent = '';
                        }
                    }
                }
                tr.appendChild(td);
            });
            tbodyEl.appendChild(tr);
        });
    }

    // ---------- Export CSV / JSON ----------
    function exportCSV(){
        const esc = s => `"${String(s??'').replace(/"/g,'""')}"`;
        const headerLabels = headers.map(h=> h.csvLabel || h.label || h.key);
        const keys = headers.map(h=>h.key);

        const valueFor = (r, key) => {
            switch(key){
                case 'IMG': return r.IMG || '';
                case 'Adresse': return `${r.Nom||''} | ${r.Adresse||''}`;
                case 'Build': {
                    if (!r.ConstBat || !r.endTs) return '';
                    const remain = Math.max(0, r.endTs - Date.now());
                    const lvlStr = (r.buildLevel!=null) ? String(r.buildLevel) : '';
                    return `${lvlStr} ${r.buildName||r.ConstBat} — ${fmtRemain(remain)}`;
                }
                case 'TC': return (r.TC!=null) ? String(r.TC) : '';
                case 'Cases': {
                    const u = r.PlaceU||0, t = r.PlaceT||1;
                    const pct = t>0 ? Math.round((u/t)*100) : 0;
                    return `${u}/${t} (${pct}%)`;
                }
                case 'Pop': {
                    const used = r.ResHU || 0;
                    const total = r.ResHT || 0;
                    return `${used}/${total}`;
                }
                case 'ProdGroup': return `M:${r.ProdM||0}/h | T:${r.ProdT||0}/h | P:${r.ProdP||0}/j`;
                case 'StockGroup': return `M:${r.ResM||0} | T:${r.ResT||0} | P:${r.ResP||0}`;
                case 'Flotte': {
                    if (!r.FleetTotal) return '0';
                    const tip = (r.FleetBreakdown||[]).map(it => `${it.name}:${it.qty}`).join(' | ');
                    return `${r.FleetTotal}${tip ? ' — '+tip : ''}`;
                }
                case 'Action': return '';
                case 'Fav': return isFav('colony', r.ID) ? '1' : '0';
                default: {
                    if (BUILDING_CODES.includes(key)) return r[key] ?? '';
                    return r[key] ?? '';
                }
            }
        };

        const lines = rows.map(r=> keys.map(k=>esc(valueFor(r,k))).join(';'));
        const csv = headerLabels.map(esc).join(';')+'\n'+lines.join('\n');

        const a=document.createElement('a');
        a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
        a.download='colonies.csv'; a.click(); URL.revokeObjectURL(a.href);
    }

    function exportJSON(){
        try{
            const src = window.Colonies ?? {};
            const out = {};
            Reflect.ownKeys(src).forEach(k => {
                try{
                    const v = src[k];
                    if (v && typeof v === 'object') {
                        const o = {};
                        for (const kk in v) {
                            const val = v[kk];
                            if (typeof val !== 'function') o[kk] = val;
                        }
                        out[k] = o;
                    } else if (typeof v !== 'function') {
                        out[k] = v;
                    }
                } catch(e){ }
            });
            const rawJson = JSON.stringify(out, null, 2);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([rawJson], {type:'application/json'}));
            a.download = 'colonies_raw.json';
            a.click();
            URL.revokeObjectURL(a.href);
        } catch(e){
            console.error('Dump brut impossible : ', e);
        }
    }

    // ---------- Countdown ----------
    let countdownTimer = null;
    function startCountdownLoop(){
        if (countdownTimer) clearInterval(countdownTimer);
        countdownTimer = setInterval(()=>{
            const now = Date.now();
            tbodyEl.querySelectorAll('.cx-badge[data-end-ts]').forEach(el=>{
                const ts = Number(el.dataset.endTs);
                if (!Number.isFinite(ts)) return;
                const remain = Math.max(0, ts - now);
                el.textContent = fmtRemain(remain);
            });
        }, 1000);
    }

    function doRefresh(){
        buildRowsFromWindow();
        render();
        startCountdownLoop();
    }

    // Tooltip wiring
    function tipAttachFor(el){
        el.addEventListener('mousemove', (e)=>{
            const td = e.target.closest('td.cx-has-tip');
            if (!td || !el.contains(td)) { hideTip(); return; }
            const html = td.dataset.tipHtml || '';
            if (!html) { hideTip(); return; }
            showTip(html, e.clientX, e.clientY);
        });
        el.addEventListener('mouseleave', hideTip);
    }

    // Mount
    const frag = document.createDocumentFragment();
    frag.append(controlsEl, tableEl);
    ui.body.append(frag);

    tipAttachFor(tableEl);
    window.addEventListener('scroll', hideTip, true);

    // Events globaux
    btnRefresh.onclick = doRefresh;
    btnCsv.onclick = exportCSV;
    btnCols.onclick = ()=>{ (colMenuEl.style.display==='flex') ? hideColMenu() : buildColMenu(); };
    btnDbg.onclick  = exportJSON;
    searchEl.oninput = render;

    document.addEventListener('click',(ev)=>{
        // Fermer menu colonnes si clic ailleurs
        if (colMenuEl.style.display==='flex' && !colMenuEl.contains(ev.target) && ev.target!==btnCols) hideColMenu();

        const a = ev.target.closest('a[title="Récolter"], a[href*="Ordre=recolter"]');
        if (a && a.closest('.cx-actions')) {
            ev.preventDefault();
            ev.stopPropagation();
            try{
                const url = new URL(a.href, location.href);
                const id = url.searchParams.get('IDCible');
                if (id) localStorage.setItem('colonies_last_harvest_'+id, String(Date.now()));
            }catch{}
            const target = a.getAttribute('target') || '_self';
            window.open(a.href, target);
        }
    }, true);

    window.addEventListener('ct:fav:changed', render);

    // Initial
    doRefresh();
    ui.bringToFront?.();

    // API
    window.__coloniesManager = {
        open(){ ui.bringToFront?.(); render(); }
    };
})();
