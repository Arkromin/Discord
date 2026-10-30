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

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { UserStore } from "@webpack/common";

import { settings } from "./settings";
import { CATEGORIES } from "./words";

const LEET: Record<string, string> = {
    a: "a@4àâäá", b: "b8", e: "e3éèêë€", g: "g69", i: "i1!|îïí", l: "l1|", o: "o0ôöó", s: "s$5z", t: "t7+", u: "uùûüv", c: "c(k", k: "kc", z: "zs", y: "yi"
};

const esc = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escClass = (c: string) => c.replace(/[\]\\^-]/g, "\\$&");

function wordToPattern(word: string) {
    const w = word.toLowerCase().trim();
    const long = w.replace(/\s/g, "").length >= 4;
    const parts: string[] = [];
    for (const ch of w) {
        if (/\s/.test(ch)) { parts.push("[\\s._\\-*]+"); continue; }
        const set = long && LEET[ch] ? `[${[...LEET[ch]].map(escClass).join("")}]` : esc(ch);
        parts.push(long ? set + "+" : set);
    }
    return long ? parts.join("[._\\-*]?") + "[sx]?" : parts.join("");
}

let cache: { key: string; re: RegExp | null; } = { key: "", re: null };

function getRegex(): RegExp | null {
    const { categories, disabledWords, customWords, allowedWords } = settings.store;
    const key = JSON.stringify([categories, disabledWords, customWords, allowedWords]);
    if (cache.key === key) return cache.re;

    const allowed = new Set(allowedWords.split(",").map(s => s.trim().toLowerCase()).filter(Boolean));
    const disabled = new Set(disabledWords);
    const words = new Set<string>();
    for (const cat of CATEGORIES)
        if (categories.includes(cat.id))
            for (const w of cat.words)
                if (!disabled.has(w)) words.add(w.toLowerCase());
    for (const w of customWords.split(",")) {
        const t = w.trim().toLowerCase();
        if (t) words.add(t);
    }
    for (const a of allowed) words.delete(a);

    let re: RegExp | null = null;
    if (words.size) {
        // mots les plus longs d'abord pour matcher les expressions complètes
        const sorted = [...words].sort((a, b) => b.length - a.length);
        try {
            re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${sorted.map(wordToPattern).join("|")})(?![\\p{L}\\p{N}])`, "giu");
        } catch (e) {
            console.error("[WordFilter] regex invalide", e);
        }
    }
    cache = { key, re };
    return re;
}

const PROTECTED = /(<a?:\w+:\d+>|<[@#&!][^>]*>|https?:\/\/\S+|`[^`]*`)/;
const HIDDEN_TEXT = "🚫 *Message masqué (mot interdit)*";

function censor(content: string): string {
    const re = getRegex();
    if (!re || !content) return content;

    const mode = settings.store.mode ?? "stars";
    let hit = false;
    const out = content.split(PROTECTED).map((part, i) => {
        if (i % 2 === 1) return part;
        return part.replace(re, m => {
            hit = true;
            if (mode === "spoiler") return `||${m}||`;
            return m[0] + "*".repeat(Math.max(m.length - 1, 1));
        });
    }).join("");

    if (hit && mode === "hide") return HIDDEN_TEXT;
    return out;
}

function processMessage(msg: any) {
    if (!msg || typeof msg !== "object") return;
    try {
        const me = UserStore.getCurrentUser()?.id;
        if (!settings.store.filterOwn && msg.author?.id === me) return;
        if (typeof msg.content === "string" && msg.content) {
            const c = censor(msg.content);
            if (c !== msg.content) msg.content = c;
        }
        const ref = msg.referenced_message;
        if (ref && typeof ref.content === "string" && ref.author?.id !== me) {
            const c = censor(ref.content);
            if (c !== ref.content) ref.content = c;
        }
    } catch (e) {
        console.error("[WordFilter]", e);
    }
}

export default definePlugin({
    name: "WordFilter",
    description: "Masque les insultes, vulgarités et abréviations (ntm, fdp, tg…) dans les messages reçus. Base de mots intégrée, activable en un clic. Uniquement visuel, côté client.",
    authors: [Devs.Arkromin],
    settings,

    patches: [
        {
            find: '"MessageStore"',
            replacement: [
                {
                    match: /(?<=MESSAGE_CREATE:function\((\i)\)\{)/,
                    replace: "$self.onEvent($1);"
                },
                {
                    match: /(?<=MESSAGE_UPDATE:function\((\i)\)\{)/,
                    replace: "$self.onEvent($1);"
                },
                {
                    match: /(?<=LOAD_MESSAGES_SUCCESS:function\((\i)\)\{)/,
                    replace: "$self.onEvent($1);"
                },
                {
                    match: /(?<=LOAD_MESSAGES_AROUND_SUCCESS:function\((\i)\)\{)/,
                    replace: "$self.onEvent($1);"
                }
            ],
            noWarn: true
        }
    ],

    onEvent(e: any) {
        if (!e) return;
        if (e.message) processMessage(e.message);
        if (Array.isArray(e.messages)) e.messages.forEach(processMessage);
    }
});
