// fleet_preset_builder.js — Fleet Preset Builder (v1.9)
// Design :
// [Pills de presets]
// [Recherche .........] [ Nom du preset .......... ] [ + ][ 💾 ][ 📄 ][ 🗑️ ][ 📥 ][ 📤 ][ ⚙ Colonnes ]
// [Filtres: Châssis ⌄ ][☑ Présents (colonies+secteurs)]
// ┌───────────────────────────────────────┬──────────────────────────────┐
// │   TABLEAU (scroll)                    │   COLONNE DROITE (fixe)      │
// │   (colonnes triables, zébrées, etc.)  │   - Mission (select)         │
// │                                       │   - Stats (liste verticale)  │
// └───────────────────────────────────────┴──────────────────────────────┘
(() => {
    // anti-double-injection
    if (window.__fleetPresetBuilder && typeof window.__fleetPresetBuilder.open === "function") {
        window.__fleetPresetBuilder.open();
        return;
    }
    window.__fleetPresetBuilder = {};

    // dépendance core
    if (!window.CT || !CT.__ready) {
        console.error("CT core manquant. Injecte ct_core.js d’abord.");
        return;
    }

    // ---------- Helpers ----------
    const toNum = (v) => {
        if (v == null || v === "") return 0;
        const n = Number(String(v).replace(",", "."));
        return Number.isFinite(n) ? n : 0;
    };
    const abbr = (n) => CT.fmt?.abbr ? CT.fmt.abbr(toNum(n)) : String(toNum(n));
    // TempsM (secondes) => format court (ex: 1min, 40s, 2h, 1j)
    const fmtSecondsShort = (sec) => {
        let s = Math.max(0, Math.floor(toNum(sec)));
        if (s < 60) return `${s}s`;
        const m = Math.floor(s / 60);
        if (m < 60) return `${m}min`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h`;
        const d = Math.floor(h / 24);
        return `${d}j`;
    };
    const hasCompetence = (id) => {
        try {
            const comp = (window.Joueur && window.Joueur.Competences) || [];
            if (Array.isArray(comp)) return comp.includes(String(id)) || comp.includes(Number(id));
            const s = String(comp || "");
            return s.includes(String(id));
        } catch { return false; }
    };

    // ---------- Storage ----------
    const STORE_KEY      = "fleet_presets:v1";
    const COLS_LS_KEY    = "fleet_builder_cols:v1";
    const SORT_LS_KEY    = "fleet_builder_sort:v1";
    const FILTERS_LS_KEY = "fleet_builder_filters:v1";
    const SIDE_W_LS_KEY  = "fleet_builder_side_w:v1";
    const SHIP_CACHE_KEY = "ships_cache:v1";        // <-- cache persistant des defs vaisseaux

    const presets = Array.isArray(CT.store.get(STORE_KEY, [])) ? CT.store.get(STORE_KEY, []) : [];
    let currentId = presets[0]?.id || null;

    function saveAll() {
        CT.store.set(STORE_KEY, presets);
    }

    // ----- Cache vaisseaux (localStorage) -----
    function loadShipCache(){
        try {
            const raw = localStorage.getItem(SHIP_CACHE_KEY);
            const obj = raw ? JSON.parse(raw) : {};
            return (obj && typeof obj === "object") ? obj : {};
        } catch { return {}; }
    }
    function saveShipCache(map){
        try { localStorage.setItem(SHIP_CACHE_KEY, JSON.stringify(map || {})); } catch {}
    }
    function plainifyShip(v){
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
    // fusion: priorise la valeur "live" si définie/non vide, sinon prend la valeur cache
    function mergePreferLive(live, cached){
        const out = {};
        const keys = new Set([...(live?Object.keys(live):[]), ...(cached?Object.keys(cached):[])]);
        keys.forEach(k=>{
            const lv = live?.[k];
            const cv = cached?.[k];
            out[k] = (lv !== undefined && lv !== null && lv !== "") ? lv : cv;
        });
        return out;
    }

    // ---------- Données (normalisation Vaisseaux + cache) ----------
    const VAIS_TYPE = (window.VaisType || {}); // mapping châssis → nom lisible
    const chassisName = code => (VAIS_TYPE && VAIS_TYPE[code]) || code || "";

    // Ensemble dynamique (recalculé) de codes connus (inclut cache)
    function getKnownCodes(){
        const set = new Set();
        getAllShips().forEach(s => set.add(s.Code));
        return set;
    }
    const MODULE_CODES = new Set(['M1','M4','M1M','M1MH','M1T','M1TH']); // à exclure pour certaines stats

    // Renvoie la liste des vaisseaux à partir de Vaisseaux (live) + cache (persistant)
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

        // Fusion live + cache, priorité live, puis on sauvegarde le meilleur
        const merged = { ...cacheMap };
        let changed = false;

        Object.keys(liveMap).forEach(code => {
            const best = mergePreferLive(liveMap[code], cacheMap[code]);
            const prev = cacheMap[code];
            merged[code] = best;
            if (JSON.stringify(best) !== JSON.stringify(prev)) changed = true;
        });

        if (changed) saveShipCache(merged);

        // Construire la liste depuis "merged"
        const list = [];
        Object.keys(merged).forEach(code => {
            const v = merged[code] || {};
            const Nom = String(v.Nom || v.NomC || code || "").trim();
            const Chassis = String(v.Chassis || "").trim();
            list.push({ Code: code, Nom, Chassis, _raw: v });
        });

        // Tri par code pour stabilité
        list.sort((a,b) => a.Code.localeCompare(b.Code));
        return list;
    }

    // ---------- Colonnes ----------
    const COLS_DEF = [
        { key: "Code",       label: "Code",        defShow: true,  sort: (a,b)=>a.Code.localeCompare(b.Code) },
        { key: "Nom",        label: "Nom",         defShow: true,  sort: (a,b)=>a.Nom.localeCompare(b.Nom) },
        { key: "Chassis",    label: "Châssis",     defShow: true,  sort: (a,b)=>chassisName(a.Chassis).localeCompare(chassisName(b.Chassis)) },

        // Colonnes avancées (cachées par défaut)
        { key: "AttAC",      label: "Att. Conv",   icon: "https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/AttAC.png",  defShow: false, sort: (a,b)=>toNum(a._raw?.AttAC)-toNum(b._raw?.AttAC) },
        { key: "AttEM",      label: "Att. Em",     icon: "https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/AttEM.png",  defShow: false, sort: (a,b)=>toNum(a._raw?.AttEM)-toNum(b._raw?.AttEM) },
        { key: "AttLa",      label: "Att. La.",    icon: "https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/AttLa.png",  defShow: false, sort: (a,b)=>toNum(a._raw?.AttLa)-toNum(b._raw?.AttLa) },
        { key: "AttPl",      label: "Att. Pl",     icon: "https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/AttPl.png",  defShow: false, sort: (a,b)=>toNum(a._raw?.AttPl)-toNum(b._raw?.AttPl) },
        { key: "BonusCiblage", label: "Bonus c.",  icon: "https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/Cib.png",    defShow: false, sort: (a,b)=>toNum(a._raw?.BonusCiblage)-toNum(b._raw?.BonusCiblage) },
        { key: "Cible",        label: "Cible",     icon: "https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/Cib.png",    defShow: false, sort: (a,b)=>String(a._raw?.Cible||"").localeCompare(String(b._raw?.Cible||"")) },
        { key: "Structure",    label: "Struct.",   icon: "https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/Structure.png", defShow: false, sort: (a,b)=>toNum(a._raw?.Structure)-toNum(b._raw?.Structure) },
        { key: "Fret",         label: "Fret",      icon: "https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/Fret.png",   defShow: false, sort: (a,b)=>toNum(a._raw?.Fret)-toNum(b._raw?.Fret) },
        { key: "AFret",        label: "Nb. Ch.",   icon: "https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/AFret.png",  defShow: false, sort: (a,b)=>toNum(a._raw?.AFret)-toNum(b._raw?.AFret) },
        { key: "Pcom",         label: "Com.",                                                                             defShow: false, sort: (a,b)=>String(a._raw?.Pcom??"?").localeCompare(String(b._raw?.Pcom??"?")) },

        { key: "TempsM",      label: "T Manœuvre", icon: "https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/PropM.png", defShow: false, sort: (a,b)=>toNum(a._raw?.TempsM)-toNum(b._raw?.TempsM) },
        // Icône corrigée (PropC.png)
        { key: "VitesseC",    label: "V. Conv.",   icon: "https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/PropC.png", defShow: false, sort: (a,b)=>toNum(a._raw?.VitesseC)-toNum(b._raw?.VitesseC) },
        { key: "VitesseH",    label: "V. Hyp",     icon: "https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/PropH.png", defShow: false, sort: (a,b)=>toNum(a._raw?.VitesseH)-toNum(b._raw?.VitesseH) },

        { key: "Chasses",     label: "Chasses",                                                                              defShow: false, sort: (a,b)=>{
                const ta = toNum(a._raw?.Ch1)+toNum(a._raw?.Ch2)+toNum(a._raw?.Ch3);
                const tb = toNum(b._raw?.Ch1)+toNum(b._raw?.Ch2)+toNum(b._raw?.Ch3);
                return ta - tb;
            } },

        // Toujours dernière : Quantité
        { key: "Quantite",   label: "Quantité",    defShow: true,  sort: (a,b,items)=>{
                const qa = toNum(items?.[a.Code]);
                const qb = toNum(items?.[b.Code]);
                return qa - qb;
            } }
    ];

    // Visibilité colonnes
    const colState = (() => {
        try {
            const raw = localStorage.getItem(COLS_LS_KEY);
            if (!raw) {
                const init = {};
                COLS_DEF.forEach(c => { init[c.key] = !!c.defShow; });
                return init;
            }
            const parsed = JSON.parse(raw);
            const out = {};
            COLS_DEF.forEach(c => {
                out[c.key] = Object.prototype.hasOwnProperty.call(parsed, c.key) ? !!parsed[c.key] : !!c.defShow;
            });
            return out;
        } catch {
            const init = {};
            COLS_DEF.forEach(c => { init[c.key] = !!c.defShow; });
            return init;
        }
    })();
    const saveCols = () => { try { localStorage.setItem(COLS_LS_KEY, JSON.stringify(colState)); } catch {} };

    // Tri
    let sortState = (() => {
        try {
            const raw = localStorage.getItem(SORT_LS_KEY);
            if (!raw) return { key: "Code", dir: "asc" };
            const obj = JSON.parse(raw);
            if (!obj || !obj.key) return { key: "Code", dir: "asc" };
            return obj;
        } catch { return { key: "Code", dir: "asc" }; }
    })();
    const saveSort = () => { try { localStorage.setItem(SORT_LS_KEY, JSON.stringify(sortState)); } catch {} };

    // Filtres (châssis + "Présents")
    let filters = (() => {
        try {
            const raw = localStorage.getItem(FILTERS_LS_KEY);
            const base = { chassis: "", presentOnly: false };
            if (!raw) return base;
            const obj = JSON.parse(raw) || {};
            return { chassis: String(obj.chassis||""), presentOnly: !!obj.presentOnly };
        } catch {
            return { chassis: "", presentOnly: false };
        }
    })();
    const saveFilters = () => { try { localStorage.setItem(FILTERS_LS_KEY, JSON.stringify(filters)); } catch {} };

    // Largeur colonne droite
    let sideWidth = (() => {
        try {
            const v = Number(localStorage.getItem(SIDE_W_LS_KEY));
            if (Number.isFinite(v) && v >= 220 && v <= 520) return v;
        } catch {}
        return 280; // défaut
    })();
    const saveSideWidth = () => { try { localStorage.setItem(SIDE_W_LS_KEY, String(sideWidth)); } catch {} };

    // ---------- Présence des vaisseaux sur Colonies/Secteurs ----------
    let presentCodes = new Set();
    function recomputePresentCodes() {
        const KNOWN = getKnownCodes(); // recalcul dynamique
        const set = new Set();

        const scan = (src) => {
            if (!src || typeof src !== "object") return;
            try {
                Object.entries(src).forEach(([k, v]) => {
                    if (!v || typeof v !== "object") return;
                    Object.entries(v).forEach(([code, qty]) => {
                        if (!KNOWN.has(code)) return;
                        if (MODULE_CODES.has(code)) return;
                        const n = toNum(qty);
                        if (n > 0) set.add(code);
                    });
                });
            } catch {}
        };
        try { scan(window.Colonies); } catch {}
        try { scan(window.Secteurs); } catch {}

        presentCodes = set;
    }

    // ---------- UI ----------
    const ui = CT.win.create({
        id: "ct-fleet-builder",
        title: "Fleet Preset Builder",
        size: [980, 640],
        pos: [120, 100],
        scroll: "hidden", // << important : on gère les scroll internes
        className: "ct-app-fleet-builder"
    });

    const CSS = `
  .ct-app-fleet-builder .fp-root{
    display:flex; flex-direction:column; height:100%;
  }
  .ct-app-fleet-builder .fp-header{flex:0 0 auto; display:flex; flex-direction:column; gap:6px; margin-bottom:6px}
  .ct-app-fleet-builder .fp-presets{display:flex;flex-wrap:wrap;gap:6px}
  .ct-app-fleet-builder .fp-pill{padding:4px 10px;border-radius:999px;background:#0b1120;border:1px solid #223051;cursor:pointer;font-size:12px}
  .ct-app-fleet-builder .fp-pill.active{background:#243358;border-color:#2a4b7a}
  .ct-app-fleet-builder .fp-pill:hover{background:#16203a}

  .ct-app-fleet-builder .fp-controls{display:flex;gap:8px;align-items:center}
  .ct-app-fleet-builder .fp-search{flex:1;padding:6px 10px;border-radius:12px;border:1px solid #2a365a;background:#0b1120;color:#eaeefc;font-size:13px}
  .ct-app-fleet-builder .fp-preset-name{flex:0 0 280px;padding:6px 10px;border-radius:12px;border:1px solid #2a365a;background:#0b1120;color:#eaeefc;font-size:13px}
  .ct-app-fleet-builder .fp-btns{display:flex;gap:4px;align-items:center}
  .ct-app-fleet-builder .fp-btn{width:28px;height:28px;border-radius:6px;background:#1a2240;border:1px solid #2f3d6a;display:flex;align-items:center;justify-content:center;cursor:pointer}
  .ct-app-fleet-builder .fp-btn:hover{background:#202a52}

  .ct-app-fleet-builder .fp-filters{display:flex;align-items:center;gap:12px;margin-top:2px}
  .ct-app-fleet-builder .fp-select{padding:6px 10px;border-radius:12px;border:1px solid #2a365a;background:#0b1120;color:#eaeefc;font-size:13px}
  .ct-app-fleet-builder .fp-check{display:inline-flex;align-items:center;gap:6px;user-select:none}

  /* Main split area */
  .ct-app-fleet-builder .fp-main{
    flex:1 1 auto; min-height:0;  /* important pour scroll internes */
    display:flex; gap:0; overflow:hidden;
    border:1px solid #223051; border-radius:10px; background:#0b1120;
  }
  .ct-app-fleet-builder .fp-left{
    position:relative; flex:1 1 auto; min-width:0; min-height:0; overflow:auto;
  }
  .ct-app-fleet-builder .fp-right{
    position:relative; flex:0 0 auto; width:280px; min-width:220px; max-width:520px;
    border-left:1px solid #223051; background:#0b1120;
    display:flex; flex-direction:column; min-height:0;
  }
  .ct-app-fleet-builder .fp-right-inner{
    padding:10px; overflow:auto; min-height:0; display:flex; flex-direction:column; gap:10px;
  }
  .ct-app-fleet-builder .fp-resizer{
    position:absolute; left:-4px; top:0; bottom:0; width:8px; cursor:col-resize;
  }

  /* Table (scopée au module uniquement) */
  .ct-app-fleet-builder table{width:100%;border-collapse:separate;border-spacing:0;font-size:13px}
  .ct-app-fleet-builder table thead th{position:sticky;top:0;background:#151c2f;border-bottom:1px solid #263251;padding:8px 6px;text-align:left;z-index:1;white-space:nowrap;cursor:pointer}
  .ct-app-fleet-builder table thead th img{width:16px;height:16px;vertical-align:middle}
  .ct-app-fleet-builder table tbody td{padding:6px;border-bottom:1px solid #223051;vertical-align:middle}
  .ct-app-fleet-builder table tbody tr:nth-child(even){background:#0e1426}
  .ct-app-fleet-builder td.code{font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace}
  .ct-app-fleet-builder input.qty{width:86px;padding:5px 6px;border:1px solid #2a365a;border-radius:8px;background:#0b1120;color:#eaeefc;text-align:right}

  /* menu colonnes */
  .ct-app-fleet-builder .fp-colmenu{
    position:fixed; display:none; flex-direction:column; gap:6px;
    background:#151c2f; border:1px solid #3a4a7a; border-radius:10px; padding:10px;
    box-shadow:0 12px 30px rgba(0,0,0,.5); z-index:2147483647; max-height:70vh; overflow:auto;
  }
  .ct-app-fleet-builder .fp-colmenu label{display:flex;align-items:center;gap:8px;white-space:nowrap}

  /* Right column content */
  .ct-app-fleet-builder .fp-section h3{margin:0 0 8px; font-size:13px; color:#ffd4a3; font-weight:700}
  .ct-app-fleet-builder .fp-select-wide{width:100%; padding:6px 10px;border-radius:12px;border:1px solid #2a365a;background:#0b1120;color:#eaeefc;font-size:13px}
  .ct-app-fleet-builder .fp-stats{display:flex; flex-direction:column; gap:6px}
  .ct-app-fleet-builder .fp-stat{display:flex; justify-content:space-between; gap:12px; padding:6px 8px; border:1px solid #223051; border-radius:8px; background:#0f1629}
  .ct-app-fleet-builder .fp-stat .k{opacity:.9}
  .ct-app-fleet-builder .fp-stat .v{font-weight:700}
  .ct-app-fleet-builder .fp-stat .v div{line-height:1.2}

  /* Scrollbars harmonisées (comme les autres modules) */
  .ct-app-fleet-builder .fp-left::-webkit-scrollbar,
  .ct-app-fleet-builder .fp-right-inner::-webkit-scrollbar{
    width:8px;height:8px;background:transparent;
  }
  .ct-app-fleet-builder .fp-left::-webkit-scrollbar-thumb,
  .ct-app-fleet-builder .fp-right-inner::-webkit-scrollbar-thumb{
    background:#1b2440;border-radius:8px;
  }
  /* Firefox */
  .ct-app-fleet-builder .fp-left,
  .ct-app-fleet-builder .fp-right-inner{
    scrollbar-color:#1b2440 transparent;
    scrollbar-width:thin;
  }
  `;
    const st = document.createElement("style");
    st.textContent = CSS;
    document.head.appendChild(st);
    ui.onClose(() => {
        try { st.remove(); colMenu.remove(); stopObs1?.(); stopObs2?.(); stopObsShips?.(); window.__fleetPresetBuilder = undefined; } catch {}
    });

    // Root layout
    const root = document.createElement("div");
    root.className = "fp-root";
    ui.body.append(root);

    // Header
    const header = document.createElement("div");
    header.className = "fp-header";

    // Row 1: Presets pills
    const presetsRow = document.createElement("div");
    presetsRow.className = "fp-presets";

    // Row 2: search + preset name + actions
    const controlsRow = document.createElement("div");
    controlsRow.className = "fp-controls";

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "fp-search";
    searchInput.placeholder = "Recherche vaisseau... (code, nom, châssis)";

    const presetNameInput = document.createElement("input");
    presetNameInput.type = "text";
    presetNameInput.className = "fp-preset-name";
    presetNameInput.placeholder = "Nom du preset…";
    presetNameInput.title = "Modifier le nom du preset";

    const btns = document.createElement("div");
    btns.className = "fp-btns";

    const mkBtn = (title, svg, onClick) => {
        const b = document.createElement("button");
        b.className = "fp-btn";
        b.innerHTML = svg;
        b.title = title;
        b.onclick = onClick;
        return b;
    };

    const icons = {
        add: `<svg viewBox="0 0 24 24" stroke="white" fill="none" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
        save:`<svg viewBox="0 0 24 24" stroke="white" fill="none" stroke-width="2"><path d="M19 21H5V3h11l3 3v15z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
        dup: `<svg viewBox="0 0 24 24" stroke="white" fill="none" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
        del: `<svg viewBox="0 0 24 24" stroke="white" fill="none" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m5-3h4a1 1 0 0 1 1 1v2H9V4a1 1 0 0 1 1-1z"/></svg>`,
        imp: `<svg viewBox="0 0 24 24" stroke="white" fill="none" stroke-width="2"><polyline points="12 3 12 15 16 11"/><path d="M20 21H4a2 2 0 0 1-2-2V7"/></svg>`,
        exp: `<svg viewBox="0 0 24 24" stroke="white" fill="none" stroke-width="2"><polyline points="12 21 12 9 8 13"/><path d="M4 3h16a2 2 0 0 1 2 2v12"/></svg>`,
        cols:`<svg viewBox="0 0 24 24" stroke="white" fill="none" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2" ry="2"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="20"/></svg>`,
        refresh:`<svg viewBox="0 0 24 24" stroke="white" fill="none" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`
    };

    // Menu colonnes
    const colMenu = document.createElement("div");
    colMenu.className = "fp-colmenu";
    ui.root.appendChild(colMenu);

    function buildColMenu(anchorBtn) {
        colMenu.innerHTML = "";
        // Quantité non décochable (toujours visible et dernière)
        COLS_DEF.forEach(c => {
            if (c.key === "Quantite") return;
            const lbl = document.createElement("label");
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = !!colState[c.key];
            cb.onchange = () => {
                colState[c.key] = cb.checked;
                saveCols();
                renderTable();
            };
            const text = document.createTextNode(" " + (c.label || c.key));
            lbl.append(cb, text);
            colMenu.appendChild(lbl);
        });

        // position
        const r = anchorBtn.getBoundingClientRect();
        colMenu.style.display = "flex";
        const mr = colMenu.getBoundingClientRect();
        let left = r.left;
        let top  = r.bottom + 8;
        if (left + mr.width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - mr.width - 8);
        if (top + mr.height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - mr.height - 8);
        colMenu.style.left = `${left}px`;
        colMenu.style.top  = `${top}px`;
    }
    const hideColMenu = () => { colMenu.style.display = "none"; };

    btns.append(
        mkBtn("Rafraîchir données", icons.refresh, () => { recomputePresentCodes(); renderTable(); renderStats(); }),
        mkBtn("Nouveau preset", icons.add, () => newPreset()),
        mkBtn("Sauvegarder preset", icons.save, () => savePreset()),
        mkBtn("Dupliquer preset", icons.dup, () => duplicatePreset()),
        mkBtn("Supprimer preset", icons.del, () => deletePreset()),
        mkBtn("Importer JSON", icons.imp, () => importPresets()),
        mkBtn("Exporter JSON", icons.exp, () => exportPresets()),
        mkBtn("Colonnes", icons.cols, (e) => {
            if (colMenu.style.display === "flex") hideColMenu();
            else buildColMenu(e.currentTarget || e.target);
        })
    );

    controlsRow.append(searchInput, presetNameInput, btns);

    // Row 3: filtres (Châssis + Présents)
    const filtersRow = document.createElement("div");
    filtersRow.className = "fp-filters";

    const chassisSelect = document.createElement("select");
    chassisSelect.className = "fp-select";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "— Tous châssis —";
    chassisSelect.appendChild(optAll);
    // remplir avec châssis rencontrés (via merged list)
    (() => {
        const set = new Set();
        getAllShips().forEach(s => set.add(s.Chassis));
        Array.from(set).sort((a,b)=>chassisName(a).localeCompare(chassisName(b))).forEach(code => {
            const o = document.createElement("option");
            o.value = code;
            o.textContent = chassisName(code);
            chassisSelect.appendChild(o);
        });
    })();
    chassisSelect.value = filters.chassis || "";

    const presentWrap = document.createElement("label");
    presentWrap.className = "fp-check";
    const presentCb = document.createElement("input");
    presentCb.type = "checkbox";
    presentCb.checked = !!filters.presentOnly;
    const presentTxt = document.createElement("span");
    presentTxt.textContent = "Présents (colonies+secteurs)";
    presentWrap.append(presentCb, presentTxt);

    filtersRow.append(chassisSelect, presentWrap);

    // Header assembly
    header.append(presetsRow, controlsRow, filtersRow);
    root.append(header);

    // Main split
    const main = document.createElement("div");
    main.className = "fp-main";

    // Left (table)
    const left = document.createElement("div");
    left.className = "fp-left";

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");
    table.append(thead, tbody);
    left.appendChild(table);

    // Right (sidebar)
    const right = document.createElement("div");
    right.className = "fp-right";
    right.style.width = sideWidth + "px";

    const resizer = document.createElement("div");
    resizer.className = "fp-resizer";
    right.appendChild(resizer);

    const rightInner = document.createElement("div");
    rightInner.className = "fp-right-inner";

    // Mission select
    const missionBox = document.createElement("div");
    missionBox.className = "fp-section";
    missionBox.innerHTML = `<h3>Mission</h3>`;
    const missionSelect = document.createElement("select");
    missionSelect.className = "fp-select-wide";
    const missionOptions = [
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
    missionOptions.forEach(([label,val])=>{
        const o = document.createElement("option");
        o.value = val; o.textContent = label;
        missionSelect.appendChild(o);
    });
    missionBox.appendChild(missionSelect);

    // Stats (vertical list)
    const statsBox = document.createElement("div");
    statsBox.className = "fp-section";
    statsBox.innerHTML = `<h3>Statistiques</h3>`;
    const statsList = document.createElement("div");
    statsList.className = "fp-stats";
    function statRow(label, value="—") {
        const row = document.createElement("div");
        row.className = "fp-stat";
        row.innerHTML = `<span class="k">${label}</span><span class="v">${value}</span>`;
        return row;
    }
    const sPrix   = statRow("Prix");
    const sFret   = statRow("Fret");
    const sEmport = statRow("Emport (AFret)");
    const sVC     = statRow("Vitesse conv.");
    const sVH     = statRow("Vitesse hyp.");
    const sTM     = statRow("T. Manœuvre");
    const sPdf    = statRow("Puissance");
    const sCmd    = statRow("Commandement");
    const sChasses = statRow("Chasses parfaite", "<div>Escorteur —/—</div><div>Intercepteur —/—</div><div>Assaut —/—</div>");
    statsList.append(sPrix, sFret, sEmport, sVC, sVH, sTM, sPdf, sCmd, sChasses);
    statsBox.appendChild(statsList);

    rightInner.append(missionBox, statsBox);
    right.appendChild(rightInner);

    main.append(left, right);
    root.append(main);

    // ---------- Rendu ----------
    function renderPresets() {
        presetsRow.innerHTML = "";
        if (!presets.length) {
            newPreset(true);
            return;
        }
        presets.forEach(p => {
            const pill = document.createElement("div");
            pill.className = "fp-pill" + (p.id === currentId ? " active" : "");
            pill.title = "Cliquer pour activer. Double-clic pour renommer.";

            const span = document.createElement("span");
            span.textContent = p.name || "Preset";
            pill.appendChild(span);

            pill.onclick = () => {
                if (currentId !== p.id) {
                    currentId = p.id;
                    renderPresets();
                    renderTable();
                    renderMission();
                    renderStats();
                }
            };
            pill.ondblclick = () => {
                const nv = prompt("Renommer le preset :", p.name || "");
                if (nv && nv.trim()) {
                    p.name = nv.trim();
                    saveAll();
                    renderPresets();
                    renderTable();
                    renderMission();
                    renderStats();
                }
            };

            presetsRow.appendChild(pill);
        });

        const cur = presets.find(pp => pp.id === currentId);
        presetNameInput.value = cur?.name || "";
    }

    function visibleColsOrder() {
        const base = COLS_DEF.filter(c => colState[c.key] && c.key !== "Quantite");
        const last = COLS_DEF.find(c => c.key === "Quantite");
        return [...base, last];
    }

    function renderTable() {
        // head
        thead.innerHTML = "";
        const trh = document.createElement("tr");
        visibleColsOrder().forEach(col => {
            const th = document.createElement("th");
            if (col.icon) {
                th.innerHTML = `<img src="${col.icon}" alt="${col.label}" title="${col.label}">`;
            } else {
                th.textContent = col.label || col.key;
            }
            th.style.userSelect = "none";
            th.onclick = () => {
                const newKey = col.key;
                if (sortState.key === newKey) {
                    sortState.dir = (sortState.dir === "asc") ? "desc" : "asc";
                } else {
                    sortState.key = newKey;
                    sortState.dir = "asc";
                }
                saveSort();
                renderTable();
            };
            if (sortState.key === col.key) {
                const arrow = document.createElement("span");
                arrow.textContent = sortState.dir === "asc" ? " ▲" : " ▼";
                th.appendChild(arrow);
            }
            trh.appendChild(th);
        });
        thead.appendChild(trh);

        // body
        tbody.innerHTML = "";
        const ships = getAllShips(); // <-- fusion live + cache
        const preset = presets.find(p => p.id === currentId);
        if (!preset) return;

        const filterText = (searchInput.value || "").trim().toLowerCase();
        const chassisFilter = filters.chassis || "";
        const presentOnly = !!filters.presentOnly;

        // tri
        const sorter = COLS_DEF.find(c => c.key === sortState.key)?.sort;
        const dirMul = (sortState.dir === "asc") ? 1 : -1;
        ships.sort((a,b) => {
            if (typeof sorter === "function") {
                const r = sorter(a,b,preset.items);
                return r * dirMul;
            }
            return a.Code.localeCompare(b.Code) * dirMul;
        });

        ships.forEach(s => {
            const ch = chassisName(s.Chassis).toLowerCase();
            const hay = `${s.Code} ${s.Nom} ${s.Chassis} ${ch}`.toLowerCase();
            if (filterText && !hay.includes(filterText)) return;
            if (chassisFilter && s.Chassis !== chassisFilter) return;
            if (presentOnly && !presentCodes.has(s.Code)) return;

            const raw = s._raw || {};
            const tr = document.createElement("tr");

            visibleColsOrder().forEach(col => {
                const td = document.createElement("td");
                switch(col.key) {
                    case "Code": {
                        td.className = "code";
                        const a = document.createElement("a");
                        a.href = `javascript:DevInfo('Vais','${s.Code}')`;
                        a.textContent = s.Code;
                        td.appendChild(a);
                        break;
                    }
                    case "Nom": {
                        const a = document.createElement("a");
                        a.href = `javascript:DevInfo('Vais','${s.Code}')`;
                        a.textContent = s.Nom || "";
                        td.appendChild(a);
                        break;
                    }
                    case "Chassis":
                        td.textContent = chassisName(s.Chassis);
                        break;

                    case "AttAC": td.textContent = abbr(raw.AttAC); break;
                    case "AttEM": td.textContent = abbr(raw.AttEM); break;
                    case "AttLa": td.textContent = abbr(raw.AttLa); break;
                    case "AttPl": td.textContent = abbr(raw.AttPl); break;

                    case "BonusCiblage": {
                        const v = toNum(raw.BonusCiblage);
                        td.textContent = v ? `x${v}` : "x0";
                        break;
                    }
                    case "Cible": {
                        const v = String(raw.Cible || "").trim();
                        td.textContent = v ? v : "Aucune";
                        break;
                    }
                    case "Structure": td.textContent = abbr(raw.Structure); break;
                    case "Fret":      td.textContent = abbr(raw.Fret); break;
                    case "AFret":     td.textContent = abbr(raw.AFret); break;

                    case "Pcom": {
                        const v = raw.Pcom;
                        td.textContent = (v == null || v === "") ? "?" : String(v);
                        break;
                    }

                    case "TempsM":   td.textContent = fmtSecondsShort(raw.TempsM); break;
                    case "VitesseC": td.textContent = abbr(raw.VitesseC); break;
                    case "VitesseH": td.textContent = abbr(raw.VitesseH); break;

                    case "Chasses": {
                        const c1 = raw.Ch1 != null ? `${toNum(raw.Ch1)}%` : "?";
                        const c2 = raw.Ch2 != null ? `${toNum(raw.Ch2)}%` : "?";
                        const c3 = raw.Ch3 != null ? `${toNum(raw.Ch3)}%` : "?";
                        td.textContent = `${c1}/${c2}/${c3}`;
                        break;
                    }

                    case "Quantite": {
                        const inp = document.createElement("input");
                        inp.type = "number";
                        inp.min = "0";
                        inp.className = "qty";
                        inp.value = String(preset.items?.[s.Code] || 0);
                        inp.oninput = () => {
                            if (!preset.items) preset.items = {};
                            const n = Math.max(0, Number(inp.value) || 0);
                            preset.items[s.Code] = n;
                            saveAll();
                            renderStats();
                        };
                        td.appendChild(inp);
                        break;
                    }

                    default:
                        td.textContent = "";
                }
                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });
    }

    // ---------- Mission + Stats ----------
    function renderMission() {
        const cur = presets.find(pp => pp.id === currentId);
        if (!cur) return;
        missionSelect.value = cur.mission || "";
    }

    function computeStats() {
        const preset = presets.find(p => p.id === currentId);
        if (!preset) return {
            prix:0, fret:0, emport:0, vC:0, vH:0, tM:0, pdf:0, pcom:0,
            needA1:0, needA2:0, needA3:0, selA1:0, selA2:0, selA3:0
        };

        const ships = getAllShips(); // <-- fusion live + cache
        const byCode = new Map(ships.map(s => [s.Code, s._raw || {}]));

        // Accumulateurs
        let PrixV = 0;
        let SFretC = 0;
        let SAFretC = 0;

        let AVitesseC = Infinity;
        let AVitesseH = Infinity;
        let FTempsM = 0;

        let FlottePdF = 0;
        let FlottePCom = 0;

        // Chasses parfaite (besoins vs sélection)
        let needA1 = 0, needA2 = 0, needA3 = 0;  // nécessaires
        let selA1 = 0,  selA2 = 0,  selA3 = 0;   // sélectionnés

        const J = window.Joueur || {};
        const P = (window.planete || window.Planete || {});
        const Bat = (P.Batiments || P['Batiments']) || {};
        const BatAS = toNum(Bat.BatAS);

        const TechPC = toNum(J.TechPC);
        const TechPH = toNum(J.TechPH);
        const TechAC = toNum(J.TechAC);
        const TechLa = toNum(J.TechLa);
        const TechPl = toNum(J.TechPl);
        const TechIEM= toNum(J.TechIEM);

        ships.forEach(s => {
            const qty = toNum(preset.items?.[s.Code]);
            if (qty <= 0) return;
            const v = byCode.get(s.Code) || {};
            const Type = String(v.Type || "");
            const Chassis = String(v.Chassis || "");

            // Coef compétences
            let Coef = 1;
            if (hasCompetence('9') && (Type === 'A' || Type === 'B' || Type === 'C' || Type === 'D')) {
                Coef = 1.25;
            }
            if (hasCompetence('10') && !(Type === 'A' || Type === 'B' || Type === 'C' || Type === 'D')) {
                Coef = 1.25;
            }

            // Prix total (ZRC)
            PrixV += qty * toNum(v.ZRC);

            // Fret & AFret
            const AF = toNum(v.AFret);
            SFretC  += qty * toNum(v.Fret);
            SAFretC += qty * AF;

            // Chasses parfaite — besoins générés par l'AFret avec répartition Ch1/Ch2/Ch3
            if (AF > 0) {
                needA1 += qty * AF * (toNum(v.Ch1) / 100);
                needA2 += qty * AF * (toNum(v.Ch2) / 100);
                needA3 += qty * AF * (toNum(v.Ch3) / 100);
            }

            // Chasses sélectionnées (quantités de chasseurs A1/A2/A3)
            if (Chassis === 'A1') selA1 += qty;
            else if (Chassis === 'A2') selA2 += qty;
            else if (Chassis === 'A3') selA3 += qty;

            // Vitesse min (avec bonus techno & coef comp)
            const vC = Coef * toNum(v.VitesseC) * (1 + 0.1 * TechPC);
            const vH = Coef * toNum(v.VitesseH) * (1 + 0.1 * TechPH);
            if (qty > 0) {
                AVitesseC = Math.min(AVitesseC, vC > 0 ? vC : Infinity);
                AVitesseH = Math.min(AVitesseH, vH > 0 ? vH : Infinity);
            }

            // Temps de manoeuvre (max)
            let TempsMV = toNum(v.TempsM);
            if (Type === 'T') {
                TempsMV = Math.max(10, TempsMV - BatAS);
            }
            FTempsM = Math.max(FTempsM, TempsMV);

            // Puissance de feu
            let Att = toNum(v.AttAC)*(1+0.10*TechAC)
                + toNum(v.AttLa)*(1+0.10*TechLa)
                + toNum(v.AttPl)*(1+0.10*TechPl)
                + toNum(v.AttEM)*(1+0.10*TechIEM);
            if (hasCompetence('3')) Att *= 1.15;
            FlottePdF += qty * Att;

            // Commandement
            FlottePCom += qty * toNum(v.PCom || v.Pcom);
        });

        return {
            prix: PrixV,
            fret: SFretC,
            emport: SAFretC,
            vC: (AVitesseC === Infinity ? 0 : AVitesseC),
            vH: (AVitesseH === Infinity ? 0 : AVitesseH),
            tM: FTempsM,
            pdf: FlottePdF,
            pcom: FlottePCom,
            needA1, needA2, needA3,
            selA1,  selA2,  selA3
        };
    }

    function renderStats() {
        const stt = computeStats();
        sPrix.querySelector(".v").textContent   = abbr(stt.prix);
        sFret.querySelector(".v").textContent   = abbr(stt.fret);
        sEmport.querySelector(".v").textContent = abbr(stt.emport);
        sVC.querySelector(".v").textContent     = stt.vC ? abbr(stt.vC) : "—";
        sVH.querySelector(".v").textContent     = stt.vH ? abbr(stt.vH) : "—";
        sTM.querySelector(".v").textContent     = stt.tM ? fmtSecondsShort(stt.tM) : "—";
        sPdf.querySelector(".v").textContent    = abbr(stt.pdf);
        sCmd.querySelector(".v").textContent    = abbr(stt.pcom);

        const fmt = (sel, need) => `${Math.round(sel)}/${Math.round(need)}`;
        sChasses.querySelector(".v").innerHTML =
            `<div>Escorteur ${fmt(stt.selA1, stt.needA1)}</div>`+
            `<div>Intercepteur ${fmt(stt.selA2, stt.needA2)}</div>`+
            `<div>Assaut ${fmt(stt.selA3, stt.needA3)}</div>`;
    }

    // ---------- Actions ----------
    function newPreset(silent = false) {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
        const name = `Preset ${presets.length + 1}`;
        const p = { id, name, items:{}, mission:"" };
        presets.push(p);
        currentId = id;
        saveAll();
        renderPresets();
        renderTable();
        renderMission();
        renderStats();
        if (!silent) alert("Nouveau preset créé.");
    }

    function savePreset() {
        const cur = presets.find(pp => pp.id === currentId);
        if (cur) {
            cur.name = (presetNameInput.value || "").trim() || cur.name || "Preset";
            cur.mission = missionSelect.value || cur.mission || "";
        }
        saveAll();
        renderPresets();
        alert("Preset sauvegardé !");
    }

    function duplicatePreset() {
        const preset = presets.find(p => p.id === currentId);
        if (!preset) return;
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
        const copy = { id, name:(preset.name || "Preset")+" (copie)", items:{...preset.items}, mission: preset.mission || "" };
        presets.push(copy);
        currentId = id;
        saveAll();
        renderPresets();
        renderTable();
        renderMission();
        renderStats();
    }

    function deletePreset() {
        const idx = presets.findIndex(p => p.id === currentId);
        if (idx < 0) return;
        if (!confirm("Supprimer ce preset ?")) return;
        presets.splice(idx, 1);
        currentId = presets[0]?.id || null;
        saveAll();
        renderPresets();
        renderTable();
        renderMission();
        renderStats();
    }

    function importPresets() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json";
        input.onchange = e => {
            const file = e.target.files?.[0];
            if (!file) return;
            const r = new FileReader();
            r.onload = () => {
                try {
                    const data = JSON.parse(r.result);
                    if (Array.isArray(data)) {
                        presets.splice(0, presets.length, ...data);
                        currentId = presets[0]?.id || null;
                        saveAll();
                        renderPresets();
                        renderTable();
                        renderMission();
                        renderStats();
                    } else {
                        alert("JSON invalide : attendu un tableau de presets.");
                    }
                } catch(err) {
                    console.error(err);
                    alert("JSON invalide.");
                }
            };
            r.readAsText(file);
        };
        input.click();
    }

    function exportPresets() {
        CT.export.json("fleet_presets", presets);
    }

    // ---------- Wire ----------
    searchInput.oninput = () => { renderTable(); };
    presetNameInput.oninput = () => {
        const cur = presets.find(pp => pp.id === currentId);
        if (cur) { cur.name = presetNameInput.value || ""; saveAll(); renderPresets(); }
    };
    missionSelect.onchange = () => {
        const cur = presets.find(pp => pp.id === currentId);
        if (cur) { cur.mission = missionSelect.value || ""; saveAll(); }
    };
    chassisSelect.onchange = () => {
        filters.chassis = chassisSelect.value || "";
        saveFilters();
        renderTable();
    };
    presentCb.onchange = () => {
        filters.presentOnly = !!presentCb.checked;
        saveFilters();
        renderTable();
    };

    document.addEventListener("click",(ev)=>{
        // Fermer menu colonnes si clic ailleurs
        if (colMenu.style.display === "flex" && !colMenu.contains(ev.target) && !ev.target.closest(".fp-btn")) {
            hideColMenu();
        }
    }, true);

    // Resizer logique
    (() => {
        let dragging = false;
        let startX = 0;
        let startW = sideWidth;

        const onMouseMove = (e) => {
            if (!dragging) return;
            const dx = startX - e.clientX; // poignée à gauche de la colonne
            let w = Math.min(520, Math.max(220, startW + dx));
            sideWidth = w;
            right.style.width = w + "px";
        };
        const onMouseUp = () => {
            if (!dragging) return;
            dragging = false;
            document.removeEventListener("mousemove", onMouseMove, true);
            document.removeEventListener("mouseup", onMouseUp, true);
            saveSideWidth();
        };
        resizer.addEventListener("mousedown", (e)=>{
            e.preventDefault();
            dragging = true;
            startX = e.clientX;
            startW = right.getBoundingClientRect().width;
            document.addEventListener("mousemove", onMouseMove, true);
            document.addEventListener("mouseup", onMouseUp, true);
        });
    })();

    // Observers pour mises à jour
    recomputePresentCodes();
    const stopObs1 = CT.observe(() => window.Colonies, () => {
        recomputePresentCodes();
        if (filters.presentOnly) { renderTable(); }
    }, { interval: 2000 });
    const stopObs2 = CT.observe(() => window.Secteurs, () => {
        recomputePresentCodes();
        if (filters.presentOnly) { renderTable(); }
    }, { interval: 2000 });

    // Observer dédié aux Vaisseaux : si la taille du dictionnaire augmente, on rafraîchit (et le cache sera mis à jour par getAllShips)
    const stopObsShips = CT.observe(() => {
        try { return Object.keys(window.Vaisseaux || {}).length; } catch { return 0; }
    }, () => {
        recomputePresentCodes();
        renderTable();
        renderStats();
    }, { interval: 3000 });

    // Init
    renderPresets();
    renderTable();
    renderMission();
    renderStats();

    // API publique
    window.__fleetPresetBuilder = {
        open() { ui.bringToFront?.(); renderPresets(); renderTable(); renderMission(); renderStats(); }
    };
})();
