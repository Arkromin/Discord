/*
 * Discord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

// Seule l'adresse du serveur de contrôle d'accès peut être contactée, et seulement sur /api/check
export async function check(_: IpcMainInvokeEvent, server: string, body: { id: string; name: string; beat: boolean; }) {
    if (!/^https:\/\/[a-z0-9.-]+$/i.test(server)) return { status: -3, data: "" };

    try {
        const res = await fetch(server + "/api/check", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: String(body.id), name: String(body.name), beat: body.beat === true }),
            signal: AbortSignal.timeout(8000)
        });
        return { status: res.status, data: await res.text() };
    } catch (e) {
        return { status: -1, data: String(e) };
    }
}
