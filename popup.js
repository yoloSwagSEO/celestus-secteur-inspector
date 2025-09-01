// popup.js
const INTERFACE_HINT = "/CelestusV2/Interface/Interface.php";

function qs(id){ return document.getElementById(id); }
function setStatus(msg, type="ok"){
    const el = qs("status");
    if (!el) return;
    el.textContent = msg;
    el.className = `small ${type}`;
}

async function getActiveTab(){
    const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
    return tab;
}

async function findInterfaceFrameId(tabId){
    try{
        const frames = await chrome.webNavigation.getAllFrames({ tabId });
        const match = frames.find(f => (f.url || "").includes(INTERFACE_HINT));
        return match ? match.frameId : 0;
    }catch(e){
        console.warn("getAllFrames failed, fallback top frame", e);
        return 0;
    }
}

async function injectFiles(files){
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error("Aucun onglet actif");
    const frameId = await findInterfaceFrameId(tab.id);

    for (const file of files){
        await chrome.scripting.executeScript({
            target:{ tabId: tab.id, frameIds:[frameId] },
            files:[file],
            world:"MAIN",
        });
    }
    return { tabId: tab.id, frameId, files };
}

// ---- Actions d'injection
async function injectSecteurs(){
    try{
        const r = await injectFiles(["ct_core.js","secteurs_inspector.js"]);
        setStatus(`Injecté: core + secteurs (frame ${r.frameId})`,"ok");
    }catch(e){ console.error(e); setStatus(`Erreur Secteurs: ${e?.message||e}`,"err"); }
}

async function injectColonies(){
    try{
        const r = await injectFiles(["ct_core.js","colonies_manager.js"]);
        setStatus(`Injecté: core + colonies (frame ${r.frameId})`,"ok");
    }catch(e){ console.error(e); setStatus(`Erreur Colonies: ${e?.message||e}`,"err"); }
}

async function injectResources(){
    try{
        const r = await injectFiles(["ct_core.js","resources_bar.js"]);
        setStatus(`Injecté: core + stocks (frame ${r.frameId})`,"ok");
    }catch(e){ console.error(e); setStatus(`Erreur Stocks: ${e?.message||e}`,"err"); }
}

async function injectInjector(){
    try{
        const r = await injectFiles(["ct_core.js","injector_3000.js"]);
        setStatus(`Injecté: core + injector (frame ${r.frameId})`,"ok");
    }catch(e){ console.error(e); setStatus(`Erreur Injector: ${e?.message||e}`,"err"); }
}

async function injectFavories(){
    try{
        const r = await injectFiles(["ct_core.js","favories.js"]);
        setStatus(`Injecté: core + favories (frame ${r.frameId})`,"ok");
    }catch(e){ console.error(e); setStatus(`Erreur Favories: ${e?.message||e}`,"err"); }
}

async function injectRacourcis(){
    try{
        const r = await injectFiles(["ct_core.js","racourcis.js"]);
        setStatus(`Injecté: core + racourcis (frame ${r.frameId})`,"ok");
    }catch(e){ console.error(e); setStatus(`Erreur Raccourcis: ${e?.message||e}`,"err"); }
}

async function injectCarte(){
    try{
        const r = await injectFiles(["ct_core.js","carte_scanner.js"]);
        setStatus(`Injecté: core + racourcis (frame ${r.frameId})`,"ok");
    }catch(e){ console.error(e); setStatus(`Erreur Raccourcis: ${e?.message||e}`,"err"); }
}

async function injectAll(){
    try{
        const r = await injectFiles([
            "ct_core.js",
            "secteurs_inspector.js",
            "colonies_manager.js",
            "resources_bar.js",
            "injector_3000.js",
            "favories.js",
            "racourcis.js"
        ]);
        setStatus(`Injecté: ${r.files.join(", ")} (frame ${r.frameId})`,"ok");
    }catch(e){ console.error(e); setStatus(`Erreur Tout: ${e?.message||e}`,"err"); }
}

// ---- Wire
function wire(){
    const btnLegacy = qs("inject");
    if (btnLegacy) btnLegacy.addEventListener("click", injectSecteurs);

    qs("inject-secteurs")?.addEventListener("click", injectSecteurs);
    qs("inject-colonies")?.addEventListener("click", injectColonies);
    qs("inject-resources")?.addEventListener("click", injectResources);
    qs("inject-injector")?.addEventListener("click", injectInjector);
    qs("inject-favories")?.addEventListener("click", injectFavories);
    qs("inject-racourcis")?.addEventListener("click", injectRacourcis);
    qs("inject-carte")?.addEventListener("click", injectCarte);
    qs("inject-all")?.addEventListener("click", injectAll);
}

document.addEventListener("DOMContentLoaded", ()=>{
    try{ wire(); setStatus("Prêt.","ok"); }
    catch(e){ console.error(e); setStatus(`Erreur init: ${e?.message||e}`,"err"); }
});
