/*
 * Discord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled, pluginRequiresRestart, startDependenciesRecursive, startPlugin, stopPlugin } from "@api/PluginManager";
import { Settings } from "@api/Settings";
import { Margins } from "@utils/margins";
import { Plugin } from "@utils/types";
import { Button, ConfirmModal, openModal, showToast } from "@webpack/common";

import { logger } from ".";

type RestartCallback = (name: string, key: string) => void;

interface BulkToggleProps {
    plugins: Plugin[];
    onRestartNeeded: RestartCallback;
}

// Same logic as the toggle of a single plugin card, but with a target state
function setPluginEnabled(plugin: Plugin, enable: boolean, onRestartNeeded: RestartCallback) {
    const settings = Settings.plugins[plugin.name];
    const wasEnabled = isPluginEnabled(plugin.name);

    if (enable) {
        const { restartNeeded, failures } = startDependenciesRecursive(plugin);

        if (failures.length) {
            logger.error(`Failed to start dependencies for ${plugin.name}: ${failures.join(", ")}`);
            return false;
        }

        if (restartNeeded) {
            settings.enabled = true;
            onRestartNeeded(plugin.name, "enabled");
            return true;
        }
    }

    if (pluginRequiresRestart(plugin)) {
        settings.enabled = enable;
        onRestartNeeded(plugin.name, "enabled");
        return true;
    }

    if (wasEnabled && !plugin.started) {
        settings.enabled = enable;
        return true;
    }

    const result = wasEnabled ? stopPlugin(plugin) : startPlugin(plugin);

    if (!result) {
        settings.enabled = false;
        return false;
    }

    settings.enabled = enable;
    return true;
}

function applyToAll(plugins: Plugin[], enable: boolean, onRestartNeeded: RestartCallback) {
    let changed = 0;
    let failed = 0;

    for (const plugin of plugins) {
        if (isPluginEnabled(plugin.name) === enable) continue;

        if (setPluginEnabled(plugin, enable, onRestartNeeded)) changed++;
        else failed++;
    }

    const done = `${changed} plugin${changed === 1 ? "" : "s"} ${enable ? "enabled" : "disabled"}`;
    showToast(failed ? `${done}, ${failed} failed (see the console)` : done, failed ? "failure" : "success");
}

function confirmAndApply(plugins: Plugin[], enable: boolean, onRestartNeeded: RestartCallback) {
    const targets = plugins.filter(p => isPluginEnabled(p.name) !== enable);

    if (!targets.length) {
        showToast(`All the shown plugins are already ${enable ? "enabled" : "disabled"}`);
        return;
    }

    openModal(props => (
        <ConfirmModal
            {...props}
            title={enable ? "Enable all shown plugins?" : "Disable all shown plugins?"}
            confirmText={enable ? "Enable" : "Disable"}
            cancelText="Cancel"
            variant="primary"
            onConfirm={() => applyToAll(targets, enable, onRestartNeeded)}
        >
            <p>
                {targets.length} plugin{targets.length === 1 ? "" : "s"} will be {enable ? "enabled" : "disabled"}.
                Some of them may need a restart to apply.
            </p>
        </ConfirmModal>
    ));
}

export function BulkToggle({ plugins, onRestartNeeded }: BulkToggleProps) {
    return (
        <div className={Margins.bottom8} style={{ display: "flex", gap: "8px" }}>
            <Button onClick={() => confirmAndApply(plugins, true, onRestartNeeded)}>
                Enable all shown
            </Button>
            <Button onClick={() => confirmAndApply(plugins, false, onRestartNeeded)}>
                Disable all shown
            </Button>
        </div>
    );
}