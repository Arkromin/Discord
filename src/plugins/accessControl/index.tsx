/*
 * Discord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { get, set } from "@api/DataStore";
import { showNotification } from "@api/Notifications";
import { Devs } from "@utils/constants";
import definePlugin, { PluginNative } from "@utils/types";
import { FluxDispatcher, UserStore } from "@webpack/common";

import { ACCESS_SERVER } from "./config";

const Native = VencordNative.pluginHelpers.AccessControl as PluginNative<typeof import("./native")>;

const NOTICE_KEY = "AccessControl_notice_v1";
const LOCK_ID = "vc-access-lock";
const CHECK_EVERY = 90 * 1000;

interface Verdict {
    allowed: boolean;
    reason: string;
    until: number | null;
    needBeat?: boolean;
    limitMin?: number | null;
    remainingMin?: number | null;
    window?: string | null;
    expiresAt?: number | null;
}

let timer: ReturnType<typeof setInterval> | undefined;
let observer: MutationObserver | undefined;
let last: Verdict | null = null;
let busy = false;

const enabled = () => !ACCESS_SERVER.includes("REMPLACE");

function fmtTime(ms: number) {
    return new Date(ms).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function lockLines(v: Verdict) {
    const lines = [v.reason || "Accès suspendu par l'administrateur."];
    if (v.until) lines.push("Retour possible : " + fmtTime(v.until));
    return lines;
}

function showLock(v: Verdict) {
    let box = document.getElementById(LOCK_ID);

    if (!box) {
        box = document.createElement("div");
        box.id = LOCK_ID;
        Object.assign(box.style, {
            position: "fixed", inset: "0", zIndex: "2147483647", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: "12px", padding: "24px", textAlign: "center",
            background: "#111214", color: "#f2f3f5", fontFamily: "gg sans, system-ui, sans-serif"
        });
        document.body.append(box);
    }

    box.replaceChildren();
    const title = document.createElement("div");
    title.textContent = "Accès suspendu";
    title.style.cssText = "font-size:28px;font-weight:700";
    box.append(title);

    for (const line of lockLines(v)) {
        const p = document.createElement("div");
        p.textContent = line;
        p.style.cssText = "font-size:16px;opacity:.85;max-width:480px";
        box.append(p);
    }

    const retry = document.createElement("button");
    retry.textContent = "Revérifier";
    retry.style.cssText = "margin-top:8px;padding:10px 18px;border:0;border-radius:6px;background:#5865f2;color:#fff;font-size:15px;cursor:pointer";
    retry.onclick = () => { void run(false); };
    box.append(retry);

    document.getElementById("app-mount")?.setAttribute("inert", "");

    if (!observer) {
        observer = new MutationObserver(() => {
            if (last && !last.allowed && !document.getElementById(LOCK_ID)) showLock(last);
        });
        observer.observe(document.body, { childList: true });
    }
}

function hideLock() {
    observer?.disconnect();
    observer = undefined;
    document.getElementById(LOCK_ID)?.remove();
    document.getElementById("app-mount")?.removeAttribute("inert");
}

async function ask(beat: boolean): Promise<Verdict | null> {
    const me = UserStore.getCurrentUser();
    if (!me || !enabled()) return null;

    const { status, data } = await Native.check(ACCESS_SERVER, { id: me.id, name: me.globalName || me.username, beat });
    if (status !== 200) return null;

    try {
        return JSON.parse(data) as Verdict;
    } catch {
        return null;
    }
}

async function run(beat: boolean) {
    if (busy) return;
    busy = true;

    try {
        const v = await ask(beat);

        // Serveur injoignable : on garde le dernier état, sauf un blocage encore en cours
        if (!v) {
            if (last && !last.allowed && last.until && last.until > Date.now()) showLock(last);
            return;
        }

        last = v;
        if (v.allowed) hideLock();
        else showLock(v);
    } finally {
        busy = false;
    }
}

function tick() {
    // Le temps n'est compté que quand la fenêtre est visible
    if (document.visibilityState !== "visible") return;
    void run(Boolean(last?.needBeat));
}

async function begin() {
    if (!enabled() || timer) return;

    await run(false);
    timer = setInterval(tick, CHECK_EVERY);

    if (!(await get<boolean>(NOTICE_KEY))) {
        await set(NOTICE_KEY, true);
        showNotification({
            title: "Contrôle d'accès",
            body: "Ce client envoie ton pseudo et ton identifiant Discord à l'administrateur, uniquement pour gérer l'accès. Rien d'autre. Tape /acces pour voir ton statut.",
            noPersist: true
        });
    }
}

function onVisible() {
    if (document.visibilityState === "visible") void run(false);
}

function onOpen() {
    void begin();
}

export default definePlugin({
    name: "AccessControl",
    description: "Contrôle d'accès du client : l'administrateur peut suspendre l'accès ou le limiter dans le temps. Envoie uniquement ton pseudo et ton identifiant (et le temps d'utilisation si une limite par jour t'est donnée).",
    authors: [Devs.Arkromin],
    required: true,

    start() {
        FluxDispatcher.subscribe("CONNECTION_OPEN", onOpen);
        document.addEventListener("visibilitychange", onVisible);
        if (UserStore.getCurrentUser()) void begin();
    },

    stop() {
        FluxDispatcher.unsubscribe("CONNECTION_OPEN", onOpen);
        document.removeEventListener("visibilitychange", onVisible);
        if (timer) clearInterval(timer);
        timer = undefined;
        hideLock();
    },

    commands: [{
        name: "acces",
        description: "Affiche ton statut d'accès au client",
        inputType: ApplicationCommandInputType.BUILT_IN,
        execute: async (_, ctx) => {
            const say = (content: string) => sendBotMessage(ctx.channel.id, { content });
            if (!enabled()) return say("🔓 Le contrôle d'accès n'est pas configuré.");

            const v = await ask(false);
            if (!v) return say("⚠️ Serveur injoignable pour le moment.");

            const lines = [v.allowed ? "✅ Accès autorisé." : "⛔ " + lockLines(v).join(" ")];
            if (v.limitMin) lines.push(`⏱ Limite : ${v.limitMin} min par jour (reste environ ${v.remainingMin ?? 0} min).`);
            if (v.window) lines.push(`🕒 Heures autorisées : ${v.window}.`);
            if (v.expiresAt) lines.push(`📅 Accès jusqu'au ${fmtTime(v.expiresAt)}.`);
            lines.push("Données envoyées : ton pseudo et ton identifiant Discord, rien d'autre.");
            say(lines.join("\n"));
        }
    }]
});
