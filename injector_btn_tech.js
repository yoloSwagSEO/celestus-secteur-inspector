// injector_btn_tech.js — Ajoute "Injector 3000" en 1er enfant de #BatListeC (dans Interface)
// Au clic : lit #ObjCoutM/T/P .BulleNb (sans '.') et remplit le module Injector 3000.

(() => {
    const LINK_ID = "ct-injector-3000-link";
    if (document.getElementById(LINK_ID)) return; // anti double-injection

    function makeLink() {
        const a = document.createElement("a");
        a.id = LINK_ID;
        a.href = "#";
        a.textContent = "Injector 3000";
        a.setAttribute(
            "style",
            "position: absolute;" +
            " top: -84px;" +
            " left: 48%;" +
            " display: block;" +
            " border: var(--borderG) !important;" +
            " color: var(--colorG) !important;" +
            " text-shadow: var(--shadowGT);" +
            " background: url(https://horizon.celestus.fr/CelestusV2/Interface/Skin/Cadres/InputG.png) repeat center;" +
            " padding: 4px 15px;"
        );

        // Récupère un coût numérique (sans séparateurs) depuis #ObjCoutX .BulleNb
        const readCost = (rootId) => {
            try {
                const el = document.querySelector(`#${rootId} .BulleNb`);
                if (!el) return 0;
                const raw = (el.textContent || "").replace(/\./g, "").replace(/\s/g, "");
                const n = parseInt(raw, 10);
                return Number.isFinite(n) ? n : 0;
            } catch {
                return 0;
            }
        };

        a.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Valeurs depuis Interface (0 si .BulleNb absent)
            const M = readCost("ObjCoutM");
            const T = readCost("ObjCoutT");
            const P = readCost("ObjCoutP");
            const H = 0;

            // Ouvre la fenêtre si dispo
            try { window.__injector3000?.open?.(); } catch {}

            // Utilise l'API si dispo, sinon évènement
            if (window.__injector3000 && typeof window.__injector3000.fill === "function") {
                try { window.__injector3000.fill({ M, T, P, H }); } catch {}
            } else {
                try { window.dispatchEvent(new CustomEvent("CT:InjectorFill", { detail: { M, T, P, H } })); } catch {}
            }
        });

        return a;
    }

    function place() {
        const container = document.getElementById("BatListeC");
        if (!container) return false;
        if (document.getElementById(LINK_ID)) return true;

        const link = makeLink();
        if (container.firstChild) container.insertBefore(link, container.firstChild);
        else container.appendChild(link);
        return true;
    }

    // Essaie tout de suite, sinon observe jusqu’à apparition de #BatListeC
    if (!place()) {
        const obs = new MutationObserver(() => {
            if (place()) obs.disconnect();
        });
        obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
        setTimeout(() => obs.disconnect(), 15000); // sécurité
    }
})();
