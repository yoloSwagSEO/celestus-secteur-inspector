// resources_bar.js — Stocks (rendu compact selon tes consignes)
(() => {
    if (!window.CT || !CT.__ready) { console.error('CT core manquant. Injecte ct_core.js d’abord.'); return; }

    // Si une instance existe mais n'est plus dans le DOM on recrée
    if (window.__stocksBar && typeof window.__stocksBar.open === 'function') {
        try {
            const stillThere = document.querySelector('.ct-app-stocks');
            if (stillThere) { window.__stocksBar.open(); return; }
        } catch {}
    }

    // ---------- UI ----------
    const ui = CT.win.create({
        id: 'ct-stocks',
        title: 'Stocks',
        size: [373, 126],     // <<< taille par défaut demandée
        pos: [20, 20],
        scroll: 'hidden',
        minimize: false,      // pas de bouton "–"
        className: 'ct-app-stocks'
    });
    ui.onClose(() => { try { window.__stocksBar = undefined; } catch {} });

    // CSS précis demandé
    const EXTRA_CSS = `
  .ct-app-stocks .ct-row {
    gap: 6px;
    margin: 4px 0;
    align-items: center;
  }
  .ct-app-stocks .ct-label {
    min-width: 46px;
    opacity: .95;
  }
  .ct-app-stocks .ct-pill {
    padding: 4px 5px;
    border-radius: 10px;
  }
  .ct-app-stocks .ct-pill img { width:14px; height:14px; }
  .ct-app-stocks .pill-w {
    min-width: 84px;
    display: inline-flex;
    justify-content: flex-start;
  }
  `;
    const styleTune = document.createElement('style');
    styleTune.textContent = EXTRA_CSS;
    document.head.appendChild(styleTune);

    // Boutons d'en-tête : uniquement Refresh + Close
    ui.addButton('refresh', 'Rafraîchir', render);

    // ---------- Données ----------
    const sumStocksFrom = (obj) => {
        if (!obj || typeof obj !== 'object') return { M: 0, T: 0, P: 0 };
        let M = 0, T = 0, P = 0;
        try {
            Object.entries(obj).forEach(([k, v]) => {
                if (typeof k !== 'string' || !k.includes(':')) return;
                if (!v || typeof v !== 'object') return;
                M += CT.num.to(v.ResM);
                T += CT.num.to(v.ResT);
                P += CT.num.to(v.ResP);
            });
        } catch {}
        return { M, T, P };
    };
    const globals = () => {
        const c = sumStocksFrom(window.Colonies || {});
        const s = sumStocksFrom(window.Secteurs || {});
        return { M: c.M + s.M, T: c.T + s.T, P: c.P + s.P };
    };
    const current = () => {
        const p = (window.planete || window.Planete || {}) || {};
        const r = p.Ressources ?? p['Ressources'];
        if (r && typeof r === 'object') {
            return {
                M: CT.num.to(r.M ?? r.ResM ?? r.Metal),
                T: CT.num.to(r.T ?? r.ResT ?? r.Tritium),
                P: CT.num.to(r.P ?? r.ResP ?? r.PhotoP ?? r.Photopiles ?? r.PP)
            };
        }
        return { M: CT.num.to(p.ResM), T: CT.num.to(p.ResT), P: CT.num.to(p.ResP) };
    };

    // ---------- Layout ----------
    const row = (label, cls) => `
    <div class="ct-row ${cls}">
      <span class="ct-label">${label}</span>
      <span class="ct-pill pill-w gm"><img src="${CT.ico.M}"><span class="v-m">—</span></span>
      <span class="ct-pill pill-w gt"><img src="${CT.ico.T}"><span class="v-t">—</span></span>
      <span class="ct-pill pill-w gp"><img src="${CT.ico.P}"><span class="v-p">—</span></span>
    </div>`;
    ui.body.innerHTML = row('Globaux', 'g') + row('Courant', 'c');

    // ---------- Render ----------
    function render() {
        const g = globals();
        ui.body.querySelector('.g .v-m').textContent = CT.fmt.abbr(g.M);
        ui.body.querySelector('.g .v-t').textContent = CT.fmt.abbr(g.T);
        ui.body.querySelector('.g .v-p').textContent = CT.fmt.abbr(g.P);

        const c = current();
        ui.body.querySelector('.c .v-m').textContent = CT.fmt.abbr(c.M);
        ui.body.querySelector('.c .v-t').textContent = CT.fmt.abbr(c.T);
        ui.body.querySelector('.c .v-p').textContent = CT.fmt.abbr(c.P);
    }

    // Observe et nettoyage
    const stop1 = CT.observe(() => window.Colonies, render, { interval: 3000 });
    const stop2 = CT.observe(() => window.Secteurs, render, { interval: 3000 });
    const stop3 = CT.observe(() => window.planete || window.Planete, render, { interval: 3000 });
    ui.onClose(() => { stop1(); stop2(); stop3(); styleTune.remove(); });

    // premier paint
    render();

    // API publique
    window.__stocksBar = {
        open() {
            ui.setSize(373, 126); // assure la taille exacte à la réouverture
            ui.bringToFront?.();
            render();
        }
    };
})();
