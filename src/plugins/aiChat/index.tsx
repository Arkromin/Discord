/*
 * Discord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import definePlugin from "@utils/types";
import { MessageStore, showToast } from "@webpack/common";

import { askAI, openChat, settings } from "./ui";

// Discord refuses messages longer than 2000 characters, so long answers are cut in pieces
function splitMessage(text: string, max = 1900): string[] {
    const parts: string[] = [];
    let rest = text;

    while (rest.length > max) {
        let cut = rest.lastIndexOf("\n", max);
        if (cut < max / 2) cut = rest.lastIndexOf(" ", max);
        if (cut < max / 2) cut = max;

        parts.push(rest.slice(0, cut));
        rest = rest.slice(cut).trimStart();
    }

    if (rest) parts.push(rest);
    return parts;
}

const SUMMARY_LIMIT = 20000;

// Builds a plain text version of the last messages already loaded in the channel
function buildTranscript(channelId: string, count: number): string {
    const all: any[] = MessageStore.getMessages(channelId)?._array ?? [];

    const lines = all
        .filter(m => m.type === 0 || m.type === 19)
        .slice(-count)
        .map(m => {
            const time = new Date(m.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
            const name = m.author?.globalName ?? m.author?.username ?? "?";
            const content = String(m.content ?? "").replace(/\s+/g, " ").slice(0, 500);
            const extra = m.attachments?.length ? " [pièce jointe]" : "";

            return `[${time}] ${name}: ${content}${extra}`.trim();
        })
        .filter(line => !line.endsWith(": "));

    let transcript = lines.join("\n");
    if (transcript.length > SUMMARY_LIMIT) transcript = transcript.slice(-SUMMARY_LIMIT);

    return transcript;
}

export default definePlugin({
    name: "AiChat",
    description: "Adds an AI chat button to the titlebar and a /ia command that answers in the channel, using Google Gemini (you need a free API key)",
    tags: ["Commands", "Utility"],
    authors: [Devs.Arkromin],
    settings,

    toolboxActions: {
        "Discuter avec l'IA": openChat
    },

    commands: [
        {
            name: "ia",
            description: "Pose une question à l'IA",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "question",
                    description: "Ta question",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                },
                {
                    name: "prive",
                    description: "Afficher la réponse seulement pour toi",
                    type: ApplicationCommandOptionType.BOOLEAN,
                    required: false
                }
            ],

            execute: async (args, ctx) => {
                const question = findOption<string>(args, "question", "").trim();
                const prive = findOption<boolean>(args, "prive", false);
                if (!question) return;

                showToast("L'IA réfléchit...");

                let answer: string;
                try {
                    answer = await askAI([], question);
                } catch (e) {
                    sendBotMessage(ctx.channel.id, {
                        content: `⚠️ ${e instanceof Error ? e.message : String(e)}`
                    });
                    return;
                }

                const quoted = question.split("\n").map(l => `> ${l}`).join("\n");

                for (const part of splitMessage(`${quoted}\n${answer}`)) {
                    if (prive) sendBotMessage(ctx.channel.id, { content: part });
                    else await sendMessage(ctx.channel.id, { content: part });
                }
            }
        },
        {
            name: "resume",
            description: "Résume les derniers messages du salon (ils sont envoyés à Google Gemini)",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "messages",
                    description: "Combien de messages résumer (10 à 100, 50 par défaut)",
                    type: ApplicationCommandOptionType.INTEGER,
                    required: false
                },
                {
                    name: "publique",
                    description: "Envoyer le résumé dans le salon (sinon il est visible seulement par toi)",
                    type: ApplicationCommandOptionType.BOOLEAN,
                    required: false
                }
            ],

            execute: async (args, ctx) => {
                const count = Math.min(100, Math.max(10, findOption<number>(args, "messages", 50)));
                const publique = findOption<boolean>(args, "publique", false);

                const transcript = buildTranscript(ctx.channel.id, count);
                if (!transcript) {
                    sendBotMessage(ctx.channel.id, { content: "⚠️ Aucun message à résumer dans ce salon." });
                    return;
                }

                showToast("Résumé en cours...");

                let answer: string;
                try {
                    answer = await askAI([], [
                        "Résume cette conversation Discord en français.",
                        "Donne les points importants, les décisions prises et les questions restées sans réponse.",
                        "Reste court et clair. Voici les messages :",
                        "",
                        transcript
                    ].join("\n"));
                } catch (e) {
                    sendBotMessage(ctx.channel.id, {
                        content: `⚠️ ${e instanceof Error ? e.message : String(e)}`
                    });
                    return;
                }

                for (const part of splitMessage(`📝 **Résumé des derniers messages**\n${answer}`)) {
                    if (publique) await sendMessage(ctx.channel.id, { content: part });
                    else sendBotMessage(ctx.channel.id, { content: part });
                }
            }
        }
    ]
});
