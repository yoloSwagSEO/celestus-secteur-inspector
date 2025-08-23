(() => {
    // --- anti-double-injection
    if (window.__secteursInspector && typeof window.__secteursInspector.open === 'function') {
        window.__secteursInspector.open();
        return;
    }
    window.__secteursInspector = {};

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
    const pct = x => `${Math.round((x||0)*1000)/10}%`;
    const withUnit = (key, v) => {
        const s = abbr(v);
        if (!s) return '';
        if (key === 'ProdM' || key === 'ProdT') return `${s}/h`;
        if ([
            'ProdP','EntretienM','EntretienT','RentaM','RentaT',
            'EntM1M','EntM1T','EntM4M','EntM4T',
            'EntM1MM','EntM1MT','EntM1MHM','EntM1MHT','EntM1TM','EntM1TT','EntM1THM','EntM1THT'
        ].includes(key)) return `${s}/j`;
        return s;
    };
    const icon = {
        M: 'https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/ResM.png',
        T: 'https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/ResT.png',
        P: 'https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/ResP.png'
    };
    const thumb = id => `https://horizon.celestus.fr/CelestusV2/Interface/Decors/Planetes/thumbnails/${id}.png`;

    // Dernière récolte (localStorage)
    const harvestKey = id => `secteur_recolte_${id}`;
    function timeAgoLabel(ts){
        const t = Number(ts);
        if (!Number.isFinite(t)) return 'N/A';
        const diff = Math.max(0, Date.now() - t);
        const s = Math.floor(diff/1000);
        if (s < 60) return `il y a ${s}s`;
        const m = Math.floor(s/60);
        if (m < 60) return `il y a ${m}m`;
        const h = Math.floor(m/60);
        if (h < 24) return `il y a ${h}h`;
        const d = Math.floor(h/24);
        return `il y a ${d}j`;
    }

    // FILON (localStorage)
    const filonKey = id => `filon_${id}`;
    const getFilonLS = (id) => {
        try { const v = localStorage.getItem(filonKey(id)); return v==null?null:toNum(v); } catch { return null; }
    };
    const setFilonLS = (id, val) => {
        try { localStorage.setItem(filonKey(id), String(val)); } catch {}
    };

    // Définitions vaisseaux (window.Vaisseaux)
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
    // Codes modules
    const MODULE_CODES = new Set(['M1','M4','M1M','M1MH','M1T','M1TH']);

    // ---------- Lire Secteurs ----------
    const raw = (window.Secteurs ?? {});
    const rows = [];
    Object.entries(raw).forEach(([k, v]) => {
        if (typeof k !== 'string' || !k.includes(':')) return;
        const o = {}; try { for (const kk in v) o[kk] = v[kk]; } catch {}

        const ProdT = toNum(o.ProdT);
        const ProdM = toNum(o.ProdM);
        const ProdP = toNum(o.ProdP);
        const ResM  = toNum(o.ResM);
        const ResT  = toNum(o.ResT);
        const ResP  = toNum(o.ResP);

        // Modules
        const M1    = toNum(o.M1);
        const M4    = toNum(o.M4);
        const M1M   = toNum(o.M1M);
        const M1MH  = toNum(o.M1MH);
        const M1T   = toNum(o.M1T);
        const M1TH  = toNum(o.M1TH);

        // AIA
        const AIA   = toNum(o.AIA);

        // Entretiens (par jour)
        const EntM1M = (M1||0)*10000;
        const EntM1T = (M1||0)*5000;
        const EntM4M = (M4||0)*20000;
        const EntM4T = (M4||0)*10000;

        const EntM1MM  = (M1M ||0)*10_000_000;
        const EntM1MT  = (M1M ||0)*5_000_000;
        const EntM1MHM = (M1MH||0)*10_000_000;
        const EntM1MHT = (M1MH||0)*5_000_000;
        const EntM1TM  = (M1T ||0)*5_000_000;
        const EntM1TT  = (M1T ||0)*2_500_000;
        const EntM1THM = (M1TH||0)*10_000_000;
        const EntM1THT = (M1TH||0)*5_000_000;

        const EntretienM = EntM1M + EntM4M + EntM1MM + EntM1MHM + EntM1TM + EntM1THM;
        const EntretienT = EntM1T + EntM4T + EntM1MT + EntM1MHT + EntM1TT + EntM1THT;

        const RentaM = (ProdM||0)*24 - EntretienM;
        const RentaT = (ProdT||0)*24 - EntretienT;

        // Flotte (hors modules) – Secteurs
        let FleetTotal = 0;
        const FleetBreakdown = [];
        if (SHIP_DEFS.size){
            Object.entries(o).forEach(([code, val])=>{
                const n = toNum(val); if (!n) return;
                const c = String(code);
                if (MODULE_CODES.has(c)) return;       // exclure modules ici
                if (!SHIP_DEFS.has(c)) return;
                FleetTotal += n;
                const def = SHIP_DEFS.get(c) || {};
                const name = def.Nom || def.NomC || def.NomCourt || c;
                FleetBreakdown.push({ name, qty:n });
            });
            FleetBreakdown.sort((a,b)=>b.qty-a.qty);
        }

        // Flottes AIA (incl. modules)
        let FleetTotalAIA = 0;
        const FleetBreakdownAIA = [];
        if (SHIP_DEFS.size){
            Object.entries(o).forEach(([code, val])=>{
                const n = toNum(val); if (!n) return;
                const c = String(code);
                if (!SHIP_DEFS.has(c)) return;
                FleetTotalAIA += n;
                const def = SHIP_DEFS.get(c) || {};
                const name = def.Nom || def.NomC || def.NomCourt || c;
                FleetBreakdownAIA.push({ name, qty:n, code:c });
            });
            FleetBreakdownAIA.sort((a,b)=>b.qty-a.qty);
        }

        // Entretien base flotte (AIA)
        function perShipMaintM(def){
            const CoutM = Number(def?.CoutM||0);
            const ConsoMult = Number(def?.ConsoMult||1);
            return Math.floor(CoutM * 0.05 * ConsoMult);
        }
        let BaseM = 0, BaseT = 0;
        FleetBreakdownAIA.forEach(it=>{
            const def = SHIP_DEFS.get(it.code) || {};
            const mUnit = perShipMaintM(def);
            const tUnit = Math.floor(0.5 * mUnit);
            BaseM += mUnit * it.qty;
            BaseT += tUnit * it.qty;
        });

        rows.push({
            RowKey: k, // on garde la clé exacte pour RemplirChampsPlanete
            IMG: o.IMG ? String(o.IMG) : '',
            Adresse: o.Adresse||'',
            ID: o.ID ? String(o.ID) : '',
            Type: (String(o.Type||'') === 'Rien' && (AIA||0) > 0) ? 'AIA' : (o.Type||''),
            ProdM, ProdT, ProdP,
            ResM, ResT, ResP,
            // modules
            M1, M4, M1M, M1MH, M1T, M1TH,
            AIA,
            // entretiens
            EntretienM, EntretienT,
            EntM1M, EntM1T, EntM4M, EntM4T,
            EntM1MM, EntM1MT, EntM1MHM, EntM1MHT, EntM1TM, EntM1TT, EntM1THM, EntM1THT,
            // rentabilité
            RentaM, RentaT,
            // flottes
            FleetTotal, FleetBreakdown,
            FleetTotalAIA, FleetBreakdownAIA,
            BaseM, BaseT
        });
    });

    // ---------- UI ----------
    const css = `
  .sx-win{position:fixed;top:40px;left:40px;width:1280px;height:650px;background:#0f1422;color:#eaeefc;font:14px/1.35 system-ui,Segoe UI,Arial;z-index:2147483000;border:1px solid #263251;border-radius:12px;display:flex;flex-direction:column;resize:both;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.45)}
  .sx-head{background:#151c2f;padding:8px 10px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #263251}
  .sx-title{font-weight:700;letter-spacing:.3px}
  .sx-head-actions{display:flex;gap:8px;align-items:center}
  .sx-iconbtn{width:28px;height:28px;border-radius:8px;background:#222b44;border:1px solid #2a365a;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
  .sx-iconbtn:hover{background:#2a365a}
  .sx-iconbtn svg{width:16px;height:16px;stroke:#fff}
  .sx-body{flex:1;overflow:auto;padding:14px}

  .sx-tabs{display:flex;gap:8px;margin:4px 0 10px}
  .sx-tab{padding:6px 10px;border-radius:999px;border:1px solid #2a365a;background:#18213a;color:#eaeefc;cursor:pointer}
  .sx-tab.active{background:#27406e}

  .sx-widgets{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px}
  .sx-card{background:#151c2f;border:1px solid #263251;border-radius:10px;padding:10px}
  .sx-card h3{margin:0 0 8px;font-size:13px;font-weight:700;color:#ffd4a3;text-shadow:0 0 10px rgba(255,212,163,.2)}
  .sx-metric{display:flex;justify-content:space-between;align-items:center;padding:4px 6px;border-radius:8px}
  .sx-metric img{vertical-align:middle;margin-right:6px}

  .sx-controls{display:flex;justify-content:space-between;align-items:center;margin:8px 0 12px}
  .sx-left{display:flex;gap:10px;align-items:center}
  .sx-right{display:flex;gap:10px;align-items:center}
  .sx-input{padding:8px 10px;border-radius:999px;border:1px solid #2a365a;background:#0b1120;color:#eaeefc;min-width:240px}
  .sx-toggle{display:flex;gap:6px;align-items:center;background:#151c2f;border:1px solid #263251;padding:6px 8px;border-radius:999px}
  .sx-btn{padding:8px 12px;border-radius:999px;border:1px solid #2a365a;background:#18213a;color:#eaeefc;cursor:pointer}
  .sx-btn:hover{background:#1d2947}
  .sx-mini-btn{padding:2px 6px;border-radius:8px;border:1px solid #2a365a;background:#1a2240;color:#eaeefc;cursor:pointer;margin-left:6px}
  .sx-mini-btn:hover{background:#202a52}

  .sx-colmenu{
    position:fixed;background:#151c2f;border:1px solid #3a4a7a;border-radius:10px;
    padding:10px;display:none;flex-direction:column;gap:6px;z-index:2147483647;box-shadow:0 12px 30px rgba(0,0,0,.5);
    max-height:70vh; overflow-y:auto;
  }
  .sx-colmenu label{white-space:nowrap;display:flex;gap:8px;align-items:center}

  .sx-table{width:100%;border-collapse:separate;border-spacing:0}
  .sx-table thead th{position:sticky;top:0;background:#151c2f;border-bottom:1px solid #263251;padding:10px 8px;text-align:center}
  .sx-table tbody td{border-bottom:1px solid #1a233c;padding:10px 8px;vertical-align:middle;text-align:center}
  .sx-thumb{width:60px;height:48px;border-radius:8px;object-fit:cover;border:1px solid #223051}
  .sx-green{color:#53e08f;font-weight:700}
  .sx-red{color:#ff6b6b;font-weight:700}
  .sx-actions a{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;background:#1a2240;border:1px solid #2f3d6a;margin-right:6px}
  .sx-actions a:hover{background:#202a52}
  .sx-actions img{width:18px;height:18px}

  /* Tooltip HTML */
  .sx-tip{position:fixed;z-index:2147483647;display:none;max-width:340px;background:#0f1422;border:1px solid #3a4a7a;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.5);padding:10px}
  .sx-tip h4{margin:0 0 6px;font-size:12px;font-weight:700;color:#ffd4a3}
  .sx-tip-list{max-height:220px;overflow:auto}
  .sx-tip-item{display:flex;justify-content:space-between;gap:12px;padding:2px 0}
  .sx-tip-item span:first-child{opacity:.9}
  .sx-tip-item span:last-child{font-weight:700}

  /* Filon coloring */
  .sx-filon{font-weight:700}
  .sx-filon.ok{color:#53e08f}      /* >= 0.90 */
  .sx-filon.warn{color:#f6c26b}    /* [0.80, 0.90) */
  .sx-filon.bad{color:#ff6b6b}     /* < 0.80 */

  /* IMG + bouton Raccourci */
  .sx-imgwrap{display:flex;align-items:center;gap:6px;justify-content:center}
  .sx-rac{display:inline-block;height:48px;width:18px;background:url('https://horizon.celestus.fr/CelestusV2/Interface/Skin/Boutons/RacPlanete.png') center/contain no-repeat;border-radius:4px}
  `;
    const styleEl = document.createElement('style'); styleEl.textContent = css; document.head.appendChild(styleEl);

    // --- fenêtre + en-tête (icônes blanches + réduire)
    const winEl = document.createElement('div'); winEl.className='sx-win';
    const headEl = document.createElement('div'); headEl.className='sx-head';
    const titleEl = document.createElement('div'); titleEl.className='sx-title'; titleEl.textContent = 'Secteurs Inspector';
    const headActions = document.createElement('div'); headActions.className='sx-head-actions';
    const btnMin = document.createElement('button'); btnMin.className='sx-iconbtn'; btnMin.title='Réduire';
    btnMin.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    const btnClose = document.createElement('button'); btnClose.className='sx-iconbtn'; btnClose.title='Fermer';
    btnClose.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>`;
    headActions.append(btnMin, btnClose);
    headEl.append(titleEl, headActions);
    const bodyEl = document.createElement('div'); bodyEl.className='sx-body';

    // Tooltip element
    const tipEl = document.createElement('div');
    tipEl.className = 'sx-tip';
    tipEl.innerHTML = `<h4>Détails</h4><div class="sx-tip-list"></div>`;
    document.body.appendChild(tipEl);
    const tipList = tipEl.querySelector('.sx-tip-list');
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

    // ---- Onglets ----
    const tabsEl = document.createElement('div'); tabsEl.className='sx-tabs';
    const tabSectors = document.createElement('button'); tabSectors.className='sx-tab active'; tabSectors.textContent='Secteurs';
    const tabAIA     = document.createElement('button'); tabAIA.className='sx-tab'; tabAIA.textContent='AIA';
    tabsEl.append(tabSectors, tabAIA);

    // ---- widgets ----
    const widgetsEl = document.createElement('div'); widgetsEl.className='sx-widgets';
    const w1 = document.createElement('div'); w1.className='sx-card';
    const w2 = document.createElement('div'); w2.className='sx-card';
    const w3 = document.createElement('div'); w3.className='sx-card';
    widgetsEl.append(w1,w2,w3);

    const totals = {ProdM:0,ProdT:0,ProdP:0,ResM:0,ResT:0,ResP:0,RentaM:0,RentaT:0};
    rows.forEach(r=>{
        totals.ProdM += r.ProdM||0; totals.ProdT += r.ProdT||0; totals.ProdP += r.ProdP||0;
        totals.ResM += r.ResM||0; totals.ResT += r.ResT||0; totals.ResP += r.ResP||0;
        totals.RentaM += r.RentaM||0; totals.RentaT += r.RentaT||0;
    });
    w1.innerHTML = `<h3>Productions</h3>
    <div class="sx-metric"><span><img src="${icon.M}" width="16">Metal</span><span>${abbr(totals.ProdM)}/h — ${abbr(totals.ProdM*24)}/j</span></div>
    <div class="sx-metric"><span><img src="${icon.T}" width="16">Tritium</span><span>${abbr(totals.ProdT)}/h — ${abbr(totals.ProdT*24)}/j</span></div>
    <div class="sx-metric"><span><img src="${icon.P}" width="16">PhotoP.</span><span>${abbr(totals.ProdP)}/j</span></div>`;
    w2.innerHTML = `<h3>Stock</h3>
    <div class="sx-metric"><span><img src="${icon.M}" width="16">Metal</span><span>${abbr(totals.ResM)}</span></div>
    <div class="sx-metric"><span><img src="${icon.T}" width="16">Tritium</span><span>${abbr(totals.ResT)}</span></div>
    <div class="sx-metric"><span><img src="${icon.P}" width="16">PhotoP.</span><span>${abbr(totals.ResP)}</span></div>`;
    w3.innerHTML = `<h3>Rentabilité</h3>
    <div class="sx-metric"><span><img src="${icon.M}" width="16">Metal</span><span class="${totals.RentaM>=0?'sx-green':'sx-red'}">${abbr(totals.RentaM)}/j</span></div>
    <div class="sx-metric"><span><img src="${icon.T}" width="16">Tritium</span><span class="${totals.RentaT>=0?'sx-green':'sx-red'}">${abbr(totals.RentaT)}/j</span></div>`;

    // ---- controls ----
    const controlsEl = document.createElement('div'); controlsEl.className='sx-controls';
    const leftEl = document.createElement('div'); leftEl.className='sx-left';
    const rightEl = document.createElement('div'); rightEl.className='sx-right';

    const searchEl = document.createElement('input'); searchEl.className='sx-input'; searchEl.placeholder='Recherche adresse…';
    const fMWrap = document.createElement('label'); fMWrap.className='sx-toggle';
    const fM = document.createElement('input'); fM.type='checkbox'; fMWrap.append(fM, document.createTextNode(' Non rentables M'));
    const fTWrap = document.createElement('label'); fTWrap.className='sx-toggle';
    const fT = document.createElement('input'); fT.type='checkbox'; fTWrap.append(fT, document.createTextNode(' Non rentables T'));
    leftEl.append(searchEl, fMWrap, fTWrap);

    const btnRefresh = document.createElement('button'); btnRefresh.className='sx-btn'; btnRefresh.title='Rafraîchir'; btnRefresh.textContent='🔄';
    const btnCsv = document.createElement('button'); btnCsv.className='sx-btn'; btnCsv.textContent='📥 Export CSV';
    const btnCols = document.createElement('button'); btnCols.className='sx-btn'; btnCols.textContent='⚙ Colonnes';
    const btnDbg = document.createElement('button'); btnDbg.className='sx-btn'; btnDbg.textContent='🐞 Debug';
    rightEl.append(btnRefresh, btnCsv, btnCols, btnDbg);
    controlsEl.append(leftEl, rightEl);

    // ---- colonnes (Secteurs) ----
    const headers = [
        {label:'', key:'IMG', show:true},
        {label:'Adresse', key:'Adresse', show:true},
        {label:'Type', key:'Type', show:true},
        {label:'Filon', key:'Filon', show:true},
        {label:'Prod.', key:'ProdGroup', show:true},
        {label:'Prod Metal', key:'ProdM', show:false},
        {label:'Prod Tritium', key:'ProdT', show:false},
        {label:'Prod PhotoP', key:'ProdP', show:false},
        {label:'Stock', key:'StockGroup', show:true},
        {label:'Metal', key:'ResM', show:false},
        {label:'Tritium', key:'ResT', show:false},
        {label:'PhotoP', key:'ResP', show:false},
        {label:'Modules', key:'ModulesGroup', show:true},
        {label:'Mod. Minier', key:'M1', show:false},
        {label:'Concent.', key:'M4', show:false},
        {label:'Extract. Télurique', key:'M1M', show:false},
        {label:'Col. Minière', key:'M1MH', show:false},
        {label:'Extr. Jovien', key:'M1T', show:false},
        {label:'Raf. Mobile', key:'M1TH', show:false},
        {label:'Mod. Minier (ind)', key:'M1_ind', show:false},
        {label:'Concent. (ind)', key:'M4_ind', show:false},
        {label:'Flotte', key:'Flotte', show:true},
        {label:'Entretien', key:'EntGroup', show:true},
        {label:'Entr. Mod. Minier métal', key:'EntM1M', show:false},
        {label:'Entr. Mod. Minier Tritium', key:'EntM1T', show:false},
        {label:'Entr. Concent. métal', key:'EntM4M', show:false},
        {label:'Entr. Concent. Tritium', key:'EntM4T', show:false},
        {label:'Entr. Extract. Télurique métal', key:'EntM1MM', show:false},
        {label:'Entr. Extract. Télurique Tritium', key:'EntM1MT', show:false},
        {label:'Entr. Col. Minière métal', key:'EntM1MHM', show:false},
        {label:'Entr. Col. Minière Tritium', key:'EntM1MHT', show:false},
        {label:'Entr. Extr. Jovien métal', key:'EntM1TM', show:false},
        {label:'Entr. Extr. Jovien Tritium', key:'EntM1TT', show:false},
        {label:'Entr. Raf. Mobile métal', key:'EntM1THM', show:false},
        {label:'Entr. Raf. Mobile Tritium', key:'EntM1THT', show:false},
        {label:'Renta', key:'RentaGroup', show:true},
        {label:'Dernière récolte', key:'LastHarvest', show:true},
        {label:'Action', key:'Action', show:true},
    ];

    // ---- colonnes (AIA) ----
    const headersAIA = [
        {label:'', key:'IMG', show:true},
        {label:'Adresse', key:'Adresse', show:true},
        {label:'Niveau', key:'AIA_lvl', show:true},
        {label:"Entre. Max", key:'AIA_ent', show:true},
        {label:"Bonus", key:'AIA_bonus', show:true},
        {label:'Stocks', key:'AIA_stock', show:true},
        {label:'Flottes', key:'AIA_fleet', show:true},
        {label:'Entr. Base', key:'AIA_base', show:true},
        {label:'Entr. Déduit', key:'AIA_deduct', show:true},
        {label:'Entr.', key:'AIA_rest', show:true},
        {label:'Entr. Dispo', key:'AIA_free', show:true},
        {label:'Charge', key:'AIA_load', show:true},
        {label:'Action', key:'Action', show:true},
    ];

    // ---- menu colonnes ----
    const colMenuEl = document.createElement('div');
    colMenuEl.className='sx-colmenu';
    document.body.appendChild(colMenuEl);
    let activeTab = 'Secteurs';
    function buildColMenu(){
        const cols = activeTab === 'AIA' ? headersAIA : headers;
        colMenuEl.innerHTML = '';
        cols.forEach(h=>{
            const lbl=document.createElement('label');
            const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=h.show;
            cb.onchange=()=>{ h.show = cb.checked; activeTab==='AIA'?renderAIA():renderSectors(); };
            lbl.append(cb, document.createTextNode(' '+(h.label||'Colonne')));
            colMenuEl.appendChild(lbl);
        });
        const r = btnCols.getBoundingClientRect();
        let top = r.bottom + 8, left = r.left;
        colMenuEl.style.display = 'flex';
        const mr = colMenuEl.getBoundingClientRect();
        if (left + mr.width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - mr.width - 8);
        if (top + mr.height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - mr.height - 8);
        colMenuEl.style.left = left+'px'; colMenuEl.style.top = top+'px';
    }
    const hideColMenu = () => { colMenuEl.style.display='none'; };

    // ---- tables ----
    // Secteurs
    const tableEl = document.createElement('table'); tableEl.className='sx-table';
    const theadEl = document.createElement('thead'); const trh = document.createElement('tr');
    headers.forEach(h=>{ const th=document.createElement('th'); th.textContent=h.label; trh.appendChild(th); });
    theadEl.appendChild(trh);
    const tbodyEl = document.createElement('tbody');
    tableEl.append(theadEl, tbodyEl);

    // AIA
    const tableAIA = document.createElement('table'); tableAIA.className='sx-table'; tableAIA.style.display='none';
    const theadA = document.createElement('thead'); const trhA = document.createElement('tr');
    headersAIA.forEach(h=>{ const th=document.createElement('th'); th.textContent=h.label; trhA.appendChild(th); });
    theadA.appendChild(trhA);
    const tbodyA = document.createElement('tbody');
    tableAIA.append(theadA, tbodyA);

    function applyHeaderVisibility(){
        Array.from(trh.children).forEach((th,i)=>{
            th.style.display = headers[i].show ? '' : 'none';
        });
    }
    function applyHeaderVisibilityAIA(){
        Array.from(trhA.children).forEach((th,i)=>{
            th.style.display = headersAIA[i].show ? '' : 'none';
        });
    }

    // ---- render SECTEURS ----
    function renderSectors(){
        applyHeaderVisibility();
        tbodyEl.innerHTML='';
        const q = (searchEl.value||'').trim().toLowerCase();
        const filtered = rows.filter(r=>{
            if (q && !r.Adresse.toLowerCase().includes(q)) return false;
            if (fM.checked && fT.checked) return (r.RentaM<0 && r.RentaT<0);
            if (fM.checked) return (r.RentaM<0);
            if (fT.checked) return (r.RentaT<0);
            return true;
        });

        filtered.forEach(r=>{
            const tr=document.createElement('tr');
            headers.forEach(h=>{
                if(!h.show) return;
                const td=document.createElement('td');
                switch(h.key){
                    case 'IMG': {
                        // lien "raccourci secteur" collé à l'image planète (même colonne)
                        const wrap = document.createElement('div'); wrap.className='sx-imgwrap';
                        const aRac = document.createElement('a');
                        aRac.className = 'sx-rac';
                        aRac.href = `javascript:try{RemplirChampsPlanete('racourcis_secteurs','${String(r.RowKey).replace(/'/g,"\\'")}')}catch(e){console.error('Raccourci secteur : erreur ignorée',e)}`;
                        aRac.title = 'Raccourci secteur';
                        wrap.appendChild(aRac);
                        if (r.IMG) {
                            const im = document.createElement('img');
                            im.className='sx-thumb';
                            im.src = thumb(r.IMG);
                            wrap.appendChild(im);
                        }
                        td.appendChild(wrap);
                        break;
                    }
                    case 'Adresse':
                        td.innerHTML = `<a href="../Programme/Planete.php?ID=${r.ID}&Serv=1" target="Programme">${r.Adresse}</a>`;
                        break;
                    case 'Type':
                        td.textContent = r.Type || '';
                        break;

                    // ---- FILON ----
                    case 'Filon': {
                        const val = getFilonLS(r.ID);
                        if (val !== null && Number.isFinite(val)) {
                            const v = Math.round(val * 100) / 100; // 2 déc.
                            const cls = (val >= 0.90) ? 'ok' : (val >= 0.80 ? 'warn' : 'bad');
                            td.innerHTML = `<span class="sx-filon ${cls}">${v.toFixed(2)}</span>`;
                        } else {
                            td.innerHTML = `N/A <button class="sx-mini-btn sx-filon-refresh" data-id="${r.ID}" title="Récupérer depuis la planète courante">🔄</button>`;
                        }
                        break;
                    }

                    case 'ProdGroup':
                        td.innerHTML = `
              <div><img src="${icon.M}" width="14"> ${withUnit('ProdM',r.ProdM)}</div>
              <div><img src="${icon.T}" width="14"> ${withUnit('ProdT',r.ProdT)}</div>
              <div><img src="${icon.P}" width="14"> ${withUnit('ProdP',r.ProdP)}</div>`;
                        break;
                    case 'StockGroup':
                        td.innerHTML = `
              <div><img src="${icon.M}" width="14"> ${abbr(r.ResM)}</div>
              <div><img src="${icon.T}" width="14"> ${abbr(r.ResT)}</div>
              <div><img src="${icon.P}" width="14"> ${abbr(r.ResP)}</div>`;
                        break;
                    case 'ModulesGroup': {
                        let html = '';
                        if (r.M1)   html += `<div>Mod. Minier: <b>${abbr(r.M1)}</b></div>`;
                        if (r.M4)   html += `<div>Concent.: <b>${abbr(r.M4)}</b></div>`;
                        if (r.M1M)  html += `<div>Extract. Télurique: <b>${abbr(r.M1M)}</b></div>`;
                        if (r.M1MH) html += `<div>Col. Minière: <b>${abbr(r.M1MH)}</b></div>`;
                        if (r.M1T)  html += `<div>Extr. Jovien: <b>${abbr(r.M1T)}</b></div>`;
                        if (r.M1TH) html += `<div>Raf. Mobile: <b>${abbr(r.M1TH)}</b></div>`;
                        td.innerHTML = html;
                        break;
                    }
                    case 'Flotte': {
                        const total = r.FleetTotal || 0;
                        td.textContent = abbr(total);
                        td.dataset.tipHtml = (r.FleetBreakdown && r.FleetBreakdown.length)
                            ? r.FleetBreakdown.map(it => `<div class="sx-tip-item"><span>${it.name}</span><span>${it.qty}</span></div>`).join('')
                            : `<div class="sx-tip-item"><span>Aucun vaisseau</span><span>0</span></div>`;
                        td.classList.add('sx-has-tip'); td.style.cursor = 'help';
                        break;
                    }
                    case 'EntGroup':
                        td.innerHTML = `
              <div><img src="${icon.M}" width="14"> ${withUnit('EntretienM',r.EntretienM)}</div>
              <div><img src="${icon.T}" width="14"> ${withUnit('EntretienT',r.EntretienT)}</div>`;
                        break;
                    case 'RentaGroup':
                        td.innerHTML = `
              <div><img src="${icon.M}" width="14"> <span class="${r.RentaM>=0?'sx-green':'sx-red'}">${withUnit('RentaM',r.RentaM)}</span></div>
              <div><img src="${icon.T}" width="14"> <span class="${r.RentaT>=0?'sx-green':'sx-red'}">${withUnit('RentaT',r.RentaT)}</span></div>`;
                        break;
                    case 'LastHarvest': {
                        let label = 'N/A';
                        try { const ts = localStorage.getItem(harvestKey(r.ID)); label = ts ? timeAgoLabel(ts) : 'N/A'; } catch {}
                        td.textContent = label;
                        break;
                    }

                    // simples (cachés)
                    case 'ProdM': td.textContent = withUnit('ProdM', r.ProdM); break;
                    case 'ProdT': td.textContent = withUnit('ProdT', r.ProdT); break;
                    case 'ProdP': td.textContent = withUnit('ProdP', r.ProdP); break;
                    case 'ResM':  td.textContent = abbr(r.ResM); break;
                    case 'ResT':  td.textContent = abbr(r.ResT); break;
                    case 'ResP':  td.textContent = abbr(r.ResP); break;
                    case 'M1':    td.textContent = abbr(r.M1); break;
                    case 'M4':    td.textContent = abbr(r.M4); break;
                    case 'M1M':   td.textContent = abbr(r.M1M); break;
                    case 'M1MH':  td.textContent = abbr(r.M1MH); break;
                    case 'M1T':   td.textContent = abbr(r.M1T); break;
                    case 'M1TH':  td.textContent = abbr(r.M1TH); break;
                    case 'M1_ind':td.textContent = abbr(r.M1); break;
                    case 'M4_ind':td.textContent = abbr(r.M4); break;

                    // entretiens détaillés (cachés)
                    case 'EntM1M':  td.textContent = withUnit('EntM1M',  r.EntM1M); break;
                    case 'EntM1T':  td.textContent = withUnit('EntM1T',  r.EntM1T); break;
                    case 'EntM4M':  td.textContent = withUnit('EntM4M',  r.EntM4M); break;
                    case 'EntM4T':  td.textContent = withUnit('EntM4T',  r.EntM4T); break;
                    case 'EntM1MM': td.textContent = withUnit('EntM1MM', r.EntM1MM); break;
                    case 'EntM1MT': td.textContent = withUnit('EntM1MT', r.EntM1MT); break;
                    case 'EntM1MHM':td.textContent = withUnit('EntM1MHM',r.EntM1MHM); break;
                    case 'EntM1MHT':td.textContent = withUnit('EntM1MHT',r.EntM1MHT); break;
                    case 'EntM1TM': td.textContent = withUnit('EntM1TM', r.EntM1TM); break;
                    case 'EntM1TT': td.textContent = withUnit('EntM1TT', r.EntM1TT); break;
                    case 'EntM1THM':td.textContent = withUnit('EntM1THM',r.EntM1THM); break;
                    case 'EntM1THT':td.textContent = withUnit('EntM1THT',r.EntM1THT); break;

                    case 'Action': {
                        const sid = (window.Joueur && window.Joueur.Session) ? window.Joueur.Session : '';
                        td.className='sx-actions';
                        td.innerHTML = `
              <a target="Programme" title="Flottes" href="../Programme/Flottes.php?S_id=${sid}&IDCible=${r.ID}">
                <img src="https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/UIcoFlotte.png" alt="">
              </a>
              <a target="Programme" title="Récolter" href="../Programme/UniversOrdres.php?S_id=${sid}&Ordre=recolter&IDCible=${r.ID}">
                <img src="https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/UIcoRecolter.png" alt="">
              </a>
              <a target="Programme" title="Ordinateur" href="../Programme/UniversOrdres.php?S_id=${sid}&Ordre=ordinateur&IDCible=${r.ID}">
                <img src="https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/UIcoOrdinateur.png" alt="">
              </a>`;
                        break;
                    }
                    default: td.textContent = '';
                }
                tr.appendChild(td);
            });
            tbodyEl.appendChild(tr);
        });
    }

    // ---- AIA helpers ----
    function computeAIA(level){
        const lvl = Math.max(0, Number(level)||0);
        const entM = 240_000_000 * Math.sqrt(lvl) * (10 / (Math.pow(lvl,0.75) + 10) + 0.25);
        const entT = entM / 2;
        const bonus = 0.13 * (1 - (0.5 * Math.pow(0.95, lvl)));
        return { entM, entT, bonus };
    }

    // ---- render AIA ----
    function renderAIA(){
        applyHeaderVisibilityAIA();
        tbodyA.innerHTML = '';
        const onlyAIA = rows.filter(r => (r.AIA||0) > 0);
        onlyAIA.forEach(r=>{
            const tr = document.createElement('tr');
            const cap = computeAIA(r.AIA||0);

            // Entr. Base (toute flotte)
            const baseM = r.BaseM||0, baseT = r.BaseT||0;
            const maxDeductM = 0.9 * baseM;
            const maxDeductT = 0.9 * baseT;
            const deductM = Math.min(maxDeductM, cap.entM);
            const deductT = Math.min(maxDeductT, cap.entT);
            const restM = Math.max(0, baseM - deductM);
            const restT = Math.max(0, baseT - deductT);
            const freeM = Math.max(0, cap.entM - deductM);
            const freeT = Math.max(0, cap.entT - deductT);

            // Charge (métal uniquement)
            const load = cap.entM > 0 ? (baseM / cap.entM) : 0;

            headersAIA.forEach(h=>{
                if(!h.show) return;
                const td = document.createElement('td');
                switch(h.key){
                    case 'IMG': {
                        const wrap = document.createElement('div'); wrap.className='sx-imgwrap';
                        const aRac = document.createElement('a');
                        aRac.className = 'sx-rac';
                        aRac.href = `javascript:try{RemplirChampsPlanete('racourcis_secteurs','${String(r.RowKey).replace(/'/g,"\\'")}')}catch(e){console.error('Raccourci secteur : erreur ignorée',e)}`;
                        aRac.title = 'Raccourci secteur';
                        wrap.appendChild(aRac);
                        if (r.IMG) {
                            const im = document.createElement('img');
                            im.className='sx-thumb';
                            im.src = thumb(r.IMG);
                            wrap.appendChild(im);
                        }
                        td.appendChild(wrap);
                        break;
                    }
                    case 'Adresse':
                        td.innerHTML = `<a href="../Programme/Planete.php?ID=${r.ID}&Serv=1" target="Programme">${r.Adresse}</a>`;
                        break;
                    case 'AIA_lvl':
                        td.textContent = String(r.AIA ?? 0);
                        break;
                    case 'AIA_ent':
                        td.innerHTML = `
              <div><img src="${icon.M}" width="14"> ${withUnit('EntretienM',cap.entM)}</div>
              <div><img src="${icon.T}" width="14"> ${withUnit('EntretienT',cap.entT)}</div>`;
                        break;
                    case 'AIA_bonus':
                        td.textContent = pct(cap.bonus);
                        break;
                    case 'AIA_stock':
                        td.innerHTML = `
              <div><img src="${icon.M}" width="14"> ${abbr(r.ResM)}</div>
              <div><img src="${icon.T}" width="14"> ${abbr(r.ResT)}</div>
              <div><img src="${icon.P}" width="14"> ${abbr(r.ResP)}</div>`;
                        break;
                    case 'AIA_fleet': {
                        td.textContent = abbr(r.FleetTotalAIA||0);
                        td.dataset.tipHtml = (r.FleetBreakdownAIA && r.FleetBreakdownAIA.length)
                            ? r.FleetBreakdownAIA.map(it => `<div class="sx-tip-item"><span>${it.name}</span><span>${it.qty}</span></div>`).join('')
                            : `<div class="sx-tip-item"><span>Aucune flotte</span><span>0</span></div>`;
                        td.classList.add('sx-has-tip'); td.style.cursor = 'help';
                        break;
                    }
                    case 'AIA_base':
                        td.innerHTML = `
              <div><img src="${icon.M}" width="14"> ${withUnit('EntretienM',baseM)}</div>
              <div><img src="${icon.T}" width="14"> ${withUnit('EntretienT',baseT)}</div>`;
                        break;
                    case 'AIA_deduct':
                        td.innerHTML = `
              <div><img src="${icon.M}" width="14"> ${withUnit('EntretienM',deductM)}</div>
              <div><img src="${icon.T}" width="14"> ${withUnit('EntretienT',deductT)}</div>`;
                        break;
                    case 'AIA_rest':
                        td.innerHTML = `
              <div><img src="${icon.M}" width="14"> ${withUnit('EntretienM',restM)}</div>
              <div><img src="${icon.T}" width="14"> ${withUnit('EntretienT',restT)}</div>`;
                        break;
                    case 'AIA_free':
                        td.innerHTML = `
              <div><img src="${icon.M}" width="14"> ${withUnit('EntretienM',freeM)}</div>
              <div><img src="${icon.T}" width="14"> ${withUnit('EntretienT',freeT)}</div>`;
                        break;
                    case 'AIA_load':
                        td.innerHTML = `<span class="${load>1?'sx-red':'sx-green'}">${pct(load)}</span>`;
                        break;
                    case 'Action': {
                        const sid = (window.Joueur && window.Joueur.Session) ? window.Joueur.Session : '';
                        td.className='sx-actions';
                        td.innerHTML = `
              <a target="Programme" title="Flottes" href="../Programme/Flottes.php?S_id=${sid}&IDCible=${r.ID}">
                <img src="https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/UIcoFlotte.png" alt="">
              </a>
              <a target="Programme" title="Récolter" href="../Programme/UniversOrdres.php?S_id=${sid}&Ordre=recolter&IDCible=${r.ID}">
                <img src="https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/UIcoRecolter.png" alt="">
              </a>
              <a target="Programme" title="Ordinateur" href="../Programme/UniversOrdres.php?S_id=${sid}&Ordre=ordinateur&IDCible=${r.ID}">
                <img src="https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/UIcoOrdinateur.png" alt="">
              </a>`;
                        break;
                    }
                    default: td.textContent = '';
                }
                tr.appendChild(td);
            });
            tbodyA.appendChild(tr);
        });
    }

    // ---- Export CSV (toutes colonnes, même masquées) ----
    function exportCSV(){
        const esc = s => `"${String(s??'').replace(/"/g,'""')}"`;
        const headerLabels = headers.map(h=>h.label || '');
        const keys = headers.map(h=>h.key);

        const valueFor = (r, key) => {
            switch(key){
                case 'IMG': return r.IMG;
                case 'Adresse': return r.Adresse;
                case 'Type': return r.Type;
                case 'Filon': {
                    const v = getFilonLS(r.ID); return v==null?'':String(v);
                }
                case 'ProdGroup': return `M:${r.ProdM||0}/h | T:${r.ProdT||0}/h | P:${r.ProdP||0}/j`;
                case 'StockGroup': return `M:${r.ResM||0} | T:${r.ResT||0} | P:${r.ResP||0}`;
                case 'ModulesGroup': return [
                    r.M1?`Mod. Minier:${r.M1}`:null,
                    r.M4?`Concent.:${r.M4}`:null,
                    r.M1M?`Extract. Télurique:${r.M1M}`:null,
                    r.M1MH?`Col. Minière:${r.M1MH}`:null,
                    r.M1T?`Extr. Jovien:${r.M1T}`:null,
                    r.M1TH?`Raf. Mobile:${r.M1TH}`:null,
                ].filter(Boolean).join(' | ');
                case 'Flotte': {
                    if (!r.FleetTotal) return 0;
                    const tip = (r.FleetBreakdown||[]).map(it => `${it.name}:${it.qty}`).join(' | ');
                    return `${r.FleetTotal}${tip ? ' — '+tip : ''}`;
                }
                case 'EntGroup': return `M:${r.EntretienM||0}/j | T:${r.EntretienT||0}/j`;
                case 'RentaGroup': return `M:${r.RentaM||0}/j | T:${r.RentaT||0}/j`;
                case 'LastHarvest': {
                    let label = 'N/A';
                    try { const ts = localStorage.getItem(harvestKey(r.ID)); label = ts ? timeAgoLabel(ts) : 'N/A'; } catch {}
                    return label;
                }
                case 'M1_ind': return r.M1;
                case 'M4_ind': return r.M4;
                default: return r[key];
            }
        };

        const lines = rows.map(r=> keys.map(k=>esc(valueFor(r,k))).join(';'));
        const csv = headerLabels.map(esc).join(';')+'\n'+lines.join('\n');

        const a=document.createElement('a');
        a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
        a.download='secteurs.csv'; a.click(); URL.revokeObjectURL(a.href);
    }

    // ---- Export JSON brut de window.Secteurs ----
    function exportJSON(){
        try{
            const src = window.Secteurs ?? {};
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
            a.download = 'secteurs_raw.json';
            a.click();
            URL.revokeObjectURL(a.href);
        } catch(e){
            console.error('Dump brut impossible : ', e);
        }
    }

    // ---- mount ----
    bodyEl.append(tabsEl, widgetsEl, controlsEl, tableEl, tableAIA);
    winEl.append(headEl, bodyEl);
    document.body.appendChild(winEl);

    // ---------- Bornage fenêtre ----------
    const MARGIN = 8;
    function clampPos(left, top) {
        const w = winEl.offsetWidth;
        const h = winEl.offsetHeight;
        const maxLeft = Math.max(MARGIN, window.innerWidth - w - MARGIN);
        const maxTop  = Math.max(MARGIN, window.innerHeight - h - MARGIN);
        return { left: Math.min(Math.max(left, MARGIN), maxLeft),
            top:  Math.min(Math.max(top,  MARGIN), maxTop) };
    }
    function clampSize() {
        const rect = winEl.getBoundingClientRect();
        const maxW = Math.max(200, window.innerWidth  - rect.left - MARGIN);
        const maxH = Math.max(160, window.innerHeight - rect.top  - MARGIN);
        if (rect.width  > maxW) winEl.style.width  = `${maxW}px`;
        if (rect.height > maxH) winEl.style.height = `${maxH}px`;
    }
    function clampAll() {
        const rect = winEl.getBoundingClientRect();
        const pos = clampPos(rect.left, rect.top);
        winEl.style.left = `${pos.left}px`;
        winEl.style.top  = `${pos.top}px`;
        clampSize();
    }

    // ---------- events ----------
    // fermer
    btnClose.onclick=()=>{
        try{ window.__secteursInspector=undefined; }catch{}
        winEl.remove(); styleEl.remove(); colMenuEl.remove(); tipEl.remove();
    };

    // réduire / restaurer
    let minimized = false;
    const orig = { width: '', height: '', left: '', top: '' };
    function minimizeWindow(){
        if (minimized) return;
        const r = winEl.getBoundingClientRect();
        orig.width = winEl.style.width; orig.height = winEl.style.height;
        orig.left = winEl.style.left; orig.top = winEl.style.top;
        winEl.style.width = '300px';
        winEl.style.height = '44px';
        winEl.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 308)) + 'px';
        winEl.style.top  = Math.max(8, Math.min(r.top,  window.innerHeight - 52)) + 'px';
        bodyEl.style.display='none';
        minimized = true;
    }
    function restoreWindow(){
        if (!minimized) return;
        winEl.style.width = orig.width || '';
        winEl.style.height = orig.height || '';
        winEl.style.left = orig.left || '40px';
        winEl.style.top = orig.top || '40px';
        bodyEl.style.display='';
        minimized = false;
        clampAll();
    }
    btnMin.onclick = ()=>{ minimized ? restoreWindow() : minimizeWindow(); };

    // UI
    btnRefresh.onclick = () => { renderSectors(); renderAIA(); };
    btnCsv.onclick = exportCSV;
    btnCols.onclick = ()=>{ if(colMenuEl.style.display==='flex') hideColMenu(); else buildColMenu(); };
    btnDbg.onclick  = exportJSON;

    // recherche / filtres
    searchEl.oninput = renderSectors;
    fM.onchange = renderSectors; fT.onchange = renderSectors;

    // Tooltip delegation
    function tipAttachFor(el){
        el.addEventListener('mousemove', (e)=>{
            const td = e.target.closest('td.sx-has-tip');
            if (!td || !el.contains(td)) { hideTip(); return; }
            const html = td.dataset.tipHtml || '';
            if (!html) { hideTip(); return; }
            showTip(html, e.clientX, e.clientY);
        });
        el.addEventListener('mouseleave', hideTip);
    }
    tipAttachFor(tableEl);
    tipAttachFor(tableAIA);
    window.addEventListener('scroll', hideTip, true);

    // Interception clics
    document.addEventListener('click',(ev)=>{
        // Fermer menu colonnes si clic ailleurs
        if (colMenuEl.style.display==='flex' && !colMenuEl.contains(ev.target) && ev.target!==btnCols) hideColMenu();

        // Bouton refresh FILON (dans la table Secteurs)
        const filonBtn = ev.target.closest('.sx-filon-refresh');
        if (filonBtn) {
            ev.preventDefault();
            const id = filonBtn.getAttribute('data-id');
            const p = window.planete || window.Planete || {};
            const pid = String(p.ID || '');
            const fil = toNum(p.Filon);
            if (!id) return;
            if (pid !== String(id)) {
                alert("Ouvre d'abord la planète correspondante, puis reclique sur 🔄.");
                return;
            }
            if (fil === null) {
                alert("Filon introuvable sur la planète courante.");
                return;
            }
            setFilonLS(id, fil);
            renderSectors();
            return;
        }

        // Récolter (sauver timestamp puis suivre le lien UNE SEULE FOIS)
        const a = ev.target.closest('a[title="Récolter"], a[href*="Ordre=recolter"]');
        if (a && a.closest('.sx-actions')) {
            ev.preventDefault();
            ev.stopPropagation();
            try{
                const url = new URL(a.href, location.href);
                const id = url.searchParams.get('IDCible');
                if (id) localStorage.setItem(harvestKey(id), String(Date.now()));
            }catch{}
            renderSectors();
            const target = a.getAttribute('target') || '_self';
            window.open(a.href, target);
        }
    }, true);

    // Drag + bornage
    let drag=false, dx=0, dy=0;
    headEl.addEventListener('mousedown',e=>{
        if(e.target.closest('button, input')) return;
        drag=true;
        const rect = winEl.getBoundingClientRect();
        dx = e.clientX - rect.left;
        dy = e.clientY - rect.top;
        e.preventDefault();
    });
    document.addEventListener('mousemove',e=>{
        if(!drag) return;
        const left = e.clientX - dx;
        const top  = e.clientY - dy;
        const pos  = clampPos(left, top);
        winEl.style.left = `${pos.left}px`;
        winEl.style.top  = `${pos.top}px`;
    });
    document.addEventListener('mouseup',()=>drag=false);

    if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => clampSize());
        ro.observe(winEl);
    }
    winEl.addEventListener('mouseup', clampAll);
    window.addEventListener('resize', clampAll);

    // Onglets
    function activateTab(which){
        activeTab = which === 'AIA' ? 'AIA' : 'Secteurs';
        if (activeTab === 'AIA'){
            tabSectors.classList.remove('active'); tabAIA.classList.add('active');
            tableEl.style.display='none'; tableAIA.style.display='';
        } else {
            tabAIA.classList.remove('active'); tabSectors.classList.add('active');
            tableAIA.style.display='none'; tableEl.style.display='';
        }
        hideTip();
    }
    tabSectors.onclick = () => activateTab('Secteurs');
    tabAIA.onclick     = () => activateTab('AIA');

    // initial
    const tabsWrap = document.createDocumentFragment();
    tabsWrap.appendChild(tabsEl);
    const container = document.createDocumentFragment();
    container.append(tabsWrap, widgetsEl, controlsEl, tableEl, tableAIA);
    bodyEl.append(container);

    renderSectors();
    renderAIA();
    requestAnimationFrame(clampAll);

    // API
    window.__secteursInspector = {
        open(){ winEl.style.display='flex'; /* restaure si minifié */ restoreWindow(); clampAll(); }
    };
})();
