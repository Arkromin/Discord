/*
 * Discord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
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
const STARTUP_DELAY = 15 * 1000;

const settings = definePluginSettings({
    dailyCheck: {
        type: OptionType.BOOLEAN,
        description: "Check for updates at startup and every 24 hours, then show it on the update icon (it never installs on its own)",
        default: true
    }
});

let interval: ReturnType<typeof setInterval> | undefined;
let startupTimeout: ReturnType<typeof setTimeout> | undefined;
let updating = false;

// Whether a newer version exists. The update icon in the titlebar listens to it.
let available = false;
const listeners = new Set<(value: boolean) => void>();

export const isUpdateAvailable = () => available;

export function subscribe(listener: (value: boolean) => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function setAvailable(value: boolean) {
    if (available === value) return;

    available = value;
    listeners.forEach(listener => listener(value));
}

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

export async function manualUpdate() {
    if (IS_UPDATER_DISABLED) {
        showToast("Les mises à jour sont désactivées dans cette version");
        return;
    }

    try {
        showToast("Recherche de mises à jour...");
        const outdated = await checkForUpdates();
        setAvailable(outdated);

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

async function backgroundCheck() {
    if (IS_UPDATER_DISABLED || !settings.store.dailyCheck) return;

    try {
        const wasAvailable = available;
        const outdated = await checkForUpdates();
        setAvailable(outdated);

        // Only notify once per new version, not on every check
        if (!outdated || wasAvailable) return;

        showNotification({
            title: "Une nouvelle version est disponible",
            body: "Clique ici pour l'installer et redémarrer",
            permanent: true,
            noPersist: true,
            onClick: installUpdate
        });
    } catch (e) {
        logger.error("Background update check failed", e);
    }
}

export default definePlugin({
    name: "QuickUpdate",
    description: "Adds an update button to the titlebar and the Discord Toolbox. The icon changes when a new version is available (checked at startup and every 24 hours, optional). Updates are never installed unless you click.",
    tags: ["Utility"],
    authors: [Devs.Arkromin],
    settings,

    toolboxActions: {
        "Mettre à jour": manualUpdate
    },

    start() {
        startupTimeout = setTimeout(backgroundCheck, STARTUP_DELAY);
        interval = setInterval(backgroundCheck, DAY);
    },

    stop() {
        clearTimeout(startupTimeout);
        clearInterval(interval);
        startupTimeout = undefined;
        interval = undefined;
        setAvailable(false);
    }
});
