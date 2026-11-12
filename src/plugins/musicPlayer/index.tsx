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

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

import MiniPlayer from "./miniPlayer";
import { player } from "./player";
import { settings } from "./settings";
import { PRESET_RADIOS, searchMusic, searchRadios } from "./sources";
import { openPlayer } from "./ui";

const say = (channelId: string, content: string) => sendBotMessage(channelId, { content });

export default definePlugin({
    name: "MusicPlayer",
    description: "Écoute de la musique (Audius, sans pub) et des radios en direct avec une commande, un lecteur ou le mini-lecteur de la barre du haut. Le son n'est joué que chez toi.",
    authors: [Devs.Arkromin],
    settings,

    patches: [
        {
            // Ajoute le bouton de musique dans la barre du haut, sans dépendre de Discord Toolbox
            find: '?"BACK_FORWARD_NAVIGATION":',
            replacement: {
                match: /(?<=trailing:.{0,150}?,\{children:\[)/,
                replace: "$self.MiniPlayer(),"
            }
        }
    ],

    MiniPlayer,

    stop() {
        player.destroy();
    },

    toolboxActions: {
        "Ouvrir le lecteur de musique": openPlayer
    },

    commands: [
        {
            name: "lecteur",
            description: "Ouvre le lecteur de musique et de radio",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: () => { openPlayer(); }
        },
        {
            name: "musique",
            description: "Cherche un morceau (Audius, sans pub) et le lance",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [{
                name: "recherche",
                description: "Titre ou artiste",
                type: ApplicationCommandOptionType.STRING,
                required: true
            }],
            execute: async (args, ctx) => {
                const query = findOption<string>(args, "recherche", "").trim();
                if (!query) return;

                try {
                    const tracks = await searchMusic(query);
                    if (!tracks.length) return say(ctx.channel.id, `🎵 Aucun résultat pour « ${query} ».`);

                    await player.playList(tracks.slice(0, 10));
                    say(ctx.channel.id, `🎵 Lecture : **${tracks[0].title}** — ${tracks[0].subtitle}` + (tracks.length > 1 ? `\n${Math.min(tracks.length, 10) - 1} autres morceaux en file d'attente. Utilise /suivant pour passer.` : ""));
                } catch (e) {
                    say(ctx.channel.id, `⚠️ ${e instanceof Error ? e.message : String(e)}`);
                }
            }
        },
        {
            name: "radio",
            description: "Lance une radio en direct (ex : NRJ, FIP, France Inter)",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [{
                name: "nom",
                description: "Nom de la radio",
                type: ApplicationCommandOptionType.STRING,
                required: false
            }],
            execute: async (args, ctx) => {
                const name = findOption<string>(args, "nom", "").trim();
                if (!name) return say(ctx.channel.id, `📻 Donne un nom de radio, par exemple : ${PRESET_RADIOS.slice(0, 6).join(", ")}...\nOu ouvre le lecteur avec /lecteur.`);

                try {
                    const stations = await searchRadios(name);
                    if (!stations.length) return say(ctx.channel.id, `📻 Aucune radio trouvée pour « ${name} ».`);

                    await player.play(stations[0]);
                    say(ctx.channel.id, `📻 En direct : **${stations[0].title}**`);
                } catch (e) {
                    say(ctx.channel.id, `⚠️ ${e instanceof Error ? e.message : String(e)}`);
                }
            }
        },
        {
            name: "pause",
            description: "Met en pause ou relance la musique",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (_, ctx) => {
                if (!player.getState().current) return say(ctx.channel.id, "🎵 Rien en lecture.");
                player.togglePause();
            }
        },
        {
            name: "suivant",
            description: "Passe au morceau suivant",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (_, ctx) => {
                if (!player.getState().queue.length) return say(ctx.channel.id, "🎵 Il n'y a pas de morceau suivant.");
                player.next();
            }
        },
        {
            name: "volume",
            description: "Règle le volume de la musique (0 à 100)",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [{
                name: "niveau",
                description: "Volume de 0 à 100",
                type: ApplicationCommandOptionType.INTEGER,
                required: true
            }],
            execute: (args, ctx) => {
                player.setVolume(findOption<number>(args, "niveau", 50));
                say(ctx.channel.id, `🔊 Volume : ${player.getVolume()}%`);
            }
        },
        {
            name: "stop",
            description: "Arrête la musique ou la radio",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: () => { player.stop(); }
        }
    ]
});
