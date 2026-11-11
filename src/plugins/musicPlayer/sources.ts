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

import { PluginNative } from "@utils/types";

import { settings } from "./settings";

const Native = VencordNative.pluginHelpers.MusicPlayer as PluginNative<typeof import("./native")>;

export interface Track {
    kind: "music" | "radio";
    title: string;
    subtitle: string;
    url: string;
}

const APP_NAME = "DiscordMod";
const RADIO_SERVERS = ["de1", "de2", "nl1", "at1"];

export const PRESET_RADIOS = ["NRJ", "Skyrock", "Fun Radio", "RTL", "France Inter", "FIP", "Nostalgie", "RMC", "Europe 1", "Radio Nova", "Cherie FM", "RFM"];

async function getJson(url: string): Promise<any> {
    const { status, data } = await Native.getJson(url);

    if (status === -1) throw new Error("Impossible de joindre le service (vérifie ta connexion).");
    if (status < 200 || status >= 300) throw new Error(`Le service a répondu avec une erreur (${status}).`);

    try {
        return JSON.parse(data);
    } catch {
        throw new Error("Réponse inattendue du service.");
    }
}

export async function searchMusic(query: string): Promise<Track[]> {
    const json = await getJson(`https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}&limit=20&app_name=${APP_NAME}`);
    const list: any[] = json?.data ?? [];

    return list
        .filter(t => t?.id && t.is_streamable !== false && !t.is_delete)
        .map(t => ({
            kind: "music" as const,
            title: String(t.title ?? "Sans titre"),
            subtitle: String(t.user?.name ?? "Artiste inconnu"),
            url: `https://api.audius.co/v1/tracks/${encodeURIComponent(t.id)}/stream?app_name=${APP_NAME}`
        }));
}

async function radioRequest(path: string): Promise<any[]> {
    let lastError: unknown;

    for (const server of RADIO_SERVERS) {
        try {
            const json = await getJson(`https://${server}.api.radio-browser.info${path}`);
            if (Array.isArray(json)) return json;
        } catch (e) {
            lastError = e;
        }
    }

    throw lastError instanceof Error ? lastError : new Error("Aucun serveur de radios n'a répondu.");
}

export async function searchRadios(query: string): Promise<Track[]> {
    const country = settings.store.country.trim().toUpperCase();
    const base = `/json/stations/search?name=${encodeURIComponent(query)}&hidebroken=true&order=clickcount&reverse=true&limit=20`;

    let list = await radioRequest(country ? `${base}&countrycode=${encodeURIComponent(country)}` : base);
    if (!list.length && country) list = await radioRequest(base);

    const seen = new Set<string>();
    const tracks: Track[] = [];

    for (const s of list) {
        const url = String(s?.url_resolved ?? "").trim();
        if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;

        seen.add(url);
        tracks.push({
            kind: "radio",
            title: String(s.name ?? "Radio").trim() || "Radio",
            subtitle: [s.country, String(s.tags ?? "").split(",")[0], s.bitrate ? `${s.bitrate} kb/s` : ""].filter(Boolean).join(" · "),
            url
        });
    }

    return tracks;
}
