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

import { del, set } from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import { copyToClipboard } from "@utils/clipboard";
import { OptionType } from "@utils/types";
import { chooseFile } from "@utils/web";
import { Button, showToast, Text } from "@webpack/common";

export const STORE_KEY = "Wallpaper_file";
const MAX_LOCAL_SIZE = 100 * 1024 * 1024;

// L'image ou la vidéo a changé / l'apparence a changé
export const mediaListeners = new Set<() => void>();
export const styleListeners = new Set<() => void>();

const onMedia = () => mediaListeners.forEach(fn => fn());
const onStyle = () => styleListeners.forEach(fn => fn());

export const settings = definePluginSettings({
    imageUrl: {
        type: OptionType.STRING,
        description: "Lien direct vers une image, un GIF ou une vidéo (utilisé seulement si tu n'as pas choisi de fichier ci-dessous)",
        default: "",
        onChange: onMedia
    },
    opacity: {
        type: OptionType.SLIDER,
        description: "Opacité des panneaux (0 = tout transparent, 100 = opaque)",
        markers: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        default: 55,
        stickToMarkers: true,
        onChange: onStyle
    },
    dim: {
        type: OptionType.SLIDER,
        description: "Assombrissement du fond d'écran (0 = image d'origine)",
        markers: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90],
        default: 20,
        stickToMarkers: true,
        onChange: onStyle
    },
    blur: {
        type: OptionType.SLIDER,
        description: "Flou du fond d'écran en pixels",
        markers: [0, 2, 4, 6, 8, 10, 15, 20, 30],
        default: 0,
        stickToMarkers: true,
        onChange: onStyle
    },
    tint: {
        type: OptionType.STRING,
        description: "Couleur des panneaux (hexadécimal, ex : #0b0d12 pour sombre, #f2f3f5 pour clair)",
        default: "#0b0d12",
        onChange: onStyle
    },
    includeCards: {
        type: OptionType.BOOLEAN,
        description: "Rendre aussi transparents les cartes et les fenêtres (peut gêner la lecture)",
        default: false,
        onChange: onStyle
    },
    extraVariables: {
        type: OptionType.STRING,
        description: "Variables de couleur supplémentaires à rendre transparentes (séparées par des virgules, ex : --background-primary)",
        default: "",
        onChange: onStyle
    },
    picker: {
        type: OptionType.COMPONENT,
        component: () => <Picker />
    }
});

// Liste les variables de couleur définies par les feuilles de style de Discord
export function collectVariables(): string[] {
    const found = new Set<string>();
    const wanted = /background|bg-|surface|chat|channel|panel|sidebar|titlebar|app-frame/i;

    for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
            rules = sheet.cssRules;
        } catch {
            continue;
        }

        for (const rule of Array.from(rules)) {
            const { style } = rule as CSSStyleRule;
            if (!style) continue;

            for (let i = 0; i < style.length; i++) {
                const name = style[i];
                if (name.startsWith("--") && wanted.test(name)) found.add(name);
            }
        }
    }

    return [...found].sort();
}

async function pickFile() {
    const file = await chooseFile("image/*,video/mp4,video/webm");
    if (!file) return;

    if (file.size > MAX_LOCAL_SIZE) {
        showToast("Fichier trop gros (100 Mo maximum)", "failure");
        return;
    }

    await set(STORE_KEY, { type: file.type, blob: file });
    onMedia();
    showToast("Fond d'écran enregistré", "success");
}

async function removeFile() {
    await del(STORE_KEY);
    onMedia();
    showToast("Fond d'écran retiré", "success");
}

async function copyVariables() {
    const names = collectVariables();
    await copyToClipboard(names.join("\n"));
    showToast(`${names.length} variables copiées`, "success");
}

function Picker() {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <Button onClick={() => pickFile()}>Choisir une image, un GIF ou une vidéo</Button>
                <Button color={Button.Colors.RED} onClick={() => removeFile()}>Retirer le fichier</Button>
            </div>
            <Text variant="text-xs/normal">
                Le fichier reste sur ton ordinateur. S'il reste des zones opaques, clique sur le bouton ci-dessous, colle la liste dans « Variables supplémentaires » en gardant les noms que tu veux rendre transparents.
            </Text>
            <div>
                <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={() => copyVariables()}>Copier la liste des variables de couleur</Button>
            </div>
        </div>
    );
}
