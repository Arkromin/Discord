/*
 * Discord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CspPolicies, ImageAndMediaSrc } from "@main/csp";

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
