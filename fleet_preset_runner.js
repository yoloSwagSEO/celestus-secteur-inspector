// fleet_preset_runner.js — Fleet Preset Runner (v1.5)
// Liste les presets + application directe sur la page Flottes.
// Changements demandés :
// - pas d'alert()
// - bouton "Rafraîchir" = icône
// - bouton "Appliquer" = icône ▶ (play)
// - bouton "+" = signe plus BLANC
// - retrait du bouton "builder" (et label)
// - tooltip “Vaisseaux” : affiche “CODE — Nom — qté”
// - styles (zebra + scrollbars) scopés au module uniquement
(() => {
    // anti double-injection
    if (window.__fleetPresetRunner && typeof window.__fleetPresetRunner.open === "function") {
        window.__fleetPresetRunner.open();
        return;
    }
    window.__fleetPresetRunner = {};

    // dépendance core
    if (!window.CT || !CT.__ready) {
        console.error("CT core manquant. Injecte ct_core.js d’abord.");
        return;
    }

    // ---------- Const & storage ----------
    const STORE_KEY      = "fleet_presets:v1";  // même clé que le builder
    const SHIP_CACHE_KEY = "ships_cache:v1";    // defs vaisseaux persistées par le builder

    // ---------- Utils ----------
    const toNum = v => {
        if (v == null || v === "") return 0;
        const n = Number(String(v).replace(",", "."));
        return Number.isFinite(n) ? n : 0;
    };
    const abbr = n => CT.fmt?.abbr ? CT.fmt.abbr(toNum(n)) : String(toNum(n));

    function loadPresets() {
        const arr = CT.store.get(STORE_KEY, []);
        return Array.isArray(arr) ? arr : [];
    }
    function savePresets(list) {
        try { CT.store.set(STORE_KEY, Array.isArray(list) ? list : []); }
        catch(e){ console.error("savePresets()", e); }
    }

    // Cache vaisseaux (lecture + merge live -> cache, priorité live)
    function loadShipCache() {
        try {
            const raw = localStorage.getItem(SHIP_CACHE_KEY);
            const obj = raw ? JSON.parse(raw) : {};
            return (obj && typeof obj === "object") ? obj : {};
        } catch { return {}; }
    }
    function saveShipCache(map) {
        try { localStorage.setItem(SHIP_CACHE_KEY, JSON.stringify(map || {})); } catch {}
    }
    function plainifyShip(v) {
        const o = {};
        try {
            for (const k in v) {
                const val = v[k];
                if (typeof val !== "function") o[k] = val;
            }
            if (!o.Code) o.Code = v?.Code ?? v?.code ?? "";
        } catch {}
        return o;
    }
    function mergePreferLive(live, cached) {
        const out = {};
        const keys = new Set([...(live?Object.keys(live):[]), ...(cached?Object.keys(cached):[])]);
        keys.forEach(k => {
            const lv = live?.[k];
            const cv = cached?.[k];
            out[k] = (lv !== undefined && lv !== null && lv !== "") ? lv : cv;
        });
        return out;
    }

    function getAllShips() {
        const cacheMap = loadShipCache();      // { Code: rawDef }
        const liveSrc = (window.Vaisseaux || {});
        const liveMap = {};

        try {
            Reflect.ownKeys(liveSrc).forEach(k => {
                try {
                    const v = liveSrc[k];
                    if (v && typeof v === "object") {
                        const Code = String(v.Code || k || "").trim();
                        if (!Code) return;
                        liveMap[Code] = plainifyShip(v);
                        liveMap[Code].Code = Code;
                    }
                } catch {}
            });
        } catch {}

        const merged = { ...cacheMap };
        let changed = false;
        Object.keys(liveMap).forEach(code => {
            const best = mergePreferLive(liveMap[code], cacheMap[code]);
            const prev = cacheMap[code];
            merged[code] = best;
            if (JSON.stringify(best) !== JSON.stringify(prev)) changed = true;
        });
        if (changed) saveShipCache(merged);

        const list = [];
        Object.keys(merged).forEach(code => {
            const v = merged[code] || {};
            const Nom = String(v.Nom || v.NomC || code || "").trim();
            list.push({ Code: code, Nom, _raw: v });
        });
        list.sort((a,b)=> a.Code.localeCompare(b.Code));
        return list;
    }

    // Mission labels (mêmes valeurs que dans le builder)
    const Missions = [
        ["Baser","baser"],
        ["Baser agressif","baserA"],
        ["Transporter","transporter"],
        ["Récolter","recolter"],
        ["Commercer","commercer"],
        ["Attaquer","attaquer"],
        ["Piller","piller"],
        ["Détruire","detruire"],
        ["Défendre","defendre"],
        ["Utiliser la porte","utiliserporte"],
        ["Donner","donner"],
        ["Vendre","vendre"],
        ["Espionner","espionner"],
        ["Explorer","explorer"],
        ["Surveiller","surveiller"]
    ];
    const missionLabelByVal = Object.fromEntries(Missions.map(([l,v])=>[v,l]));

    // ---------- UI ----------
    const ui = CT.win.create({
        id: "ct-fleet-runner",
        title: "Fleet Presets (Runner)",
        size: [720, 520],
        pos: [160, 120],
        scroll: "hidden",
        className: "ct-app-fleet-runner"
    });
    ui.onClose(()=> {
        try { st.remove(); tipEl?.remove(); stopObsShips?.(); window.__fleetPresetRunner = undefined; } catch {}
    });

    const CSS = `
  .ct-app-fleet-runner .fr-root{display:flex;flex-direction:column;height:100%}
  .ct-app-fleet-runner .fr-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
  .ct-app-fleet-runner .fr-search{flex:1;padding:6px 10px;border-radius:12px;border:1px solid #2a365a;background:#0b1120;color:#eaeefc;font-size:13px}
  .ct-app-fleet-runner .fr-spacer{flex:0 0 6px}
  .ct-app-fleet-runner .btn{width:28px;height:28px;border-radius:6px;background:#1a2240;border:1px solid #2f3d6a;display:flex;align-items:center;justify-content:center;cursor:pointer}
  .ct-app-fleet-runner .btn:hover{background:#202a52}
  .ct-app-fleet-runner .btn span{color:#fff; font-weight:700; line-height:1}

  .ct-app-fleet-runner .fr-main{flex:1 1 auto;min-height:0;overflow:auto;border:1px solid #223051;border-radius:10px;background:#0b1120}
  .ct-app-fleet-runner table{width:100%;border-collapse:separate;border-spacing:0;font-size:13px}
  .ct-app-fleet-runner thead th{position:sticky;top:0;background:#151c2f;border-bottom:1px solid #263251;padding:8px 6px;text-align:left;z-index:1}
  .ct-app-fleet-runner tbody td{padding:8px 6px;border-bottom:1px solid #223051;vertical-align:middle}
  .ct-app-fleet-runner tbody tr:nth-child(even){background:#0e1426}
  .ct-app-fleet-runner .td-actions{display:flex;gap:6px}
  .ct-app-fleet-runner .td-vais{cursor:help}

  /* Tooltip */
  .ct-app-fleet-runner .fr-tip{
    position:fixed;z-index:2147483647;display:none;max-width:420px;max-height:260px;
    background:#0f1422;border:1px solid #3a4a7a;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.5);padding:10px;overflow:auto
  }
  .ct-app-fleet-runner .fr-tip h4{margin:0 0 6px;font-size:12px;font-weight:700;color:#ffd4a3}
  .ct-app-fleet-runner .fr-tip-item{display:flex;justify-content:space-between;gap:12px;padding:2px 0}

  /* Scrollbars harmonisées */
  .ct-app-fleet-runner .fr-main::-webkit-scrollbar{width:8px;height:8px;background:transparent}
  .ct-app-fleet-runner .fr-main::-webkit-scrollbar-thumb{background:#1b2440;border-radius:8px}
  .ct-app-fleet-runner .fr-main{scrollbar-color:#1b2440 transparent;scrollbar-width:thin}
  `;
    const st = document.createElement("style");
    st.textContent = CSS;
    document.head.appendChild(st);

    const root  = document.createElement("div"); root.className = "fr-root";
    const head  = document.createElement("div"); head.className = "fr-head";
    const main  = document.createElement("div"); main.className = "fr-main";
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");
    table.append(thead, tbody);
    main.appendChild(table);
    root.append(head, main);
    ui.body.append(root);

    // Header controls
    const search = document.createElement("input");
    search.type = "text";
    search.className = "fr-search";
    search.placeholder = "Rechercher un preset…";
    const btnRefresh = document.createElement("button");
    btnRefresh.className = "btn"; // icône refresh
    btnRefresh.title = "Rafraîchir";
    btnRefresh.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="white" fill="none" stroke-width="2">
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
    <path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>`;
    const btnPlus = document.createElement("button");
    btnPlus.className = "btn";
    btnPlus.title = "Nouveau preset (vide)";
    btnPlus.innerHTML = `<span>+</span>`; // plus BLANC via CSS

    head.append(search, btnRefresh, btnPlus);

    // Tooltip
    const tipEl = document.createElement("div");
    tipEl.className = "fr-tip";
    tipEl.innerHTML = `<h4>Vaisseaux</h4><div class="fr-tip-list"></div>`;
    ui.root.appendChild(tipEl);
    const tipList = tipEl.querySelector(".fr-tip-list");
    function showTip(html, x, y){
        tipList.innerHTML = html;
        tipEl.style.display = "block";
        const r = tipEl.getBoundingClientRect();
        let left = x + 12, top = y + 12;
        if (left + r.width > window.innerWidth - 8) left = Math.max(8, x - r.width - 12);
        if (top + r.height > window.innerHeight - 8) top = Math.max(8, y - r.height - 12);
        tipEl.style.left = `${left}px`; tipEl.style.top = `${top}px`;
    }
    function hideTip(){ tipEl.style.display = "none"; }

    // Hover handling inside main container only
    main.addEventListener("mousemove", (e)=>{
        const td = e.target.closest("td.td-vais");
        if (!td || !main.contains(td)) { hideTip(); return; }
        const html = td.dataset.tipHtml || "";
        if (!html) { hideTip(); return; }
        showTip(html, e.clientX, e.clientY);
    });
    main.addEventListener("mouseleave", hideTip);
    window.addEventListener("scroll", hideTip, true);

    // ---------- Rendu ----------
    let presets = loadPresets();
    let shipsIndex = new Map(); // code -> {Nom}
    function rebuildShipIndex() {
        shipsIndex = new Map();
        getAllShips().forEach(s => shipsIndex.set(s.Code, { Nom: s.Nom }));
    }
    rebuildShipIndex();

    function headerRender() {
        thead.innerHTML = "";
        const tr = document.createElement("tr");
        ["Preset", "Mission", "Vaisseaux", "Action"].forEach(lbl => {
            const th = document.createElement("th");
            th.textContent = lbl;
            tr.appendChild(th);
        });
        thead.appendChild(tr);
    }

    function makeTipHtmlForPreset(preset) {
        const items = preset?.items || {};
        const rows = [];
        Object.entries(items)
            .filter(([,q]) => toNum(q) > 0)
            .sort((a,b)=>a[0].localeCompare(b[0]))
            .forEach(([code, q])=>{
                const name = shipsIndex.get(code)?.Nom || "";
                const qty  = toNum(q);
                // “CODE — Nom — qté”
                rows.push(`<div class="fr-tip-item"><span>${code} — ${name}</span><span>${qty}</span></div>`);
            });
        return rows.length ? rows.join("") : `<div class="fr-tip-item"><span>Aucun vaisseau</span><span>0</span></div>`;
    }

    function sumQty(preset){
        let s = 0;
        const it = preset?.items || {};
        Object.values(it).forEach(v => s += toNum(v));
        return s;
    }

    function applyPreset(preset){
        try {
            if (!preset || !preset.items) return;
            // Remplir les champs F<code> sur la page Flottes si présents
            const P = (window.planete || window.Planete || {});
            const inv = (P.Vaisseaux || {});
            Object.entries(preset.items).forEach(([code, qty])=>{
                const input = document.getElementById("F"+code);
                if (!input) return;
                let v = Math.max(0, toNum(qty));
                // plafonner à l'inventaire si connu
                if (inv && inv[code] != null) v = Math.min(v, toNum(inv[code]));
                input.value = String(v);
            });

            // Nom de flotte (si champ présent)
            try{
                const nameInput = document.querySelector('input[name="NomF"]');
                if (nameInput && preset.name) nameInput.value = preset.name;
            }catch{}

            // Mission (radio) si présente
            try{
                const ord = preset.mission ? String(preset.mission) : "";
                if (ord) {
                    const rb = document.getElementById("id"+ord) || document.querySelector(`input[name="Ordre"][value="${ord}"]`);
                    if (rb) {
                        rb.checked = true;
                        if (typeof window.ChangeInter === "function") window.ChangeInter();
                    }
                }
            }catch{}

            // recalcul des totaux si la fonction existe
            if (typeof window.FTotal === "function") window.FTotal();
            else if (typeof window.FCheck === "function") window.FCheck();
        } catch(e){
            console.error("applyPreset()", e);
        }
    }

    function renderList(){
        headerRender();
        tbody.innerHTML = "";

        const f = (search.value || "").trim().toLowerCase();
        const list = (presets || []).slice().filter(p=>{
            if (!f) return true;
            const hay = `${p.name || ""} ${p.mission || ""}`.toLowerCase();
            return hay.includes(f);
        });

        list.forEach(p=>{
            const tr = document.createElement("tr");

            // Preset
            const tdName = document.createElement("td");
            tdName.textContent = p.name || "Preset";
            tr.appendChild(tdName);

            // Mission
            const tdMission = document.createElement("td");
            tdMission.textContent = missionLabelByVal[p.mission] || "—";
            tr.appendChild(tdMission);

            // Vaisseaux (avec tooltip)
            const tdV = document.createElement("td");
            tdV.className = "td-vais";
            const qty = sumQty(p);
            tdV.textContent = abbr(qty);
            tdV.dataset.tipHtml = makeTipHtmlForPreset(p);
            tr.appendChild(tdV);

            // Actions
            const tdA = document.createElement("td");
            tdA.className = "td-actions";
            const btnPlay = document.createElement("button");
            btnPlay.className = "btn";
            btnPlay.title = "Appliquer ce preset sur la page Flottes";
            btnPlay.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="white"><polygon points="8,5 19,12 8,19"/></svg>`;
            btnPlay.onclick = () => applyPreset(p);

            tdA.append(btnPlay);
            tr.appendChild(tdA);

            tbody.appendChild(tr);
        });
    }

    // ---------- Wire ----------
    search.oninput = () => renderList();
    btnRefresh.onclick = () => { // recharger store + defs vaisseaux
        presets = loadPresets();
        rebuildShipIndex();
        renderList();
    };
    btnPlus.onclick = () => { // nouveau preset vide
        presets = loadPresets();
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
        const name = `Preset ${presets.length + 1}`;
        presets.push({ id, name, items:{}, mission:"" });
        savePresets(presets);
        renderList();
    };

    // observer ships (si de nouvelles defs arrivent via navigation)
    const stopObsShips = CT.observe(() => {
        try { return Object.keys(window.Vaisseaux || {}).length; } catch { return 0; }
    }, () => {
        rebuildShipIndex();
        renderList();
    }, { interval: 3000 });

    // init
    renderList();

    // API
    window.__fleetPresetRunner = {
        open(){ ui.bringToFront?.(); renderList(); }
    };
})();
