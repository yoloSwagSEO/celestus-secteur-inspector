// racourcis.js — Panneau "Raccourcis" (onglets Raccourcis/Config via engrenage) — v1.2
(() => {
    if (!window.CT || !CT.__ready) { console.error('CT core manquant. Injecte ct_core.js d’abord.'); return; }
    if (window.__racourcis && typeof window.__racourcis.open === 'function') { window.__racourcis.open(); return; }

    // ---------- Utils ----------
    const STORE_KEY = 'shortcuts:v1';
    const loadConfig = () => {
        try { const v = CT.store.get(STORE_KEY, null); return (v && typeof v==='object') ? v : {}; }
        catch { return {}; }
    };
    const saveConfig = (cfg) => { try { CT.store.set(STORE_KEY, cfg || {}); } catch {} };
    const sid = () => {
        try { return (window.Joueur && window.Joueur.Session) ? String(window.Joueur.Session) : ''; }
        catch { return ''; }
    };
    const isJsLink = (href) => /^javascript:/i.test(href || '');

    // remplace la valeur de S_id si présente (sans ajouter si absent)
    function applySid(href, sessionId){
        if (!href || isJsLink(href)) return href;
        if (!/S_id=/.test(href)) return href;
        const repl = sessionId || '';
        return href.replace(/([?&])S_id=[^&#]*/i, `$1S_id=${encodeURIComponent(repl)}`);
    }

    // ---------- Source de liens ----------
    const ALL_LINKS = [
        { id:'bat',   label:'Bâtiments',     href:'../Programme/Batiments.php?S_id=7052' },
        { id:'tech',  label:'Technologies',  href:'../Programme/Technologies.php?S_id=7052' },
        { id:'ship',  label:'Chant. Spatial',href:'../Programme/Vaisseaux.php?S_id=7052' },
        { id:'def',   label:'Chant. Défense',href:'../Programme/Defenses.php?S_id=7052' },
        { id:'acad',  label:'Académie',      href:'../Programme/Academie.php?S_id=7052' },
        { id:'inf',   label:'Caserne',       href:'../Programme/Infanterie.php?S_id=7052' },
        { id:'fleet', label:'Flottes',       href:'../Programme/Flottes.php?S_id=7052' },
        { id:'carte', label:'Carte',         href:'../Programme/CarteSys.php?Ini=1' },

        { id:'ordi',  label:'Ordinateur',    href:'javascript:PageOrdinateur()' },
        { id:'actions_panel', label:'Actions', href:'javascript:PageActions();' },

        { id:'actions_def',   label:'Défenses',     href:'../Programme/Actions.php?S_id=7052&Menu=DEF' },
        { id:'actions_explo', label:'Ana. Artefact',href:'../Programme/Actions.php?S_id=7052&Menu=Explo' },
        { id:'actions_tc',    label:'Technocité',   href:'../Programme/Actions.php?S_id=7052&Menu=TC' },
        { id:'actions_m7',    label:'Terraformer',  href:'../Programme/Actions.php?S_id=7052&Menu=M7' },

        { id:'empire', label:'Empire',         href:'../Programme/MEmpire.php' },
        { id:'commerce', label:'Commerce',     href:'javascript:PageCommerce()' },
        { id:'xp',     label:'Spécialisation', href:'../Programme/Experience.php?S_id=7052' },
        { id:'assur',  label:'Assurance',      href:'../Programme/AssuranceSpatiale.php?S_id=7052' },

        { id:'faction', label:'Faction',       href:'javascript:PageFactions();' },
        { id:'guilde',  label:'Guilde',        href:'javascript:PageGuildes();' },
        { id:'rens',    label:'Renseignement', href:'javascript:PageRenseignements();' },
    ];

    // config par défaut : tous affichés
    const DEFAULT_VISIBLE = ALL_LINKS.reduce((m, l) => (m[l.id] = true, m), {});
    let visibleMap = Object.assign({}, DEFAULT_VISIBLE, loadConfig());

    // ---------- UI ----------
    const ui = CT.win.create({
        id: 'ct-racourcis',
        title: 'Raccourcis',
        size: [157, 256],       // <<< nouvelle taille par défaut
        pos: [420, 40],
        scroll: 'auto',
        className: 'ct-app-racourcis'
    });
    ui.onClose(()=>{ try{ st.remove(); }catch{} try{ window.__racourcis = undefined; }catch{} });

    const CSS = `
  .ct-app-racourcis .rc-tabs{display:flex;gap:6px;margin:2px 0 6px;align-items:center}
  .ct-app-racourcis .rc-tab{padding:4px 8px;border-radius:999px;border:1px solid #2a365a;background:#18213a;color:#eaeefc;cursor:pointer;font-size:12px}
  .ct-app-racourcis .rc-tab.active{background:#27406e}

  .ct-app-racourcis .rc-gear{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;
    border-radius:8px;border:1px solid #2a365a;background:#18213a;cursor:pointer}
  .ct-app-racourcis .rc-gear:hover{background:#1f2a49}
  .ct-app-racourcis .rc-gear svg{width:14px;height:14px;stroke:#eaeefc;fill:none;stroke-width:2}

  .ct-app-racourcis .rc-list{display:grid;grid-template-columns:1fr;gap:6px}
  .ct-app-racourcis .rc-link{display:block;text-decoration:none;text-align:center;padding:6px 8px;border-radius:8px;border:1px solid #2a365a;background:#243358;color:#eaeefc;font-size:12px}
  .ct-app-racourcis .rc-link:hover{background:#2a4b7a}

  .ct-app-racourcis .rc-config{display:grid;grid-template-columns:1fr;gap:6px}
  .ct-app-racourcis .rc-item{display:flex;align-items:center;gap:6px;background:#0b1120;border:1px solid #223051;border-radius:8px;padding:6px}
  .ct-app-racourcis .rc-item label{flex:1;font-size:12px}

  /* compacité générale */
  .ct-app-racourcis .ct-body{padding:8px}
  `;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

    const tabs = document.createElement('div'); tabs.className = 'rc-tabs';

    // Onglet "Raccourcis" (texte)
    const tabList = document.createElement('button');
    tabList.className='rc-tab active';
    tabList.textContent='Raccourcis';
    tabList.title = 'Afficher la liste de raccourcis';

    // Bouton engrenage pour config
    const btnCfg = document.createElement('button');
    btnCfg.className = 'rc-gear';
    btnCfg.title = 'Config';
    btnCfg.setAttribute('aria-label','Config');
    btnCfg.innerHTML = `
    <svg viewBox="0 0 24 24">
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"></path>
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 8 8 0 0 1-2.3.9 1 1 0 0 0-.8.9V21a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.8-.9 8 8 0 0 1-2.3-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 8 8 0 0 1-.9-2.3 1 1 0 0 0-.9-.8H3a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.8 8 8 0 0 1 .9-2.3 1 1 0 0 0-.2-1.1l-.1-.1A2 2 0 1 1 7.5 3.5l.1.1a1 1 0 0 0 1.1.2 8 8 0 0 1 2.3-.9 1 1 0 0 0 .8-.9V3a2 2 0 1 1 4 0v.2a1 1 0 0 0 .8.9 8 8 0 0 1 2.3.9 1 1 0 0 0 1.1-.2l.1-.1A2 2 0 1 1 21.9 7l-.1.1a1 1 0 0 0-.2 1.1 8 8 0 0 1 .9 2.3 1 1 0 0 0 .9.8H22a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.8 8 8 0 0 1-.9 2.3z" />
    </svg>
  `;

    tabs.append(tabList, btnCfg);

    const viewList = document.createElement('div'); viewList.className='rc-list';
    const viewCfg  = document.createElement('div'); viewCfg.className='rc-config'; viewCfg.style.display='none';

    ui.body.append(tabs, viewList, viewCfg);

    function renderList(){
        viewList.innerHTML = '';
        const S = sid();
        ALL_LINKS.forEach(link=>{
            if (!visibleMap[link.id]) return;
            const a = document.createElement('a');
            a.className = 'rc-link';
            a.textContent = link.label || link.id;
            if (isJsLink(link.href)) {
                a.href = link.href;
            } else {
                a.href = applySid(link.href, S);
                a.target = 'Programme';
            }
            viewList.appendChild(a);
        });
    }

    function renderConfig(){
        viewCfg.innerHTML = '';
        ALL_LINKS.forEach(link=>{
            const row = document.createElement('div'); row.className='rc-item';
            const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = !!visibleMap[link.id];
            const lbl = document.createElement('label'); lbl.textContent = link.label || link.id;
            cb.onchange = ()=>{ visibleMap[link.id] = cb.checked; saveConfig(visibleMap); renderList(); };
            row.append(cb, lbl);
            viewCfg.appendChild(row);
        });
    }

    function showList(){
        tabList.classList.add('active');
        viewList.style.display='';
        viewCfg.style.display='none';
    }
    function showCfg(){
        tabList.classList.remove('active');
        viewList.style.display='none';
        viewCfg.style.display='';
    }

    tabList.onclick = showList;
    btnCfg.onclick  = showCfg;

    // initial
    renderList();
    renderConfig();

    window.__racourcis = {
        open(){ ui.setSize(157, 269); ui.bringToFront?.(); }
    };
})();
