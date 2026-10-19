/*
 * Discord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import definePlugin from "@utils/types";
import { showToast } from "@webpack/common";

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
        }
    ]
});
