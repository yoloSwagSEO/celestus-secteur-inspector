const INTERFACE_HINT = "/CelestusV2/Interface/Interface.php";

async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

async function findInterfaceFrameId(tabId) {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    const match = frames.find(f => (f.url || "").includes(INTERFACE_HINT));
    return match ? match.frameId : 0; // fallback: top
}

async function injectIntoInterface() {
    const status = document.getElementById("status");
    try {
        const tab = await getActiveTab();
        if (!tab?.id) throw new Error("Aucun onglet actif");
        const frameId = await findInterfaceFrameId(tab.id);

        await chrome.scripting.executeScript({
            target: { tabId: tab.id, frameIds: [frameId] },
            files: ["secteurs_inspector.js"],
            world: "MAIN" // <<< clé : exécuter dans le monde principal
        });

        status.textContent = "Script injecté dans la frame Interface (MAIN world).";
        status.className = "small ok";
    } catch (e) {
        status.textContent = "Erreur: " + (e?.message || e);
        status.className = "small err";
        console.error(e);
    }
}

document.getElementById("inject").addEventListener("click", injectIntoInterface);
