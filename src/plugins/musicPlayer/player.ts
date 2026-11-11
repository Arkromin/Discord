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

import { PluginNative } from "@utils/types";

import { settings } from "./settings";
import { Track } from "./sources";

const Native = VencordNative.pluginHelpers.MusicPlayer as PluginNative<typeof import("./native")>;

export interface PlayerState {
    current: Track | null;
    queue: Track[];
    playing: boolean;
    loading: boolean;
    error: string;
    position: number;
    duration: number;
}

const state: PlayerState = {
    current: null,
    queue: [],
    playing: false,
    loading: false,
    error: "",
    position: 0,
    duration: 0
};

const listeners = new Set<() => void>();
let audio: HTMLAudioElement | null = null;

function emit() {
    listeners.forEach(l => l());
}

function clampVolume(v: number) {
    return Math.min(100, Math.max(0, Math.round(Number.isFinite(v) ? v : 50)));
}

function getAudio() {
    if (audio) return audio;

    const a = new Audio();
    a.preload = "none";
    a.volume = clampVolume(settings.store.volume) / 100;

    a.addEventListener("playing", () => { state.playing = true; state.loading = false; emit(); });
    a.addEventListener("pause", () => { state.playing = false; emit(); });
    a.addEventListener("waiting", () => { state.loading = true; emit(); });
    a.addEventListener("timeupdate", () => {
        state.position = a.currentTime || 0;
        state.duration = Number.isFinite(a.duration) ? a.duration : 0;
        emit();
    });
    a.addEventListener("ended", () => next());
    a.addEventListener("error", () => {
        if (!state.current) return;

        state.loading = false;
        state.playing = false;
        state.error = state.current.kind === "radio"
            ? "Cette station ne répond pas, essaie-en une autre."
            : "Ce morceau ne peut pas être lu.";
        emit();

        // En file d'attente, on passe au morceau suivant tout seul
        if (state.queue.length) next();
    });

    audio = a;
    return a;
}

export const player = {
    getState: () => state,

    subscribe(fn: () => void) {
        listeners.add(fn);
        return () => { listeners.delete(fn); };
    },

    async play(track: Track) {
        const a = getAudio();

        state.current = track;
        state.error = "";
        state.loading = true;
        state.playing = false;
        state.position = 0;
        state.duration = 0;
        emit();

        try {
            const src = track.kind === "radio" ? await Native.proxyUrl(track.url) : track.url;
            if (state.current !== track) return;

            a.src = src;
            a.volume = clampVolume(settings.store.volume) / 100;
            await a.play();
        } catch (e) {
            if (state.current !== track) return;
            if (e instanceof DOMException && e.name === "AbortError") return;

            state.loading = false;
            state.error = "Lecture impossible : " + (e instanceof Error ? e.message : String(e));
            emit();
        }
    },

    async playList(tracks: Track[]) {
        if (!tracks.length) return;
        state.queue = tracks.slice(1);
        await player.play(tracks[0]);
    },

    enqueue(track: Track) {
        if (!state.current) return player.play(track);
        state.queue = [...state.queue, track];
        emit();
    },

    togglePause() {
        const a = getAudio();
        if (!state.current) return;

        if (a.paused) a.play().catch(() => { });
        else a.pause();
    },

    next,

    stop() {
        state.current = null;
        state.queue = [];
        state.playing = false;
        state.loading = false;
        state.error = "";
        state.position = 0;
        state.duration = 0;

        if (audio) {
            audio.pause();
            audio.removeAttribute("src");
            audio.load();
        }
        emit();
    },

    setVolume(v: number) {
        const value = clampVolume(v);
        settings.store.volume = value;
        if (audio) audio.volume = value / 100;
        emit();
    },

    getVolume: () => clampVolume(settings.store.volume),

    destroy() {
        player.stop();
        audio = null;
    }
};

function next() {
    const upcoming = state.queue[0];
    if (!upcoming) {
        player.stop();
        return Promise.resolve();
    }

    state.queue = state.queue.slice(1);
    return player.play(upcoming);
}
