window.addEventListener("pagehide", () => {
    try {
        if (typeof disposeAIEngines === "function") {
            Promise.resolve(disposeAIEngines()).catch(() => {});
        }
    } catch (_) {}
});
