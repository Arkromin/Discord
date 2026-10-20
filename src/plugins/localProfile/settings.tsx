/*
 * Discord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";
import { findLazy } from "@webpack";

const listeners = new Set<() => void>();

export function onSettingsChange(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

const notify = () => {
    setTimeout(() => listeners.forEach(listener => listener()), 0);
};

const FontEnum: any = findLazy(m => m?.CHERRY_BOMB !== undefined && m?.KALAM !== undefined);

function fontOptions(): Array<{ label: string; value: number; }> {
    try {
        return Object.entries(FontEnum as Record<string, unknown>)
            .filter(([key, value]) => typeof value === "number" && Number.isNaN(Number(key)))
            .map(([key, value]) => ({
                label: key.toLowerCase().split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" "),
                value: value as number
            }))
            .sort((a, b) => a.value - b.value);
    } catch {
        return Array.from({ length: 12 }, (_, i) => ({ label: `Police ${i}`, value: i }));
    }
}

const fieldStyle = {
    padding: "8px 10px",
    borderRadius: "6px",
    border: "none",
    outline: "none",
    background: "var(--background-base-lowest, #1e1f22)",
    color: "var(--text-default, #dbdee1)"
};

function StyleEditor() {
    const { nameStyleEnabled, nameFont, nameEffect, nameColors } =
        settings.use(["nameStyleEnabled", "nameFont", "nameEffect", "nameColors"]);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
            <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                    type="checkbox"
                    checked={nameStyleEnabled}
                    onChange={e => { settings.store.nameStyleEnabled = e.currentTarget.checked; }}
                />
                Activer le style de pseudonyme
            </label>

            <label>
                Police<br />
                <select
                    style={fieldStyle}
                    value={nameFont}
                    onChange={e => { settings.store.nameFont = Number(e.currentTarget.value); }}
                >
                    {fontOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            </label>

            <label>
                Numéro de l'effet (essaie 1, 2, 3... 0 = aucun)<br />
                <input
                    type="number"
                    min={0}
                    max={20}
                    style={fieldStyle}
                    value={nameEffect}
                    onChange={e => { settings.store.nameEffect = Number(e.currentTarget.value) || 0; }}
                />
            </label>

            <label>
                Couleurs, séparées par des virgules (exemple : #ff5e5e, #5e9bff)<br />
                <input
                    type="text"
                    style={{ ...fieldStyle, width: "100%" }}
                    value={nameColors}
                    onChange={e => { settings.store.nameColors = e.currentTarget.value; }}
                />
            </label>
        </div>
    );
}

export const settings = definePluginSettings({
    avatarUrl: {
        type: OptionType.STRING,
        description: "Avatar animé : lien vers un GIF ou une image (vide = ton vrai avatar)",
        default: "",
        onChange: notify
    },
    bannerUrl: {
        type: OptionType.STRING,
        description: "Bannière : lien vers une image, un GIF ou une vidéo mp4/webm (vide = ta vraie bannière)",
        default: "",
        onChange: notify
    },
    themePrimary: {
        type: OptionType.STRING,
        description: "Thème de profil, couleur principale (exemple : #1f2a44, vide = pas de thème)",
        default: "",
        onChange: notify
    },
    themeAccent: {
        type: OptionType.STRING,
        description: "Thème de profil, couleur d'accent (exemple : #5865f2)",
        default: "",
        onChange: notify
    },
    nameStyleEnabled: { type: OptionType.BOOLEAN, description: "", default: false, hidden: true, onChange: notify },
    nameFont: { type: OptionType.NUMBER, description: "", default: 1, hidden: true, onChange: notify },
    nameEffect: { type: OptionType.NUMBER, description: "", default: 1, hidden: true, onChange: notify },
    nameColors: { type: OptionType.STRING, description: "", default: "#ff5e5e, #5e9bff", hidden: true, onChange: notify },
    nameStyle: {
        type: OptionType.COMPONENT,
        component: StyleEditor
    }
});
