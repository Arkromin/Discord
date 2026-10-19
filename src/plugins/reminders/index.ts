/*
 * Discord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import * as DataStore from "@api/DataStore";
import { showNotification } from "@api/Notifications";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

const DATA_KEY = "Reminders_list";
const MAX_DELAY = 7 * 24 * 60 * 60 * 1000;

interface Reminder {
    id: string;
    at: number;
    text: string;
}

let reminders: Reminder[] = [];
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const UNITS: Record<string, number> = {
    j: 86400000,
    h: 3600000,
    min: 60000,
    m: 60000,
    s: 1000
};

// Accepts things like 10m, 1h30, 1h30m, 45s, 2h, 90 (minutes)
export function parseDuration(input: string): number | null {
    const text = input.trim().toLowerCase().replace(/\s+/g, "");
    if (!/^(\d+(j|h|min|m|s)?)+$/.test(text)) return null;

    let total = 0;

    // A number without a unit counts as minutes, so "1h30" means 1 hour 30 minutes
    for (const [, amount, unit] of text.matchAll(/(\d+)(j|h|min|m|s)?/g)) {
        total += Number(amount) * UNITS[unit || "m"];
    }

    return total > 0 ? total : null;
}

function formatDelay(ms: number) {
    const totalMinutes = Math.round(ms / 60000);
    if (totalMinutes < 1) return `${Math.max(1, Math.round(ms / 1000))} s`;

    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    return [days && `${days} j`, hours && `${hours} h`, minutes && `${minutes} min`].filter(Boolean).join(" ");
}

const save = () => DataStore.set(DATA_KEY, reminders);

function fire(reminder: Reminder, late = false) {
    timers.delete(reminder.id);
    reminders = reminders.filter(r => r.id !== reminder.id);
    save();

    showNotification({
        title: late ? "⏰ Rappel (en retard)" : "⏰ Rappel",
        body: reminder.text,
        permanent: true,
        noPersist: true
    });
}

function schedule(reminder: Reminder) {
    const delay = reminder.at - Date.now();

    if (delay <= 0) {
        fire(reminder, true);
        return;
    }

    timers.set(reminder.id, setTimeout(() => fire(reminder), delay));
}

export default definePlugin({
    name: "Reminders",
    description: "Adds /rappel (for example /rappel 10m sortir le plat) and /rappels. Reminders stay on your computer and show a notification, nothing is posted in a channel.",
    tags: ["Commands", "Utility"],
    authors: [Devs.Arkromin],

    async start() {
        reminders = (await DataStore.get<Reminder[]>(DATA_KEY)) ?? [];

        for (const reminder of [...reminders]) schedule(reminder);
    },

    stop() {
        timers.forEach(clearTimeout);
        timers.clear();
    },

    commands: [
        {
            name: "rappel",
            description: "Crée un rappel (exemples de durée : 10m, 1h30, 45s)",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "duree",
                    description: "Dans combien de temps (10m, 1h30, 2h, 45s, 1j)",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                },
                {
                    name: "texte",
                    description: "Le texte du rappel",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                }
            ],

            execute: async (args, ctx) => {
                const duration = parseDuration(findOption<string>(args, "duree", ""));
                const text = findOption<string>(args, "texte", "").trim();

                if (duration === null || !text) {
                    sendBotMessage(ctx.channel.id, {
                        content: "⚠️ Durée non comprise. Exemples : `10m`, `1h30`, `45s`, `2h`, `1j`."
                    });
                    return;
                }

                if (duration > MAX_DELAY) {
                    sendBotMessage(ctx.channel.id, { content: "⚠️ Le délai maximum est de 7 jours." });
                    return;
                }

                const reminder: Reminder = {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    at: Date.now() + duration,
                    text
                };

                reminders.push(reminder);
                await save();
                schedule(reminder);

                sendBotMessage(ctx.channel.id, {
                    content: `⏰ C'est noté, je te le rappelle dans **${formatDelay(duration)}** : ${text}`
                });
            }
        },
        {
            name: "rappels",
            description: "Affiche tes rappels en attente",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "annuler",
                    description: "Annuler tous les rappels en attente",
                    type: ApplicationCommandOptionType.BOOLEAN,
                    required: false
                }
            ],

            execute: async (args, ctx) => {
                if (findOption<boolean>(args, "annuler", false)) {
                    const count = reminders.length;

                    timers.forEach(clearTimeout);
                    timers.clear();
                    reminders = [];
                    await save();

                    sendBotMessage(ctx.channel.id, { content: `🗑️ ${count} rappel(s) annulé(s).` });
                    return;
                }

                if (!reminders.length) {
                    sendBotMessage(ctx.channel.id, { content: "Aucun rappel en attente." });
                    return;
                }

                const list = [...reminders]
                    .sort((a, b) => a.at - b.at)
                    .map(r => `• dans **${formatDelay(r.at - Date.now())}** : ${r.text}`)
                    .join("\n");

                sendBotMessage(ctx.channel.id, { content: `⏰ Rappels en attente :\n${list}` });
            }
        }
    ]
});
