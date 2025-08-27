// favories.js — Module "Favories" ultra-minimal (raccourcis rapides)
(() => {
    // --- anti-double-injection
    if (window.__favories && typeof window.__favories.open === 'function') {
        window.__favories.open();
        return;
    }
    window.__favories = {};

    // --- dépendance core
    if (!window.CT || !CT.__ready) {
        console.error('CT core manquant. Injecte ct_core.js d’abord.');
        return;
    }

    // ---------- Helpers ----------
    const FAV_KEY = 'favorites:v1';
    const thumb = id => `https://horizon.celestus.fr/CelestusV2/Interface/Decors/Planetes/thumbnails/${id}.png`;

    function getFavs() {
        try {
            const v = CT.store.get(FAV_KEY, []);
            return Array.isArray(v) ? v : [];
        } catch { return []; }
    }
    function removeFav(kind, id) {
        const key = `${kind}:${id}`;
        const cur = getFavs();
        const next = cur.filter(f => `${f.kind}:${f.id}` !== key);
        try {
            CT.store.set(FAV_KEY, next);
            window.dispatchEvent(new CustomEvent('ct:fav:changed'));
        } catch {}
    }
    function sid() {
        try { return (window.Joueur && window.Joueur.Session) ? window.Joueur.Session : ''; } catch { return ''; }
    }

    // ---------- UI ----------
    const ui = CT.win.create({
        id: 'ct-favories',
        title: 'Favories',
        size: [332, 266],        // <<< taille par défaut demandée
        pos: [100, 80],
        scroll: 'auto',
        className: 'ct-app-fav'
    });

    // CSS très compact
    const CSS = `
  .ct-app-fav .fv-controls{display:flex;justify-content:space-between;align-items:center;margin:4px 0 6px}
  .ct-app-fav .fv-input{padding:6px 10px;border-radius:12px;border:1px solid #2a365a;background:#0b1120;color:#eaeefc;min-width:220px;font-size:13px}

  .ct-app-fav .fv-list{display:flex;flex-direction:column;gap:4px}

  /* grille adaptée à la petite largeur */
  .ct-app-fav .fv-row{
    display:grid;grid-template-columns:74px 1fr 128px;gap:6px;align-items:center;
    padding:6px;border:1px solid #1b2542;border-radius:10px;background:#121a31;
  }
  .ct-app-fav .fv-c1{display:flex;align-items:center;gap:6px;justify-content:center}
  .ct-app-fav .fv-thumb{width:48px;height:36px;border-radius:8px;object-fit:cover;border:1px solid #223051}
  .ct-app-fav .fv-rac{display:inline-block;height:36px;width:16px;background:url('https://horizon.celestus.fr/CelestusV2/Interface/Skin/Boutons/RacPlanete.png') center/contain no-repeat;border-radius:4px}

  .ct-app-fav .fv-c2{display:flex;flex-direction:column;gap:2px;align-items:flex-start;min-width:0}
  .ct-app-fav .fv-name{font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
  .ct-app-fav a{color:#eaeefc;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}

  .ct-app-fav .fv-actions{display:flex;justify-content:flex-end;gap:6px}
  .ct-app-fav .fv-actions a{
    display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;
    border-radius:6px;background:#1a2240;border:1px solid #2f3d6a;
  }
  .ct-app-fav .fv-actions a:hover{background:#202a52}
  .ct-app-fav .fv-actions img{width:16px;height:16px}
  `;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    ui.onClose(()=>{ try{ st.remove(); window.__favories=undefined; }catch{} });

    // Controls (recherche uniquement)
    const controls = document.createElement('div'); controls.className='fv-controls';
    const search = document.createElement('input'); search.className='fv-input'; search.placeholder='Recherche nom/adresse…';
    controls.append(search);

    // Liste (pas d’en-tête)
    const list = document.createElement('div'); list.className='fv-list';
    ui.body.append(controls, list);

    // ---------- Render ----------
    function buildRow(item){
        const row = document.createElement('div'); row.className='fv-row';

        // col 1: ciblage + image
        const c1 = document.createElement('div'); c1.className='fv-c1';
        const aRac = document.createElement('a'); aRac.className='fv-rac'; aRac.title='Cibler';
        const rk = String(item.rowKey||'').replace(/'/g,"\\'");
        let type = "racourcis_secteurs";
        if(item.kind === "colony"){
            type = "racourcis_colonies";
        }
        aRac.href = `javascript:RemplirChampsPlanete('${type}','${rk}')`;


        c1.appendChild(aRac);
        if (item.img) {
            const im = document.createElement('img'); im.className='fv-thumb'; im.src = thumb(item.img);
            c1.appendChild(im);
        }

        // col 2: nom + adresse (colonie) | adresse seule (secteur)
        const c2 = document.createElement('div'); c2.className='fv-c2';
        if (item.kind === 'colony' && item.nom) {
            const nm = document.createElement('div'); nm.className='fv-name'; nm.textContent = String(item.nom||'');
            c2.appendChild(nm);
        }
        const link = document.createElement('a');
        link.href = `../Programme/Planete.php?ID=${encodeURIComponent(item.id||'')}&Serv=1`;
        link.target = 'Programme';
        link.textContent = String(item.adresse||'');
        c2.appendChild(link);

        // col 3: actions (+ supprimer, même style)
        const c3 = document.createElement('div'); c3.className='fv-actions';
        const S = sid();
        const aF = document.createElement('a'); aF.title='Flottes';
        aF.href = `../Programme/Flottes.php?S_id=${S}&IDCible=${encodeURIComponent(item.id||'')}`;
        aF.target = 'Programme';
        aF.innerHTML = `<img src="https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/UIcoFlotte.png" alt="">`;

        const aR = document.createElement('a'); aR.title='Récolter';
        aR.href = `../Programme/UniversOrdres.php?S_id=${S}&Ordre=recolter&IDCible=${encodeURIComponent(item.id||'')}`;
        aR.target = 'Programme';
        aR.innerHTML = `<img src="https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/UIcoRecolter.png" alt="">`;

        const aO = document.createElement('a'); aO.title='Ordinateur';
        aO.href = `../Programme/UniversOrdres.php?S_id=${S}&Ordre=ordinateur&IDCible=${encodeURIComponent(item.id||'')}`;
        aO.target = 'Programme';
        aO.innerHTML = `<img src="https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/UIcoOrdinateur.png" alt="">`;

        const aX = document.createElement('a'); aX.title='Retirer des Favories';
        aX.href = 'javascript:void(0)';
        aX.textContent = '✖';
        aX.onclick = (e)=>{ e.preventDefault(); removeFav(item.kind, item.id); };

        c3.append(aF, aR, aO, aX);

        row.append(c1, c2, c3);
        return row;
    }

    function render() {
        const q = (search.value||'').trim().toLowerCase();
        const items = getFavs();

        // Tri léger: colonies avant secteurs, puis par nom/adresse
        items.sort((a,b)=>{
            if (a.kind !== b.kind) return a.kind === 'colony' ? -1 : 1;
            const an = ((a.nom||'') + ' ' + (a.adresse||'')).toLowerCase();
            const bn = ((b.nom||'') + ' ' + (b.adresse||'')).toLowerCase();
            return an.localeCompare(bn);
        });

        const filtered = (!q) ? items : items.filter(it=>{
            const t = ((it.nom||'') + ' ' + (it.adresse||'')).toLowerCase();
            return t.includes(q);
        });

        list.innerHTML = '';
        if (!filtered.length) {
            const empty = document.createElement('div');
            empty.style.opacity = '.8';
            empty.style.textAlign = 'center';
            empty.style.padding = '8px';
            empty.textContent = 'Aucun favori.';
            list.appendChild(empty);
            return;
        }
        filtered.forEach(it => list.appendChild(buildRow(it)));
    }

    // events
    search.oninput = render;
    window.addEventListener('ct:fav:changed', render);

    // première peinture
    render();

    // API
    window.__favories = {
        open(){ ui.bringToFront?.(); render(); }
    };
})();
