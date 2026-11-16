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

import { Button, Modal, openModal, useEffect, useState } from "@webpack/common";

import { player } from "./player";
import { loadPlaylists, Playlist, playlists, shuffled } from "./playlists";
import { PRESET_RADIOS, searchMusic, searchRadios, Track } from "./sources";

function usePlayer() {
    const [, setTick] = useState(0);
    useEffect(() => player.subscribe(() => setTick(n => n + 1)), []);
    return player.getState();
}

function usePlaylists() {
    const [, setTick] = useState(0);
    useEffect(() => {
        loadPlaylists();
        return playlists.subscribe(() => setTick(n => n + 1));
    }, []);
    return playlists.getAll();
}

function fmt(seconds: number) {
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const inputStyle = {
    flex: 1,
    padding: "10px 12px",
    borderRadius: "6px",
    border: "none",
    outline: "none",
    background: "var(--background-base-lowest, #1e1f22)",
    color: "var(--text-default, #dbdee1)"
};

function PlayerBar() {
    const st = usePlayer();
    const volume = player.getVolume();

    return (
        <div style={{ padding: "12px", borderRadius: "8px", background: "var(--background-base-lower, #2b2d31)", display: "flex", flexDirection: "column", gap: "8px" }}>
            {st.current ? (
                <>
                    <div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                        {st.current.kind === "radio" ? "📻 " : "🎵 "}{st.current.title}
                    </div>
                    <div style={{ opacity: 0.7, fontSize: "13px" }}>
                        {st.error
                            ? <span style={{ color: "var(--text-danger, #f23f43)" }}>{st.error}</span>
                            : st.loading
                                ? "Chargement..."
                                : st.current.kind === "radio"
                                    ? `En direct · ${st.current.subtitle}`
                                    : `${st.current.subtitle}${st.duration ? ` · ${fmt(st.position)} / ${fmt(st.duration)}` : ""}`}
                    </div>
                </>
            ) : (
                <div style={{ opacity: 0.7 }}>Rien en lecture. Cherche un morceau ou une radio ci-dessous.</div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <Button size={Button.Sizes.SMALL} onClick={() => player.togglePause()} disabled={!st.current}>
                    {st.playing ? "⏸ Pause" : "▶ Lecture"}
                </Button>
                <Button size={Button.Sizes.SMALL} onClick={() => player.next()} disabled={!st.queue.length}>⏭ Suivant</Button>
                <Button size={Button.Sizes.SMALL} onClick={() => player.stop()} disabled={!st.current}>⏹ Stop</Button>
                <span style={{ marginLeft: "auto" }}>🔊</span>
                <input
                    type="range"
                    min={0}
                    max={100}
                    value={volume}
                    aria-label="Volume"
                    onChange={e => player.setVolume(Number(e.currentTarget.value))}
                    style={{ width: "140px" }}
                />
                <span style={{ width: "34px", textAlign: "right" }}>{volume}%</span>
            </div>

            {st.queue.length > 0 && (
                <div style={{ opacity: 0.7, fontSize: "13px" }}>
                    File d'attente ({st.queue.length}) : {st.queue.slice(0, 3).map(t => t.title).join(", ")}{st.queue.length > 3 ? "..." : ""}
                </div>
            )}
        </div>
    );
}

type Mode = "music" | "radio" | "playlists";

const smallText = { opacity: 0.7, fontSize: "12px" } as const;
const rowStyle = { display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", borderRadius: "6px", background: "var(--background-base-low, #232428)" } as const;

function PlaylistsTab() {
    const all = usePlaylists();
    const [name, setName] = useState("");
    const [openId, setOpenId] = useState<string | null>(null);

    function create() {
        const p = playlists.create(name);
        if (p) { setName(""); setOpenId(p.id); }
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
                <input
                    value={name}
                    placeholder="Nom de la nouvelle playlist"
                    onChange={e => setName(e.currentTarget.value)}
                    onKeyDown={e => { if (e.key === "Enter") create(); }}
                    style={inputStyle}
                />
                <Button onClick={create} disabled={!name.trim()}>Créer</Button>
            </div>

            {!all.length && <div style={{ opacity: 0.7 }}>Aucune playlist. Crée-en une, puis ajoute des morceaux depuis l'onglet Musique avec « + Playlist ».</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "300px", overflowY: "auto" }}>
                {all.map((p: Playlist) => (
                    <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div style={rowStyle}>
                            <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                                <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{openId === p.id ? "▾" : "▸"} {p.name}</div>
                                <div style={smallText}>{p.tracks.length} morceau{p.tracks.length > 1 ? "x" : ""}</div>
                            </div>
                            <Button size={Button.Sizes.SMALL} disabled={!p.tracks.length} onClick={() => player.playList(p.tracks)}>Lire</Button>
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} disabled={!p.tracks.length} onClick={() => player.playList(shuffled(p.tracks))}>Aléatoire</Button>
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} onClick={() => playlists.remove(p.id)}>Supprimer</Button>
                        </div>

                        {openId === p.id && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingLeft: "16px" }}>
                                {!p.tracks.length && <div style={smallText}>Vide.</div>}
                                {p.tracks.map((t, i) => (
                                    <div key={t.url + i} style={{ ...rowStyle, padding: "4px 8px" }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                                            <div style={smallText}>{t.subtitle}</div>
                                        </div>
                                        <Button size={Button.Sizes.SMALL} onClick={() => player.playList(p.tracks.slice(i))}>Lire</Button>
                                        <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={() => playlists.removeTrack(p.id, i)}>✕</Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function PlayerModal({ rootProps }: { rootProps: any; }) {
    const [mode, setMode] = useState<Mode>("music");
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Track[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const all = usePlaylists();
    const [targetId, setTargetId] = useState("");
    const target = all.find(p => p.id === targetId) ?? all[0];

    async function search(text = query, m: Mode = mode) {
        const q = text.trim();
        if (!q || busy) return;

        setBusy(true);
        setError("");
        try {
            const found = m === "radio" ? await searchRadios(q) : await searchMusic(q);
            setResults(found);
            if (!found.length) setError("Aucun résultat.");
        } catch (e) {
            setResults([]);
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }

    function changeMode(m: Mode) {
        setMode(m);
        setResults([]);
        setError("");
    }

    return (
        <Modal {...rootProps} title="Lecteur de musique">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "12px" }}>
                <PlayerBar />

                <div style={{ display: "flex", gap: "8px" }}>
                    <Button color={mode === "music" ? Button.Colors.BRAND : Button.Colors.PRIMARY} onClick={() => changeMode("music")}>Musique</Button>
                    <Button color={mode === "radio" ? Button.Colors.BRAND : Button.Colors.PRIMARY} onClick={() => changeMode("radio")}>Radio</Button>
                    <Button color={mode === "playlists" ? Button.Colors.BRAND : Button.Colors.PRIMARY} onClick={() => changeMode("playlists")}>Playlists</Button>
                </div>

                {mode === "playlists" ? <PlaylistsTab /> : <>
                <div style={{ display: "flex", gap: "8px" }}>
                    <input
                        value={query}
                        placeholder={mode === "radio" ? "Nom d'une radio (NRJ, FIP...)" : "Titre ou artiste"}
                        onChange={e => setQuery(e.currentTarget.value)}
                        onKeyDown={e => { if (e.key === "Enter") search(); }}
                        style={inputStyle}
                    />
                    <Button onClick={() => search()} disabled={busy}>Chercher</Button>
                </div>

                {mode === "radio" && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {PRESET_RADIOS.map(name => (
                            <Button
                                key={name}
                                size={Button.Sizes.SMALL}
                                color={Button.Colors.PRIMARY}
                                onClick={() => { setQuery(name); search(name, "radio"); }}
                            >{name}</Button>
                        ))}
                    </div>
                )}

                {mode === "music" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={smallText}>Ajouter à :</span>
                        {all.length ? (
                            <select
                                value={target?.id ?? ""}
                                onChange={e => setTargetId(e.currentTarget.value)}
                                style={{ ...inputStyle, flex: "0 1 220px", padding: "6px 8px" }}
                            >
                                {all.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        ) : (
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={() => { const p = playlists.create("Ma playlist"); if (p) setTargetId(p.id); }}>Créer « Ma playlist »</Button>
                        )}
                    </div>
                )}

                {busy && <div style={{ opacity: 0.7 }}>Recherche...</div>}
                {error && <div style={{ color: "var(--text-danger, #f23f43)" }}>{error}</div>}

                <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "260px", overflowY: "auto" }}>
                    {results.map((t, i) => (
                        <div key={t.url + i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", borderRadius: "6px", background: "var(--background-base-low, #232428)" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                                <div style={{ opacity: 0.7, fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subtitle}</div>
                            </div>
                            <Button size={Button.Sizes.SMALL} onClick={() => player.play(t)}>Lire</Button>
                            {t.kind === "music" && (
                                <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={() => player.enqueue(t)}>+ File</Button>
                            )}
                            {t.kind === "music" && target && (
                                <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={() => playlists.addTrack(target.id, t)}>+ Playlist</Button>
                            )}
                        </div>
                    ))}
                </div>
                </>}
            </div>
        </Modal>
    );
}

export function openPlayer() {
    openModal(props => <PlayerModal rootProps={props} />);
}
