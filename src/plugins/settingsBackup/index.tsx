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
import { definePluginSettings } from "@api/Settings";
import { exportSettings, importSettings } from "@api/SettingsSync/offline";
import { Flex } from "@components/Flex";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Button, showToast, Text, useEffect, useState } from "@webpack/common";

interface Snapshot {
    id: number;
    data: string;
}

const KEY = "SettingsBackup_snapshots";
const HOUR = 3600_000;

const settings = definePluginSettings({
    autoBackup: {
        type: OptionType.BOOLEAN,
        description: "Sauvegarde automatique locale",
        default: true
    },
    intervalHours: {
        type: OptionType.NUMBER,
        description: "Intervalle minimum entre deux sauvegardes automatiques (heures)",
        default: 6
    },
    maxBackups: {
        type: OptionType.NUMBER,
        description: "Nombre de sauvegardes conservées",
        default: 5
    },
    manager: {
        type: OptionType.COMPONENT,
        component: () => <Manager />
    }
});

const fmt = (id: number) => new Date(id).toLocaleString("fr-FR");

async function load(): Promise<Snapshot[]> {
    return (await get<Snapshot[]>(KEY)) ?? [];
}

async function createSnapshot(force = false) {
    const data = await exportSettings({ minify: true });
    const list = await load();
    if (!force && list[0]?.data === data) return false;

    const max = Math.max(1, Math.floor(settings.store.maxBackups) || 5);
    await set(KEY, [{ id: Date.now(), data }, ...list].slice(0, max));
    return true;
}

async function restore(snap: Snapshot) {
    await importSettings(snap.data);
    showToast("Réglages restaurés, redémarrage…", "success");
    setTimeout(() => location.reload(), 1200);
}

function Manager() {
    const [list, setList] = useState<Snapshot[]>([]);
    const refresh = () => load().then(setList);
    useEffect(() => { refresh(); }, []);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Flex style={{ gap: 8 }}>
                <Button onClick={async () => {
                    await createSnapshot(true);
                    showToast("Sauvegarde créée", "success");
                    refresh();
                }}>Sauvegarder maintenant</Button>
            </Flex>
            {list.length === 0 && <Text variant="text-sm/normal">Aucune sauvegarde pour l'instant.</Text>}
            {list.map(s => (
                <Flex key={s.id} style={{ alignItems: "center", gap: 8 }}>
                    <Text variant="text-md/normal" style={{ flex: 1 }}>{fmt(s.id)}</Text>
                    <Button size={Button.Sizes.SMALL} onClick={() => restore(s).catch(e => showToast(String(e), "failure"))}>
                        Restaurer
                    </Button>
                    <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} onClick={async () => {
                        await set(KEY, list.filter(x => x.id !== s.id));
                        refresh();
                    }}>Supprimer</Button>
                </Flex>
            ))}
            <Text variant="text-xs/normal">
                Ces sauvegardes sont stockées dans les données de Discord. Pour une copie en dehors de Discord, utilise aussi « Sauvegarde &amp; restauration » (export en fichier).
            </Text>
        </div>
    );
}

let timer: ReturnType<typeof setInterval> | undefined;

async function tick() {
    if (!settings.store.autoBackup) return;
    const list = await load();
    const last = list[0]?.id ?? 0;
    if (Date.now() - last < (settings.store.intervalHours || 6) * HOUR) return;
    await createSnapshot();
}

export default definePlugin({
    name: "SettingsBackup",
    description: "Sauvegarde automatiquement tes réglages (plugins, options) et permet de les restaurer en un clic.",
    authors: [Devs.Arkromin],
    settings,

    start() {
        setTimeout(() => tick().catch(() => { }), 30_000);
        timer = setInterval(() => tick().catch(() => { }), HOUR / 2);
    },

    stop() {
        clearInterval(timer);
    },

    toolboxActions: {
        async "Sauvegarder les réglages"() {
            await createSnapshot(true);
            showToast("Sauvegarde créée", "success");
        }
    }
});
