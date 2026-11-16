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

import { get, set } from "@api/DataStore";

import { Track } from "./sources";

export interface Playlist {
    id: string;
    name: string;
    tracks: Track[];
}

const KEY = "MusicPlayer_playlists";

let lists: Playlist[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
    listeners.forEach(l => l());
}

function save() {
    set(KEY, lists).catch(() => { });
    emit();
}

export async function loadPlaylists() {
    if (loaded) return;
    loaded = true;

    try {
        const stored = await get<Playlist[]>(KEY);
        if (Array.isArray(stored)) lists = stored;
    } catch { }
    emit();
}

export const playlists = {
    getAll: () => lists,

    subscribe(fn: () => void) {
        listeners.add(fn);
        return () => { listeners.delete(fn); };
    },

    create(name: string) {
        const clean = name.trim();
        if (!clean) return null;

        const existing = lists.find(p => p.name.toLowerCase() === clean.toLowerCase());
        if (existing) return existing;

        const playlist: Playlist = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: clean, tracks: [] };
        lists = [...lists, playlist];
        save();
        return playlist;
    },

    find(name: string) {
        const n = name.trim().toLowerCase();
        return lists.find(p => p.name.toLowerCase() === n) ?? lists.find(p => p.name.toLowerCase().includes(n));
    },

    remove(id: string) {
        lists = lists.filter(p => p.id !== id);
        save();
    },

    rename(id: string, name: string) {
        const clean = name.trim();
        if (!clean) return;
        lists = lists.map(p => p.id === id ? { ...p, name: clean } : p);
        save();
    },

    addTrack(id: string, track: Track) {
        lists = lists.map(p => {
            if (p.id !== id || p.tracks.some(t => t.url === track.url)) return p;
            return { ...p, tracks: [...p.tracks, track] };
        });
        save();
    },

    removeTrack(id: string, index: number) {
        lists = lists.map(p => p.id === id ? { ...p, tracks: p.tracks.filter((_, i) => i !== index) } : p);
        save();
    }
};

export function shuffled<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}
