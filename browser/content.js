if (typeof browser === "undefined") {
    var browser = chrome;
}

document.addEventListener(
    "DOMContentLoaded",
    () => {
        window.postMessage({
            type: "discord:meta",
            meta: {
                EXTENSION_VERSION: browser.runtime.getManifest().version,
                EXTENSION_BASE_URL: browser.runtime.getURL(""),
                RENDERER_CSS_URL: browser.runtime.getURL("dist/Discord.css"),
            }
        });

        chrome.runtime.onMessage.addListener(request => {
            window.postMessage({ type: "discord:keybinds", meta: request.command });  
        })

        window.addEventListener('message', function(event) {
            if (event.source !== window) return;

            if (event.data.type === 'OPEN_SHORTCUTS') {
            chrome.runtime.sendMessage({ action: "openShortcuts" });
            }
        }, false);
    },
    { once: true }
);
