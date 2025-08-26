// popup.js

// --- Constantes ---
const INTERFACE_HINT = "/CelestusV2/Interface/Interface.php";

// --- Helpers DOM ---
function qs(id) { return document.getElementById(id); }
function setStatus(msg, type = "ok") {
    const el = qs("status");
    if (!el) return;
    el.textContent = msg;
    el.className = `small ${type}`;
}

// --- Chrome helpers ---
async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

async function findInterfaceFrameId(tabId) {
    try {
        const frames = await chrome.webNavigation.getAllFrames({ tabId });
        const match = frames.find(f => (f.url || "").includes(INTERFACE_HINT));
        return match ? match.frameId : 0; // fallback: top frame
    } catch (e) {
        console.warn("getAllFrames failed, fallback top frame", e);
        return 0;
    }
}

async function injectFiles(files) {
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error("Aucun onglet actif");

    const frameId = await findInterfaceFrameId(tab.id);

    // Injecter en séquence pour des logs clairs
    for (const file of files) {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id, frameIds: [frameId] },
            files: [file],
            world: "MAIN", // IMPORTANT: accès au window principal
        });
    }

    return { tabId: tab.id, frameId, files };
}

// --- Actions prêtes à l’emploi ---
async function injectSecteurs() {
    try {
        const res = await injectFiles(["secteurs_inspector.js"]);
        setStatus(`Injecté: secteurs_inspector.js (frame ${res.frameId})`, "ok");
    } catch (e) {
        console.error(e);
        setStatus(`Erreur injection Secteurs: ${e?.message || e}`, "err");
    }
}

async function injectColonies() {
    try {
        const res = await injectFiles(["colonies_manager.js"]);
        setStatus(`Injecté: colonies_manager.js (frame ${res.frameId})`, "ok");
    } catch (e) {
        console.error(e);
        setStatus(`Erreur injection Colonies: ${e?.message || e}`, "err");
    }
}

async function injectResources() {
    try {
        const res = await injectFiles(["resources_bar.js"]);
        setStatus(`Injecté: resources_bar.js (frame ${res.frameId})`, "ok");
    } catch (e) {
        console.error(e);
        setStatus(`Erreur injection Ressources: ${e?.message || e}`, "err");
    }
}

async function injectInjector() {
    try {
        const res = await injectFiles(["injector_3000.js"]);
        setStatus(`Injecté: injector_3000.js (frame ${res.frameId})`, "ok");
    } catch (e) {
        console.error(e);
        setStatus(`Erreur injection Injector 3000: ${e?.message || e}`, "err");
    }
}

async function injectAll() {
    try {
        const res = await injectFiles([
            "secteurs_inspector.js",
            "colonies_manager.js",
            "resources_bar.js",
            "injector_3000.js",
        ]);
        setStatus(`Injecté: ${res.files.join(", ")} (frame ${res.frameId})`, "ok");
    } catch (e) {
        console.error(e);
        setStatus(`Erreur injection (Tout): ${e?.message || e}`, "err");
    }
}

// --- Wiring des boutons ---
function wire() {
    const btnInjectLegacy = qs("inject");
    if (btnInjectLegacy) btnInjectLegacy.addEventListener("click", injectSecteurs);

    const btnSecteurs = qs("inject-secteurs");
    if (btnSecteurs) btnSecteurs.addEventListener("click", injectSecteurs);

    const btnColonies = qs("inject-colonies");
    if (btnColonies) btnColonies.addEventListener("click", injectColonies);

    const btnResources = qs("inject-resources");
    if (btnResources) btnResources.addEventListener("click", injectResources);

    const btnInjector = qs("inject-injector");
    if (btnInjector) btnInjector.addEventListener("click", injectInjector);

    const btnAll = qs("inject-all");
    if (btnAll) btnAll.addEventListener("click", injectAll);
}

// --- Démarrage ---
document.addEventListener("DOMContentLoaded", () => {
    try {
        wire();
        setStatus("Prêt.", "ok");
    } catch (e) {
        console.error(e);
        setStatus(`Erreur init popup: ${e?.message || e}`, "err");
    }
});
