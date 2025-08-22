(() => {
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

        // Modules existants
        const M1    = toNum(o.M1);   // Mod. Minier
        const M4    = toNum(o.M4);   // Concent.

        // Nouveaux modules
        const M1M   = toNum(o.M1M);   // Extract. Télurique
        const M1MH  = toNum(o.M1MH);  // Col. Minière
        const M1T   = toNum(o.M1T);   // Extr. Jovien
        const M1TH  = toNum(o.M1TH);  // Raf. Mobile

        // AIA (pour affichage du type)
        const AIA   = toNum(o.AIA);

        // coûts d’entretien (/j) EXISTANTS
        const EntM1M = (M1||0)*10000;   // mod. minier -> métal
        const EntM1T = (M1||0)*5000;    // mod. minier -> tritium
        const EntM4M = (M4||0)*20000;   // concent. -> métal
        const EntM4T = (M4||0)*10000;   // concent. -> tritium

        // coûts d’entretien (/j) NOUVEAUX (par module)
        const EntM1MM  = (M1M ||0)*10_000_000; // M1M : 10M/j Métal
        const EntM1MT  = (M1M ||0)*5_000_000;  // M1M : 5M/j Tritium
        const EntM1MHM = (M1MH||0)*10_000_000; // M1MH : 10M/j Métal
        const EntM1MHT = (M1MH||0)*5_000_000;  // M1MH : 5M/j Tritium
        const EntM1TM  = (M1T ||0)*5_000_000;  // M1T : 5M/j Métal
        const EntM1TT  = (M1T ||0)*2_500_000;  // M1T : 2.5M/j Tritium
        const EntM1THM = (M1TH||0)*10_000_000; // M1TH : 10M/j Métal
        const EntM1THT = (M1TH||0)*5_000_000;  // M1TH : 5M/j Tritium

        // totaux d’entretien (/j)
        const EntretienM = EntM1M + EntM4M + EntM1MM + EntM1MHM + EntM1TM + EntM1THM;
        const EntretienT = EntM1T + EntM4T + EntM1MT + EntM1MHT + EntM1TT + EntM1THT;

        // rentabilité /j
        const RentaM = (ProdM||0)*24 - EntretienM;
        const RentaT = (ProdT||0)*24 - EntretienT;

        rows.push({
            IMG: o.IMG ? String(o.IMG) : '',
            Adresse: o.Adresse||'',
            ID: o.ID ? String(o.ID) : '',
            // Type affiché : si "Rien" et AIA>0 => "AIA", sinon valeur d'origine
            Type: (String(o.Type||'') === 'Rien' && (AIA||0) > 0) ? 'AIA' : (o.Type||''),
            ProdM, ProdT, ProdP,
            ResM, ResT, ResP,

            // modules
            M1, M4, M1M, M1MH, M1T, M1TH,

            // AIA conservé si on souhaite l'exposer plus tard
            AIA,

            // entretiens (groupes & détails)
            EntretienM, EntretienT,
            EntM1M, EntM1T, EntM4M, EntM4T,
            EntM1MM, EntM1MT, EntM1MHM, EntM1MHT, EntM1TM, EntM1TT, EntM1THM, EntM1THT,

            // rentabilité
            RentaM, RentaT
        });
    });

    // ---------- UI ----------
    const css = `
  .sx-win{position:fixed;top:40px;left:40px;width:1280px;height:650px;background:#0f1422;color:#eaeefc;font:14px/1.35 system-ui,Segoe UI,Arial;z-index:2147483000;border:1px solid #263251;border-radius:12px;display:flex;flex-direction:column;resize:both;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.45)}
  .sx-head{background:#151c2f;padding:10px 12px;cursor:move;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #263251}
  .sx-title{font-weight:700;letter-spacing:.3px}
  .sx-close{cursor:pointer;padding:2px 8px;border-radius:8px;background:#222b44}
  .sx-close:hover{background:#2a3454}
  .sx-body{flex:1;overflow:auto;padding:14px}

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
  .sx-colmenu{
    position:fixed;background:#151c2f;border:1px solid #3a4a7a;border-radius:10px;
    padding:10px;display:none;flex-direction:column;gap:6px;z-index:2147483647;box-shadow:0 12px 30px rgba(0,0,0,.5);
    max-height:70vh; overflow-y:auto; /* scrollbar pour les colonnes */
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
  `;
    const styleEl = document.createElement('style'); styleEl.textContent = css; document.head.appendChild(styleEl);

    const winEl = document.createElement('div'); winEl.className='sx-win';
    const headEl = document.createElement('div'); headEl.className='sx-head';
    headEl.innerHTML = `<div class="sx-title">Secteurs Inspector</div><div class="sx-close">Fermer</div>`;
    const bodyEl = document.createElement('div'); bodyEl.className='sx-body';

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

    const btnCsv = document.createElement('button'); btnCsv.className='sx-btn'; btnCsv.textContent='📥 Export CSV';
    const btnCols = document.createElement('button'); btnCols.className='sx-btn'; btnCols.textContent='⚙ Colonnes';
    const btnDbg = document.createElement('button'); btnDbg.className='sx-btn'; btnDbg.textContent='🐞 Debug';
    rightEl.append(btnCsv, btnCols, btnDbg);
    controlsEl.append(leftEl, rightEl);

    // ---- colonnes (ordre & visibilité) ----
    const headers = [
        {label:'', key:'IMG', show:true},
        {label:'Adresse', key:'Adresse', show:true},
        {label:'Type', key:'Type', show:true},

        {label:'Prod.', key:'ProdGroup', show:true},

        {label:'Prod Metal', key:'ProdM', show:false},
        {label:'Prod Tritium', key:'ProdT', show:false},
        {label:'Prod PhotoP', key:'ProdP', show:false},
        {label:'Metal', key:'ResM', show:false},
        {label:'Tritium', key:'ResT', show:false},
        {label:'PhotoP', key:'ResP', show:false},

        {label:'Stock', key:'StockGroup', show:true},

        {label:'Modules', key:'ModulesGroup', show:true},

        {label:'Mod. Minier', key:'M1', show:false},
        {label:'Concent.', key:'M4', show:false},
        {label:'Extract. Télurique', key:'M1M', show:false},
        {label:'Col. Minière', key:'M1MH', show:false},
        {label:'Extr. Jovien', key:'M1T', show:false},
        {label:'Raf. Mobile', key:'M1TH', show:false},

        {label:'Mod. Minier (ind)', key:'M1_ind', show:false},
        {label:'Concent. (ind)', key:'M4_ind', show:false},

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
        {label:'Action', key:'Action', show:true},
    ];

    // ---- menu colonnes (flottant) ----
    const colMenuEl = document.createElement('div'); colMenuEl.className='sx-colmenu'; document.body.appendChild(colMenuEl);
    const showColMenu = () => {
        colMenuEl.innerHTML = '';
        headers.forEach(h=>{
            const lbl=document.createElement('label');
            const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=h.show;
            cb.onchange=()=>{ h.show = cb.checked; render(); };
            lbl.append(cb, document.createTextNode(' '+(h.label||'Colonne')));
            colMenuEl.appendChild(lbl);
        });
        const r = btnCols.getBoundingClientRect();
        let top = r.bottom + 8;
        let left = r.left;
        colMenuEl.style.display = 'flex';
        const mr = colMenuEl.getBoundingClientRect();
        if (left + mr.width > window.innerWidth - 8) left = window.innerWidth - mr.width - 8;
        if (top + mr.height > window.innerHeight - 8) top = window.innerHeight - mr.height - 8;
        if (left < 8) left = 8;
        if (top < 8) top = 8;
        colMenuEl.style.left = left+'px';
        colMenuEl.style.top = top+'px';
    };
    const hideColMenu = () => { colMenuEl.style.display='none'; };

    // ---- table ----
    const tableEl = document.createElement('table'); tableEl.className='sx-table';
    const theadEl = document.createElement('thead'); const trh = document.createElement('tr');
    headers.forEach(h=>{ const th=document.createElement('th'); th.textContent=h.label; trh.appendChild(th); });
    theadEl.appendChild(trh);
    const tbodyEl = document.createElement('tbody');
    tableEl.append(theadEl, tbodyEl);

    function applyHeaderVisibility(){
        Array.from(trh.children).forEach((th,i)=>{
            th.style.display = headers[i].show ? '' : 'none';
        });
    }

    // ---- rendu ----
    function render(){
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
                    case 'IMG':
                        td.innerHTML = r.IMG ? `<img class="sx-thumb" src="${thumb(r.IMG)}" alt="">` : '';
                        break;
                    case 'Adresse':
                        td.innerHTML = `<a href="../Programme/Planete.php?ID=${r.ID}&Serv=1" target="Programme">${r.Adresse}</a>`;
                        break;
                    case 'Type':
                        td.textContent = r.Type || '';
                        break;
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

                    // simples (cachés par défaut)
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

                    // Détails d’entretien
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
                    default:
                        td.textContent = '';
                }
                tr.appendChild(td);
            });
            tbodyEl.appendChild(tr);
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
                case 'EntGroup': return `M:${r.EntretienM||0}/j | T:${r.EntretienT||0}/j`;
                case 'RentaGroup': return `M:${r.RentaM||0}/j | T:${r.RentaT||0}/j`;
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
                } catch(e){ /* ignore clé problématique */ }
            });

            const rawJson = JSON.stringify(out, null, 2);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([rawJson], {type:'application/json'}));
            a.download = 'secteurs_raw.json';
            a.click();
            URL.revokeObjectURL(a.href);
        } catch(e){
            alert('Dump brut impossible : ' + (e && e.message ? e.message : e));
        }
    }

    // ---- mount ----
    bodyEl.append(widgetsEl, controlsEl, tableEl);
    winEl.append(headEl, bodyEl);
    document.body.appendChild(winEl);

    // ---------- Bornage fenêtre (anti-dépassement) ----------
    const MARGIN = 8;
    function clampPos(left, top) {
        const w = winEl.offsetWidth;
        const h = winEl.offsetHeight;
        const maxLeft = Math.max(MARGIN, window.innerWidth - w - MARGIN);
        const maxTop  = Math.max(MARGIN, window.innerHeight - h - MARGIN);
        return {
            left: Math.min(Math.max(left, MARGIN), maxLeft),
            top:  Math.min(Math.max(top,  MARGIN), maxTop)
        };
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

    // events
    headEl.querySelector('.sx-close').onclick=()=>{
        try{ window.__secteursInspector=undefined; }catch{}
        winEl.remove(); styleEl.remove(); colMenuEl.remove();
    };
    searchEl.oninput = render;
    fM.onchange = render; fT.onchange = render;
    btnCsv.onclick = exportCSV;
    btnCols.onclick = ()=>{ if(colMenuEl.style.display==='flex') hideColMenu(); else showColMenu(); };
    btnDbg.onclick  = exportJSON;
    document.addEventListener('click',(ev)=>{ if(!colMenuEl.contains(ev.target) && ev.target!==btnCols) hideColMenu(); });

    // draggable (hors inputs/boutons) + bornage
    let drag=false, dx=0, dy=0;
    headEl.addEventListener('mousedown',e=>{
        if(e.target.closest('button, input, .sx-close')) return;
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

    // initial
    render();
    requestAnimationFrame(clampAll);

    // API
    window.__secteursInspector = { open(){ winEl.style.display='flex'; clampAll(); } };
})();
