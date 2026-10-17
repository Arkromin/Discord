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

import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import { relaunch } from "@utils/native";
import definePlugin, { OptionType } from "@utils/types";
import { checkForUpdates, update } from "@utils/updater";
import { showToast } from "@webpack/common";

const logger = new Logger("QuickUpdate");

const DAY = 24 * 60 * 60 * 1000;

const settings = definePluginSettings({
    dailyCheck: {
        type: OptionType.BOOLEAN,
        description: "Check for updates every 24 hours and notify you when one is available (it never installs on its own)",
        default: true
    }
});

let interval: ReturnType<typeof setInterval> | undefined;
let updating = false;

async function installUpdate() {
    if (updating) return;
    updating = true;

    try {
        showToast("Mise à jour en cours...");
        await update();
        showToast("Mise à jour installée, redémarrage...");
        setTimeout(relaunch, 1500);
    } catch (e) {
        logger.error("Update failed", e);
        showToast("La mise à jour a échoué (détails dans la console)", "failure");
    } finally {
        updating = false;
    }
}

async function manualUpdate() {
    if (IS_UPDATER_DISABLED) {
        showToast("Les mises à jour sont désactivées dans cette version");
        return;
    }

    try {
        showToast("Recherche de mises à jour...");
        const outdated = await checkForUpdates();

        if (!outdated) {
            showToast("Tu es déjà à jour");
            return;
        }

        await installUpdate();
    } catch (e) {
        logger.error("Update check failed", e);
        showToast("Impossible de vérifier les mises à jour (détails dans la console)", "failure");
    }
}

async function dailyCheck() {
    if (IS_UPDATER_DISABLED || !settings.store.dailyCheck) return;

    try {
        if (!await checkForUpdates()) return;

        showNotification({
            title: "Une mise à jour est disponible",
            body: "Clique ici pour l'installer et redémarrer",
            permanent: true,
            noPersist: true,
            onClick: installUpdate
        });
    } catch (e) {
        logger.error("Daily update check failed", e);
    }
}

export default definePlugin({
    name: "QuickUpdate",
    description: "Adds an update button to the Discord Toolbox and checks for updates every 24 hours (optional). Updates are never installed unless you click.",
    tags: ["Utility"],
    authors: [Devs.Arkromin],
    settings,

    toolboxActions: {
        "Mettre à jour": manualUpdate
    },

    start() {
        interval = setInterval(dailyCheck, DAY);
    },

    stop() {
        clearInterval(interval);
        interval = undefined;
    }
});