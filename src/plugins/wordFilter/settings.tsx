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
import { Flex } from "@components/Flex";
import { OptionType } from "@utils/types";
import { Button, Text, useState } from "@webpack/common";

import { ALL_CATEGORY_IDS, CATEGORIES } from "./words";

export const settings = definePluginSettings({
    mode: {
        type: OptionType.SELECT,
        description: "Comment masquer les mots",
        options: [
            { label: "Étoiles (p***)", value: "stars", default: true },
            { label: "Spoiler (||mot||, clique pour voir)", value: "spoiler" },
            { label: "Masquer tout le message", value: "hide" }
        ]
    },
    filterOwn: {
        type: OptionType.BOOLEAN,
        description: "Masquer aussi mes propres messages",
        default: false
    },
    customWords: {
        type: OptionType.STRING,
        description: "Mots à ajouter (séparés par des virgules)",
        default: ""
    },
    allowedWords: {
        type: OptionType.STRING,
        description: "Mots à toujours autoriser (séparés par des virgules)",
        default: ""
    },
    categories: {
        type: OptionType.CUSTOM,
        description: "Catégories actives",
        default: [...ALL_CATEGORY_IDS] as string[]
    },
    disabledWords: {
        type: OptionType.CUSTOM,
        description: "Mots désactivés individuellement",
        default: [] as string[]
    },
    picker: {
        type: OptionType.COMPONENT,
        component: () => <Picker />
    }
});

function Picker() {
    const { categories, disabledWords } = settings.use(["categories", "disabledWords"]);
    const [open, setOpen] = useState<string | null>(null);

    const allOn = categories.length === ALL_CATEGORY_IDS.length && disabledWords.length === 0;

    const toggleCategory = (id: string) => {
        settings.store.categories = categories.includes(id)
            ? categories.filter(c => c !== id)
            : [...categories, id];
    };

    const toggleWord = (w: string) => {
        settings.store.disabledWords = disabledWords.includes(w)
            ? disabledWords.filter(x => x !== w)
            : [...disabledWords, w];
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Flex style={{ gap: 8 }}>
                <Button
                    color={allOn ? Button.Colors.GREEN : Button.Colors.BRAND}
                    onClick={() => {
                        settings.store.categories = [...ALL_CATEGORY_IDS];
                        settings.store.disabledWords = [];
                    }}
                >
                    Tout masquer (toute la base)
                </Button>
                <Button
                    color={Button.Colors.PRIMARY}
                    onClick={() => { settings.store.categories = []; }}
                >
                    Tout désactiver
                </Button>
            </Flex>

            {CATEGORIES.map(cat => {
                const on = categories.includes(cat.id);
                const isOpen = open === cat.id;
                const words = [...new Set(cat.words)];
                return (
                    <div key={cat.id} style={{ border: "1px solid var(--background-modifier-accent)", borderRadius: 8, padding: 10 }}>
                        <Flex style={{ alignItems: "center", gap: 10 }}>
                            <input type="checkbox" checked={on} onChange={() => toggleCategory(cat.id)} />
                            <div style={{ flex: 1 }}>
                                <Text variant="text-md/semibold">{cat.label} ({words.length})</Text>
                                <Text variant="text-xs/normal">{cat.description}</Text>
                            </div>
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={() => setOpen(isOpen ? null : cat.id)}>
                                {isOpen ? "Fermer" : "Choisir les mots"}
                            </Button>
                        </Flex>
                        {isOpen && (
                            <div style={{ marginTop: 10 }}>
                                <Flex style={{ gap: 8, marginBottom: 8 }}>
                                    <Button size={Button.Sizes.SMALL} onClick={() => {
                                        settings.store.disabledWords = disabledWords.filter(w => !words.includes(w));
                                    }}>Tout cocher</Button>
                                    <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={() => {
                                        settings.store.disabledWords = [...new Set([...disabledWords, ...words])];
                                    }}>Tout décocher</Button>
                                </Flex>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                                    {words.map(w => {
                                        const active = !disabledWords.includes(w);
                                        return (
                                            <span
                                                key={w}
                                                onClick={() => toggleWord(w)}
                                                style={{
                                                    cursor: "pointer",
                                                    padding: "2px 8px",
                                                    borderRadius: 12,
                                                    fontSize: 12,
                                                    background: active ? "var(--brand-500)" : "var(--background-modifier-hover)",
                                                    color: active ? "#fff" : "var(--text-muted)",
                                                    textDecoration: active ? "none" : "line-through"
                                                }}
                                            >{w}</span>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
            <Text variant="text-xs/normal">Les changements s'appliquent aux nouveaux messages et aux salons rechargés (Ctrl+R pour tout rafraîchir).</Text>
        </div>
    );
}
