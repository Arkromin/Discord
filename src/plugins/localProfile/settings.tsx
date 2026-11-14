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

const HEX = /^#[0-9a-f]{6}$/i;
const validHex = (value: string) => HEX.test((value ?? "").trim());

const swatchStyle = {
    width: "44px",
    height: "32px",
    padding: 0,
    border: "none",
    borderRadius: "6px",
    background: "none",
    cursor: "pointer"
};

const THEME_PRESETS: Array<{ name: string; primary: string; accent: string; }> = [
    { name: "Bleu nuit", primary: "#1f2a44", accent: "#5865f2" },
    { name: "Violet", primary: "#3b1f5e", accent: "#b625e6" },
    { name: "Rose", primary: "#5e1f3f", accent: "#ff5e9b" },
    { name: "Rouge", primary: "#4a1414", accent: "#ff5e5e" },
    { name: "Orange", primary: "#4a2a10", accent: "#ffa14a" },
    { name: "Vert", primary: "#12392a", accent: "#3ddc97" },
    { name: "Turquoise", primary: "#10353d", accent: "#25b3e6" },
    { name: "Noir", primary: "#111214", accent: "#8b8d93" }
];

function ThemeEditor() {
    const { themePrimary, themeAccent } = settings.use(["themePrimary", "themeAccent"]);
    const enabled = validHex(themePrimary) || validHex(themeAccent);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "8px" }}>
            <Text variant="text-md/semibold">Thème de profil</Text>

            <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                        type="color"
                        style={swatchStyle}
                        value={validHex(themePrimary) ? themePrimary : "#1f2a44"}
                        onChange={e => { settings.store.themePrimary = e.currentTarget.value; }}
                    />
                    Couleur principale
                </label>
                <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                        type="color"
                        style={swatchStyle}
                        value={validHex(themeAccent) ? themeAccent : "#5865f2"}
                        onChange={e => { settings.store.themeAccent = e.currentTarget.value; }}
                    />
                    Couleur d'accent
                </label>
                <Button
                    size={Button.Sizes.SMALL}
                    color={Button.Colors.RED}
                    disabled={!enabled}
                    onClick={() => {
                        settings.store.themePrimary = "";
                        settings.store.themeAccent = "";
                    }}
                >Retirer le thème</Button>
            </div>

            <Text variant="text-xs/normal">{enabled ? "Thème actif." : "Aucun thème : ton vrai profil est utilisé."} Ou choisis un modèle :</Text>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {THEME_PRESETS.map(preset => (
                    <button
                        key={preset.name}
                        type="button"
                        title={preset.name}
                        aria-label={preset.name}
                        onClick={() => {
                            settings.store.themePrimary = preset.primary;
                            settings.store.themeAccent = preset.accent;
                        }}
                        style={{
                            width: "56px",
                            height: "32px",
                            borderRadius: "6px",
                            border: "2px solid var(--border-subtle, #3f4147)",
                            cursor: "pointer",
                            background: `linear-gradient(135deg, ${preset.primary} 0 50%, ${preset.accent} 50% 100%)`
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

function NameColors() {
    const { nameColors } = settings.use(["nameColors"]);
    const colors = (nameColors ?? "").split(",").map(c => c.trim()).filter(Boolean);

    const save = (list: string[]) => { settings.store.nameColors = list.join(", "); };

    return (
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            {colors.map((color, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                    <input
                        type="color"
                        style={swatchStyle}
                        value={validHex(color) ? color : "#ffffff"}
                        onChange={e => save(colors.map((c, j) => j === i ? e.currentTarget.value : c))}
                    />
                    <Button
                        size={Button.Sizes.SMALL}
                        color={Button.Colors.PRIMARY}
                        aria-label="Retirer cette couleur"
                        onClick={() => save(colors.filter((_, j) => j !== i))}
                    >✕</Button>
                </div>
            ))}
            {colors.length < 5 && (
                <Button size={Button.Sizes.SMALL} onClick={() => save([...colors, "#ffffff"])}>+ Ajouter une couleur</Button>
            )}
        </div>
    );
}

function StyleEditor() {
    const { nameStyleEnabled, nameFont, nameEffect } =
        settings.use(["nameStyleEnabled", "nameFont", "nameEffect"]);

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

            <div>
                Couleurs du pseudonyme<br />
                <NameColors />
            </div>
        </div>
    );
}

export const settings = definePluginSettings({
    files: {
        type: OptionType.COMPONENT,
        component: FilePicker
    },
    themePrimary: { type: OptionType.STRING, description: "", default: "", hidden: true, onChange: notify },
    themeAccent: { type: OptionType.STRING, description: "", default: "", hidden: true, onChange: notify },
    theme: {
        type: OptionType.COMPONENT,
        component: ThemeEditor
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
