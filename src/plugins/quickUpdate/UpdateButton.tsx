/*
 * Discord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled } from "@api/PluginManager";
import { findComponentByCodeLazy } from "@webpack";
import { useEffect, useState } from "@webpack/common";

import { isUpdateAvailable, manualUpdate, subscribe } from ".";

const HeaderBarIcon = findComponentByCodeLazy(".HEADER_BAR_BADGE_BOTTOM,", 'position:"bottom"');

function Icon({ available }: { available: boolean; }) {
    return (
        <svg
            viewBox="0 0 24 24"
            width={18}
            height={18}
            aria-hidden="true"
            style={available ? { color: "var(--status-positive, #23a55a)" } : undefined}
        >
            <path
                fill="currentColor"
                d="M12 3a1 1 0 0 1 1 1v9.59l3.3-3.3a1 1 0 1 1 1.4 1.42l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.42l3.3 3.3V4a1 1 0 0 1 1-1ZM5 19a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1Z"
            />
            {available && <circle cx="19" cy="5" r="4" fill="var(--status-danger, #f23f43)" />}
        </svg>
    );
}

export function UpdateButton() {
    const [available, setAvailable] = useState(isUpdateAvailable());

    useEffect(() => {
        setAvailable(isUpdateAvailable());
        return subscribe(setAvailable);
    }, []);

    if (!isPluginEnabled("QuickUpdate")) return null;

    return (
        <HeaderBarIcon
            className="vc-quickupdate-btn"
            onClick={() => manualUpdate()}
            tooltip={available ? "Nouvelle version disponible, clique pour mettre à jour" : "Mettre à jour"}
            icon={() => <Icon available={available} />}
        />
    );
}
