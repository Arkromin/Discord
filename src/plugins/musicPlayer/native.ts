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

import { CspPolicies } from "@main/csp";
import { randomBytes } from "crypto";
import { IpcMainInvokeEvent } from "electron";
import http from "http";
import { AddressInfo } from "net";
import { Readable } from "stream";

// Les flux audio viennent de serveurs variés (noeuds Audius, stations de radio), on autorise donc la lecture audio en https
CspPolicies["https:"] = [...new Set([...(CspPolicies["https:"] ?? []), "media-src"])];
CspPolicies["http://127.0.0.1:*"] = [...new Set([...(CspPolicies["http://127.0.0.1:*"] ?? []), "media-src"])];

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) DiscordMod-MusicPlayer";

// Seules ces adresses peuvent être interrogées par le plugin
const ALLOWED_API = [
    /^https:\/\/api\.audius\.co\//,
    /^https:\/\/[a-z0-9-]+\.api\.radio-browser\.info\//
];

// Les requêtes passent par le processus principal : pas de blocage CORS ni CSP
export async function getJson(_: IpcMainInvokeEvent, url: string) {
    if (!ALLOWED_API.some(r => r.test(url))) return { status: -3, data: "" };

    try {
        const res = await fetch(url, {
            headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
            signal: AbortSignal.timeout(8000)
        });
        return { status: res.status, data: await res.text() };
    } catch (e) {
        return { status: -1, data: String(e) };
    }
}

// Petit serveur local (127.0.0.1, adresse secrète) qui relaie les flux de radio.
// Il permet de lire aussi les stations en http (bloquées sinon dans une page https).
const token = randomBytes(16).toString("hex");
let port = 0;
let starting: Promise<number> | null = null;

function startServer(): Promise<number> {
    if (port) return Promise.resolve(port);
    if (starting) return starting;

    starting = new Promise<number>((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
            const ctrl = new AbortController();
            res.on("close", () => ctrl.abort());

            try {
                const u = new URL(req.url ?? "/", "http://127.0.0.1");
                const target = u.searchParams.get("u") ?? "";

                if (u.pathname !== `/${token}` || !/^https?:\/\//i.test(target)) {
                    res.writeHead(403);
                    res.end();
                    return;
                }

                const upstream = await fetch(target, {
                    signal: ctrl.signal,
                    redirect: "follow",
                    headers: { "User-Agent": USER_AGENT, "Icy-MetaData": "0" }
                });

                if (!upstream.ok || !upstream.body) {
                    res.writeHead(502);
                    res.end();
                    return;
                }

                res.writeHead(200, {
                    "Content-Type": upstream.headers.get("content-type") ?? "audio/mpeg",
                    "Cache-Control": "no-store"
                });

                const body = Readable.fromWeb(upstream.body as any);
                body.on("error", () => res.destroy());
                body.pipe(res);
            } catch {
                if (!res.headersSent) res.writeHead(502);
                res.end();
            }
        });

        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => {
            port = (server.address() as AddressInfo).port;
            resolve(port);
        });
    });

    return starting;
}

export async function proxyUrl(_: IpcMainInvokeEvent, url: string) {
    const p = await startServer();
    return `http://127.0.0.1:${p}/${token}?u=${encodeURIComponent(url)}`;
}
