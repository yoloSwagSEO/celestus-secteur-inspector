// background.js — Injecte le bouton "Injector 3000" DANS la frame Interface
// lorsque la frame Programme est sur Technologies.php ou Batiments.php

const HOST = "horizon.celestus.fr";
const INTERFACE_HINT = "/CelestusV2/Interface/Interface.php";

const PROGRAMME_TARGETS = [
    { path: "/CelestusV2/Programme/Technologies.php", key: "Technologies" },
    { path: "/CelestusV2/Programme/Batiments.php",    key: "Batiments"   },
];

// Filtre large : on re-filtre au runtime
const FILTER = { url: [{ hostEquals: HOST }] };

function matchProgrammeTarget(url) {
    try {
        const u = new URL(url);
        if (u.hostname !== HOST) return null;
        const t = PROGRAMME_TARGETS.find(t => u.pathname.endsWith(t.path));
        return t || null;
    } catch { return null; }
}

async function findInterfaceFrameId(tabId) {
    try {
        const frames = await chrome.webNavigation.getAllFrames({ tabId });
        const match = frames.find(f => (f.url || "").includes(INTERFACE_HINT));
        return match ? match.frameId : null;
    } catch (e) {
        console.warn("[CT] getAllFrames error:", e);
        return null;
    }
}

async function onAnyNav(details) {
    const { tabId, frameId, url } = details;
    if (tabId == null || frameId == null || !url) return;

    const target = matchProgrammeTarget(url);
    if (!target) return; // pas une page Programme ciblée

    const ifaceId = await findInterfaceFrameId(tabId);
    if (ifaceId == null) {
        console.warn("[CT] Frame Interface introuvable dans l’onglet", tabId);
        return;
    }

    try {
        await chrome.scripting.executeScript({
            target: { tabId, frameIds: [ifaceId] }, // <-- on agit DANS Interface
            world: "MAIN",
            files: ["injector_btn_tech.js"],        // même script pour Tech & Bâtiments
        });
        console.log("[CT] Bouton Injector 3000 injecté dans Interface via Programme:", target.key, { tabId, ifaceId });
    } catch (e) {
        console.warn("[CT] Injection dans Interface échouée:", e);
    }
}

// Couvre toutes les navigations utiles
chrome.webNavigation.onCommitted.addListener(onAnyNav, FILTER);
chrome.webNavigation.onCompleted.addListener(onAnyNav, FILTER);
chrome.webNavigation.onHistoryStateUpdated.addListener(onAnyNav, FILTER);
chrome.webNavigation.onReferenceFragmentUpdated.addListener(onAnyNav, FILTER);

// Ping debug optionnel
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg === "ct-ping") { console.log("[CT] SW alive"); sendResponse({ ok: true }); }
});
