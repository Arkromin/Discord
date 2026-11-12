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

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    showMiniPlayer: {
        type: OptionType.BOOLEAN,
        description: "Afficher le mini-lecteur (bouton de musique) dans la barre du haut",
        default: true
    },
    country: {
        type: OptionType.STRING,
        description: "Pays des radios proposées en premier (code à 2 lettres : FR, BE, CH, CA, US...)",
        default: "FR"
    },
    volume: {
        type: OptionType.NUMBER,
        description: "Volume (0 à 100)",
        default: 50,
        hidden: true
    }
});
