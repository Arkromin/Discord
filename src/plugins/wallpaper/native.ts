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

import { IpcMainInvokeEvent } from "electron";

const MAX_SIZE = 60 * 1024 * 1024;

// Télécharge le fichier depuis le processus principal : pas de blocage CORS ni CSP
export async function fetchFile(_: IpcMainInvokeEvent, url: string) {
    try {
        if (!/^https?:\/\//i.test(url)) return { status: -1, type: "", data: "" };

        const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
        if (!res.ok) return { status: res.status, type: "", data: "" };

        const bytes = Buffer.from(await res.arrayBuffer());
        if (bytes.length > MAX_SIZE) return { status: -2, type: "", data: "" };

        return {
            status: 200,
            type: res.headers.get("content-type") ?? "image/jpeg",
            data: bytes.toString("base64")
        };
    } catch {
        return { status: -1, type: "", data: "" };
    }
}
