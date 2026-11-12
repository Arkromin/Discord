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

import ErrorBoundary from "@components/ErrorBoundary";
import { findComponentByCodeLazy } from "@webpack";
import { Button, Popout, showToast, useEffect, useRef, useState } from "@webpack/common";

import { player } from "./player";
import { settings } from "./settings";
import { searchRadios } from "./sources";
import { openPlayer } from "./ui";

const HeaderBarIcon = findComponentByCodeLazy(".HEADER_BAR_BADGE_BOTTOM,", 'position:"bottom"');

const QUICK_RADIOS = ["NRJ", "FIP", "Skyrock", "France Inter", "Fun Radio", "RTL"];

function usePlayer() {
    const [, setTick] = useState(0);
    useEffect(() => player.subscribe(() => setTick(n => n + 1)), []);
    return player.getState();
}

function fmt(seconds: number) {
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

async function playRadio(name: string) {
    try {
        const stations = await searchRadios(name);
        if (!stations.length) return showToast(`Aucune radio trouvée pour « ${name} »`);
        await player.play(stations[0]);
    } catch (e) {
        showToast(e instanceof Error ? e.message : String(e));
    }
}

function NoteIcon({ playing }: { playing: boolean; }) {
    return (
        <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
            <path fill="currentColor" d="M9 3v10.55A4 4 0 1 0 11 17V7h6V3H9z" />
            {playing && <circle cx="19" cy="18" r="3.2" fill="var(--status-positive, #23a55a)" />}
        </svg>
    );
}

function Popup({ close }: { close: () => void; }) {
    const st = usePlayer();
    const volume = player.getVolume();
    const percent = st.duration ? Math.min(100, (st.position / st.duration) * 100) : 0;

    let line: string;
    if (st.error) line = st.error;
    else if (st.loading) line = "Chargement...";
    else if (st.current?.kind === "radio") line = `En direct · ${st.current.subtitle}`;
    else if (st.current) line = `${st.current.subtitle}${st.duration ? ` · ${fmt(st.position)} / ${fmt(st.duration)}` : ""}`;
    else line = "";

    return (
        <div
            style={{
                width: "300px",
                padding: "14px",
                borderRadius: "10px",
                background: "var(--background-base-lower, #2b2d31)",
                border: "1px solid var(--border-subtle, #3f4147)",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
                color: "var(--text-default, #dbdee1)",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
            }}
        >
            {st.current ? (
                <div>
                    <div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                        {st.current.kind === "radio" ? "📻 " : "🎵 "}{st.current.title}
                    </div>
                    <div style={{ fontSize: "12px", opacity: 0.7, color: st.error ? "var(--text-danger, #f23f43)" : undefined }}>{line}</div>
                    {st.current.kind === "music" && (
                        <div style={{ height: "4px", borderRadius: "2px", marginTop: "8px", background: "var(--background-modifier-accent, #4e5058)" }}>
                            <div style={{ width: `${percent}%`, height: "100%", borderRadius: "2px", background: "var(--brand-500, #5865f2)" }} />
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ opacity: 0.7 }}>Rien en lecture. Choisis une radio ci-dessous ou ouvre le lecteur.</div>
            )}

            <div style={{ display: "flex", gap: "6px" }}>
                <Button size={Button.Sizes.SMALL} onClick={() => player.togglePause()} disabled={!st.current}>
                    {st.playing ? "⏸ Pause" : "▶ Lecture"}
                </Button>
                <Button size={Button.Sizes.SMALL} onClick={() => player.next()} disabled={!st.queue.length}>⏭ Suivant</Button>
                <Button size={Button.Sizes.SMALL} onClick={() => player.stop()} disabled={!st.current}>⏹</Button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🔊</span>
                <input
                    type="range"
                    min={0}
                    max={100}
                    value={volume}
                    aria-label="Volume"
                    onChange={e => player.setVolume(Number(e.currentTarget.value))}
                    style={{ flex: 1 }}
                />
                <span style={{ width: "34px", textAlign: "right", fontSize: "12px" }}>{volume}%</span>
            </div>

            {st.queue.length > 0 && (
                <div style={{ fontSize: "12px", opacity: 0.7 }}>
                    File d'attente ({st.queue.length}) : {st.queue.slice(0, 2).map(t => t.title).join(", ")}{st.queue.length > 2 ? "..." : ""}
                </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {QUICK_RADIOS.map(name => (
                    <Button key={name} size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={() => playRadio(name)}>{name}</Button>
                ))}
            </div>

            <Button size={Button.Sizes.SMALL} onClick={() => { close(); openPlayer(); }}>Ouvrir le lecteur complet</Button>
        </div>
    );
}

function MiniPlayerButton() {
    const buttonRef = useRef(null);
    const [show, setShow] = useState(false);
    const st = usePlayer();
    const { showMiniPlayer } = settings.use(["showMiniPlayer"]);

    if (!showMiniPlayer) return null;

    const tooltip = st.current && st.playing ? `En lecture : ${st.current.title}` : "Lecteur de musique";

    return (
        <Popout
            position="bottom"
            align="right"
            animation={Popout.Animation.NONE}
            shouldShow={show}
            onRequestClose={() => setShow(false)}
            targetElementRef={buttonRef}
            renderPopout={() => <Popup close={() => setShow(false)} />}
        >
            {(_, { isShown }) => (
                <HeaderBarIcon
                    ref={buttonRef}
                    onClick={() => setShow(v => !v)}
                    tooltip={isShown ? null : tooltip}
                    icon={() => <NoteIcon playing={st.playing} />}
                    selected={isShown}
                />
            )}
        </Popout>
    );
}

export default function MiniPlayer() {
    return (
        <ErrorBoundary key="vc-musicplayer" noop>
            <MiniPlayerButton />
        </ErrorBoundary>
    );
}
