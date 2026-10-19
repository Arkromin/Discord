/*
 * Discord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import { OptionType, PluginNative } from "@utils/types";
import { findComponentByCodeLazy } from "@webpack";
import { Button, Modal, openModal, Parser, useEffect, useRef, useState } from "@webpack/common";

const Native = VencordNative.pluginHelpers.AiChat as PluginNative<typeof import("./native")>;

const HeaderBarIcon = findComponentByCodeLazy(".HEADER_BAR_BADGE_BOTTOM,", 'position:"bottom"');

export const settings = definePluginSettings({
    apiKey: {
        type: OptionType.STRING,
        description: "Clé d'API Google Gemini (gratuite sur aistudio.google.com/apikey)",
        default: ""
    },
    model: {
        type: OptionType.STRING,
        description: "Modèle Gemini à utiliser",
        default: "gemini-2.5-flash"
    },
    systemPrompt: {
        type: OptionType.STRING,
        description: "Consigne donnée à l'IA avant chaque question",
        default: "Tu es un assistant utile sur Discord. Réponds en français, de façon claire et concise."
    }
});

export interface Turn {
    role: "user" | "model";
    text: string;
}

function errorMessage(status: number, data: string) {
    let detail = "";
    try {
        detail = JSON.parse(data)?.error?.message ?? "";
    } catch {
        detail = data;
    }

    if (status === -1) return `Impossible de joindre Google (${detail}).`;
    if (status === 400 || status === 403) return `Clé d'API refusée ou requête invalide. Vérifie ta clé dans les réglages du plugin. ${detail}`;
    if (status === 404) return `Modèle introuvable. Vérifie le nom du modèle dans les réglages du plugin. ${detail}`;
    if (status === 429) return "Limite d'utilisation gratuite atteinte. Réessaie dans un moment.";
    return `Erreur ${status}. ${detail}`;
}

export async function askAI(history: Turn[], question: string): Promise<string> {
    const { apiKey, model, systemPrompt } = settings.store;

    if (!apiKey.trim()) {
        throw new Error("Aucune clé d'API. Ajoute ta clé Gemini dans les réglages du plugin AiChat.");
    }

    const contents = [...history, { role: "user", text: question } as Turn].map(t => ({
        role: t.role,
        parts: [{ text: t.text }]
    }));

    const { status, data } = await Native.askGemini(apiKey.trim(), model.trim(), systemPrompt, contents);

    if (status !== 200) throw new Error(errorMessage(status, data));

    const json = JSON.parse(data);
    const text = (json?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");

    return text.trim() || "(Pas de réponse : le contenu a peut-être été bloqué par Gemini.)";
}

// The conversation is kept while Discord stays open, even if the window is closed
let savedTurns: Turn[] = [];

const rowStyle = (mine: boolean) => ({
    alignSelf: mine ? "flex-end" : "flex-start",
    maxWidth: "85%",
    padding: "8px 12px",
    borderRadius: "10px",
    background: mine ? "var(--brand-500, #5865f2)" : "var(--background-modifier-hover, #2b2d31)",
    color: mine ? "#fff" : "var(--text-default, #dbdee1)",
    whiteSpace: "pre-wrap" as const,
    overflowWrap: "anywhere" as const,
    userSelect: "text" as const
});

function ChatModal({ rootProps }: { rootProps: any; }) {
    const [turns, setTurns] = useState<Turn[]>(savedTurns);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ block: "end" });
    }, [turns, busy]);

    async function send() {
        const question = input.trim();
        if (!question || busy) return;

        setInput("");
        setError("");
        setBusy(true);

        const history = savedTurns;
        savedTurns = [...history, { role: "user", text: question }];
        setTurns(savedTurns);

        try {
            const answer = await askAI(history, question);
            savedTurns = [...savedTurns, { role: "model", text: answer }];
            setTurns(savedTurns);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }

    function reset() {
        savedTurns = [];
        setTurns([]);
        setError("");
    }

    return (
        <Modal {...rootProps} title="Discuter avec l'IA">
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", height: "420px", overflowY: "auto", padding: "4px" }}>
                {!turns.length && (
                    <div style={{ opacity: 0.7 }}>Pose ta question ci-dessous. Tu peux aussi utiliser la commande /ia dans un salon.</div>
                )}
                {turns.map((t, i) => (
                    <div key={i} style={rowStyle(t.role === "user")}>
                        {t.role === "user" ? t.text : Parser.parse(t.text)}
                    </div>
                ))}
                {busy && <div style={{ opacity: 0.7 }}>L'IA réfléchit...</div>}
                {error && <div style={{ color: "var(--text-danger, #f23f43)" }}>{error}</div>}
                <div ref={endRef} />
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "12px", marginBottom: "12px" }}>
                <input
                    value={input}
                    placeholder="Écris ton message..."
                    onChange={e => setInput(e.currentTarget.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter") send();
                    }}
                    style={{
                        flex: 1,
                        padding: "10px 12px",
                        borderRadius: "6px",
                        border: "none",
                        outline: "none",
                        background: "var(--background-base-lowest, #1e1f22)",
                        color: "var(--text-default, #dbdee1)"
                    }}
                />
                <Button onClick={send} disabled={busy}>Envoyer</Button>
                <Button onClick={reset} disabled={busy || !turns.length}>Effacer</Button>
            </div>
        </Modal>
    );
}

export function openChat() {
    openModal(props => <ChatModal rootProps={props} />);
}

function Icon() {
    return (
        <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
            <path fill="currentColor" d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" />
        </svg>
    );
}

export function AiButton() {
    if (!isPluginEnabled("AiChat")) return null;

    return (
        <HeaderBarIcon
            className="vc-aichat-btn"
            onClick={() => openChat()}
            tooltip="Discuter avec l'IA"
            icon={() => <Icon />}
        />
    );
}
