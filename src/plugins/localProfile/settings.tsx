/*
 * Discord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { del, get, set } from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";
import { chooseFile } from "@utils/web";
import { findLazy } from "@webpack";
import { Button, showToast, Text, useEffect, useState } from "@webpack/common";

export const AVATAR_KEY = "LocalProfile_avatar";
export const BANNER_KEY = "LocalProfile_banner";

export interface StoredFile {
    name: string;
    type: string;
    blob: Blob;
}

// Réglages (couleurs, style du pseudo)
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

// Fichiers choisis (avatar, bannière)
const fileListeners = new Set<() => void>();

export function onFilesChange(listener: () => void) {
    fileListeners.add(listener);
    return () => {
        fileListeners.delete(listener);
    };
}

const notifyFiles = () => fileListeners.forEach(listener => listener());

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

interface FileRowProps {
    label: string;
    storeKey: string;
    accept: string;
    maxMb: number;
    hint: string;
}

function FileRow({ label, storeKey, accept, maxMb, hint }: FileRowProps) {
    const [info, setInfo] = useState("...");

    const refresh = () => get<StoredFile>(storeKey).then(file => {
        setInfo(file?.blob ? `${file.name} (${(file.blob.size / 1048576).toFixed(1)} Mo)` : "Aucun fichier (ton vrai profil est utilisé)");
    });

    useEffect(() => { refresh(); }, []);

    async function pick() {
        const file = await chooseFile(accept);
        if (!file) return;

        if (file.size > maxMb * 1048576) {
            showToast(`Fichier trop gros (${maxMb} Mo maximum)`, "failure");
            return;
        }

        await set(storeKey, { name: file.name, type: file.type, blob: file } satisfies StoredFile);
        notifyFiles();
        refresh();
        showToast(`${label} enregistré`, "success");
    }

    async function remove() {
        await del(storeKey);
        notifyFiles();
        refresh();
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <Text variant="text-md/semibold">{label}</Text>
            <Text variant="text-xs/normal">{hint}</Text>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <Button size={Button.Sizes.SMALL} onClick={() => pick()}>Choisir un fichier</Button>
                <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} onClick={() => remove()}>Retirer</Button>
                <Text variant="text-sm/normal">{info}</Text>
            </div>
        </div>
    );
}

function FilePicker() {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "8px" }}>
            <FileRow
                label="Avatar animé"
                storeKey={AVATAR_KEY}
                accept="image/*"
                maxMb={15}
                hint="Une image ou un GIF (15 Mo maximum). Le fichier reste sur ton ordinateur."
            />
            <FileRow
                label="Bannière"
                storeKey={BANNER_KEY}
                accept="image/*,video/mp4,video/webm"
                maxMb={60}
                hint="Une image, un GIF ou une vidéo mp4/webm (60 Mo maximum). Le fichier reste sur ton ordinateur."
            />
        </div>
    );
}

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
    files: {
        type: OptionType.COMPONENT,
        component: FilePicker
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
