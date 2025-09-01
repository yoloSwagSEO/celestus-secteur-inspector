// favories.js — Module "Favories" (image cliquable + raccourcis clavier)
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
        size: [332, 266],
        pos: [100, 80],
        scroll: 'auto',
        className: 'ct-app-fav'
    });

    // CSS très compact
    const CSS = `
  .ct-app-fav .fv-controls{display:flex;justify-content:space-between;align-items:center;margin:4px 0 6px}
  .ct-app-fav .fv-input{padding:6px 10px;border-radius:12px;border:1px solid #2a365a;background:#0b1120;color:#eaeefc;min-width:220px;font-size:13px}

  .ct-app-fav .fv-list{display:flex;flex-direction:column;gap:4px}

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

    // ---------- État pour la navigation clavier ----------
    let lastFiltered = [];     // tableau des items affichés (ordre actuel)
    let navIndex = -1;         // index courant pour Flèche gauche/droite (dans lastFiltered)

    // Renvoie tous les anchors d’adresse actuellement rendus (même ordre que lastFiltered)
    function getAddressAnchors() {
        return Array.from(list.querySelectorAll('.fv-row a.fv-link'));
    }

    // Ouvre un anchor de façon fiable (cible Programme si définie)
    function openAnchor(a) {
        if (!a) return;
        const href = a.getAttribute('href');
        const target = a.getAttribute('target') || '_self';
        try { window.open(href, target); } catch { a.click(); }
    }

    // ---------- Render ----------
    function buildRow(item){
        const row = document.createElement('div'); row.className='fv-row';

        // col 1: ciblage + image (image cliquable -> même href que l'adresse)
        const c1 = document.createElement('div'); c1.className='fv-c1';
        const aRac = document.createElement('a'); aRac.className='fv-rac'; aRac.title='Cibler';
        const rk = String(item.rowKey||'').replace(/'/g,"\\'");
        let type = (item.kind === "colony") ? "racourcis_colonies" : "racourcis_secteurs";
        aRac.href = `javascript:RemplirChampsPlanete('${type}','${rk}')`;
        c1.appendChild(aRac);

        // Lien d’adresse (servira aussi pour l’image)
        const addrHref = `../Programme/Planete.php?ID=${encodeURIComponent(item.id||'')}&Serv=1`;
        const addrTarget = 'Programme';

        if (item.img) {
            const imgLink = document.createElement('a');
            imgLink.href = addrHref; imgLink.target = addrTarget; imgLink.className = 'fv-img-link';
            const im = document.createElement('img'); im.className='fv-thumb'; im.src = thumb(item.img);
            imgLink.appendChild(im);
            c1.appendChild(imgLink);
        }

        // col 2: nom + adresse (colonie) | adresse seule (secteur)
        const c2 = document.createElement('div'); c2.className='fv-c2';
        if (item.kind === 'colony' && item.nom) {
            const nm = document.createElement('div'); nm.className='fv-name'; nm.textContent = String(item.nom||'');
            c2.appendChild(nm);
        }
        const link = document.createElement('a');
        link.href = addrHref;
        link.target = addrTarget;
        link.textContent = String(item.adresse||'');
        link.className = 'fv-link'; // <- pour les raccourcis clavier
        c2.appendChild(link);

        // col 3: actions (+ supprimer)
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

    function computeFiltered(){
        const q = (search.value||'').trim().toLowerCase();
        const items = getFavs();

        // Tri léger: colonies avant secteurs, puis par nom/adresse
        items.sort((a,b)=>{
            if (a.kind !== b.kind) return a.kind === 'colony' ? -1 : 1;
            const an = ((a.nom||'') + ' ' + (a.adresse||'')).toLowerCase();
            const bn = ((b.nom||'') + ' ' + (b.adresse||'')).toLowerCase();
            return an.localeCompare(bn);
        });

        return (!q) ? items : items.filter(it=>{
            const t = ((it.nom||'') + ' ' + (it.adresse||'')).toLowerCase();
            return t.includes(q);
        });
    }

    function render() {
        lastFiltered = computeFiltered(); // <-- garde la liste affichée pour les raccourcis
        list.innerHTML = '';
        if (!lastFiltered.length) {
            const empty = document.createElement('div');
            empty.style.opacity = '.8';
            empty.style.textAlign = 'center';
            empty.style.padding = '8px';
            empty.textContent = 'Aucun favori.';
            list.appendChild(empty);
            navIndex = -1;
            return;
        }
        lastFiltered.forEach(it => list.appendChild(buildRow(it)));
        // reset l’index nav quand la liste change
        navIndex = (navIndex >= 0 && navIndex < lastFiltered.length) ? navIndex : 0;
    }

    // ---------- Raccourcis clavier ----------
    function onKeyDown(e){
        // Ignorer si on tape dans un champ de saisie (notamment la recherche)
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
        const isTyping = (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable);
        if (isTyping) return;

        if (!e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;

        // Shift + 1..9 -> ouvre favori N
        if (/^[1-9]$/.test(e.key)) {
            const n = Number(e.key);
            const anchors = getAddressAnchors();
            if (n >= 1 && n <= anchors.length) {
                e.preventDefault();
                e.stopPropagation();
                navIndex = n - 1;
                openAnchor(anchors[navIndex]);
            }
            return;
        }

        // Shift + Flèche droite = favori précédent (clic adresse)
        if (e.key === 'ArrowRight') {
            const anchors = getAddressAnchors();
            if (!anchors.length) return;
            e.preventDefault(); e.stopPropagation();
            if (navIndex < 0) navIndex = 0;
            else navIndex = (navIndex - 1 + anchors.length) % anchors.length;
            openAnchor(anchors[navIndex]);
            return;
        }

        // Shift + Flèche gauche = favori suivant (clic adresse)
        if (e.key === 'ArrowLeft') {
            const anchors = getAddressAnchors();
            if (!anchors.length) return;
            e.preventDefault(); e.stopPropagation();
            if (navIndex < 0) navIndex = 0;
            else navIndex = (navIndex + 1) % anchors.length;
            openAnchor(anchors[navIndex]);
            return;
        }
    }

    // events
    search.oninput = () => { render(); };
    window.addEventListener('ct:fav:changed', render);
    window.addEventListener('keydown', onKeyDown, true); // capture tôt

    // nettoyage à la fermeture
    ui.onClose(()=>{ window.removeEventListener('keydown', onKeyDown, true); });

    // première peinture
    render();

    // API
    window.__favories = {
        open(){ ui.bringToFront?.(); render(); }
    };
})();
