/*
 * Discord, a modification for Discord's desktop app
 * Copyright (c) 2026 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { get } from "@api/DataStore";
import { Devs } from "@utils/constants";
import definePlugin, { PluginNative } from "@utils/types";

import { mediaListeners, settings, STORE_KEY, styleListeners } from "./settings";

const Native = VencordNative.pluginHelpers.Wallpaper as PluginNative<typeof import("./native")>;

interface Source {
    blob: Blob;
    video: boolean;
}

// [variable, multiplicateur d'opacité]
const PANEL_VARS: Array<[string, number]> = [
    ["--background-base-lowest", 0.85],
    ["--background-base-lower", 0.8],
    ["--background-base-low", 0.7],
    ["--chat-background-default", 0.65],
    ["--channeltextarea-background", 0.8],
    ["--bg-overlay-app-frame", 0.7],
    ["--bg-overlay-chat", 0.7]
];

const CARD_VARS: Array<[string, number]> = [
    ["--background-surface-high", 0.9],
    ["--background-surface-higher", 0.9],
    ["--background-surface-highest", 0.9]
];

let layer: HTMLDivElement | null = null;
let styleEl: HTMLStyleElement | null = null;
let objectUrl: string | null = null;
let remoteCache: { url: string; source: Source; } | null = null;
let mediaToken = 0;

function parseHex(value: string): [number, number, number] {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
    if (!m) return [11, 13, 18];

    let hex = m[1];
    if (hex.length === 3) hex = [...hex].map(c => c + c).join("");

    return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function buildCss() {
    const { opacity, dim, blur, tint, includeCards, extraVariables } = settings.store;
    const [r, g, b] = parseHex(tint);
    const o = Math.min(1, Math.max(0, opacity / 100));

    const vars = [...PANEL_VARS, ...(includeCards ? CARD_VARS : [])];
    for (const name of extraVariables.split(",").map(s => s.trim()).filter(s => /^--[\w-]+$/.test(s))) {
        vars.push([name, 1]);
    }

    const decl = vars
        .map(([name, factor]) => `${name}: rgba(${r}, ${g}, ${b}, ${o >= 1 ? 1 : +(o * factor).toFixed(3)}) !important;`)
        .join("\n    ");

    return `
html, body, #app-mount {
    background: transparent !important;
}

html, body, [class*="theme-"] {
    ${decl}
}

#vc-wallpaper {
    position: fixed;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
    background: #000;
}

#vc-wallpaper .vc-wp-media {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scale(${blur > 0 ? 1.06 : 1});
    filter: blur(${blur}px);
}

#vc-wallpaper .vc-wp-dim {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, ${Math.min(0.9, Math.max(0, dim / 100))});
}
`;
}

function applyStyle() {
    if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "vc-wallpaper-style";
        document.head.append(styleEl);
    }

    styleEl.textContent = buildCss();
}

async function loadSource(): Promise<Source | null> {
    const stored = await get<{ type: string; blob: Blob; }>(STORE_KEY);
    if (stored?.blob) return { blob: stored.blob, video: stored.type.startsWith("video/") };

    const url = settings.store.imageUrl.trim();
    if (!url) return null;

    if (remoteCache?.url === url) return remoteCache.source;

    const { status, type, data } = await Native.fetchFile(url);
    if (status !== 200) {
        console.warn("[Wallpaper] impossible de charger le fond d'écran, code", status);
        return null;
    }

    const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
    const source = { blob: new Blob([bytes], { type }), video: type.startsWith("video/") };
    remoteCache = { url, source };

    return source;
}

async function applyMedia() {
    const token = ++mediaToken;
    const source = await loadSource().catch(() => null);
    if (token !== mediaToken) return;

    if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
    }
    layer?.remove();
    layer = null;

    if (!source) return;

    objectUrl = URL.createObjectURL(source.blob);

    layer = document.createElement("div");
    layer.id = "vc-wallpaper";

    let media: HTMLImageElement | HTMLVideoElement;
    if (source.video) {
        const video = document.createElement("video");
        video.src = objectUrl;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.play().catch(() => { });
        media = video;
    } else {
        const img = document.createElement("img");
        img.src = objectUrl;
        img.alt = "";
        media = img;
    }
    media.className = "vc-wp-media";

    const dimLayer = document.createElement("div");
    dimLayer.className = "vc-wp-dim";

    layer.append(media, dimLayer);
    document.body.prepend(layer);
}

export default definePlugin({
    name: "Wallpaper",
    description: "Met une image, un GIF ou une vidéo en fond d'écran de Discord, avec des panneaux transparents. Uniquement chez toi.",
    authors: [Devs.Arkromin],
    settings,

    start() {
        applyStyle();
        applyMedia();

        mediaListeners.add(applyMedia);
        styleListeners.add(applyStyle);
    },

    stop() {
        mediaListeners.delete(applyMedia);
        styleListeners.delete(applyStyle);

        mediaToken++;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = null;
        remoteCache = null;

        layer?.remove();
        styleEl?.remove();
        layer = null;
        styleEl = null;
    }
});
