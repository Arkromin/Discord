/*
 * Discord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CspPolicies, ImageAndMediaSrc } from "@main/csp";
import { IpcMainInvokeEvent } from "electron";

// Sites you can use to host your avatar, banner or video. The renderer is only allowed to load media from these hosts.
const HOSTS = [
    "files.catbox.moe",
    "litter.catbox.moe",
    "cdn.discordapp.com",
    "media.discordapp.net",
    "raw.githubusercontent.com",
    "*.githubusercontent.com",
    "github.com",
    "i.imgur.com",
    "i.ibb.co",
    "*.tenor.com",
    "*.giphy.com"
];

for (const host of HOSTS) {
    CspPolicies[host] = [...new Set([...(CspPolicies[host] ?? []), ...ImageAndMediaSrc])];
}

const MAX_SIZE = 40 * 1024 * 1024;

// Downloads the whole file from the main process. Some hosts refuse the partial requests a video element makes.
export async function fetchMedia(_: IpcMainInvokeEvent, url: string) {
    try {
        if (!/^https?:\/\//i.test(url)) return { status: -1, type: "", data: "" };

        const res = await fetch(url);
        if (!res.ok) return { status: res.status, type: "", data: "" };

        const bytes = Buffer.from(await res.arrayBuffer());
        if (bytes.length > MAX_SIZE) return { status: -2, type: "", data: "" };

        return {
            status: 200,
            type: res.headers.get("content-type") ?? "video/mp4",
            data: bytes.toString("base64")
        };
    } catch {
        return { status: -1, type: "", data: "" };
    }
}
