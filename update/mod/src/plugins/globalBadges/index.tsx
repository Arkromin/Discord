/*
 * Discord, a modification for Discord's desktop app
 * Copyright (c) 2024 Vendicated and contributors
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

import { addProfileBadge, BadgePosition, BadgeUserArgs, ProfileBadge, removeProfileBadge } from "@api/Badges";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { React, Tooltip } from "@webpack/common";
import type { JSX } from "react";

type CustomBadge = string | {
    name: string;
    badge: string;
    custom?: boolean;
};

interface BadgeCache {
    badges: {
        [mod: string]: CustomBadge[];
    };
    expires: number;
}

const API_URL = "https://api.domi-btnr.dev/clientmodbadges";

const cache = new Map<string, BadgeCache>();
const EXPIRES = 1000 * 60 * 15;

const settings = definePluginSettings({
    showPrefix: {
        type: OptionType.BOOLEAN,
        description: "Shows the Mod as Prefix",
        default: true
    },
    showCustom: {
        type: OptionType.BOOLEAN,
        description: "Show Custom Badges",
        default: true
    }
});

async function fetchBadges(id: string): Promise<BadgeCache["badges"] | undefined> {
    const cachedValue = cache.get(id);
    if (!cache.has(id) || (cachedValue && cachedValue.expires < Date.now())) {
        const resp = await fetch(`${API_URL}/users/${id}`);
        const body = await resp.json() as BadgeCache["badges"];
        cache.set(id, { badges: body, expires: Date.now() + EXPIRES });
        return body;
    } else if (cachedValue) {
        return cachedValue.badges;
    }
}

function BadgeComponent({ name, img }: { name: string, img: string; }) {
    return (
        <Tooltip text={name}>
            {(tooltipProps: any) => (
                <img
                    {...tooltipProps}
                    src={img}
                    style={{
                        width: "20px",
                        height: "20px",
                        transform: name.includes("Replugged") ? "scale(0.9)" : undefined
                    }}
                />
            )}
        </Tooltip>
    );
}

function GlobalBadges({ userId }: BadgeUserArgs) {
    const [badges, setBadges] = React.useState<BadgeCache["badges"] | undefined>({});
    React.useEffect(() => {
        fetchBadges(userId)
            .then(setBadges)
            .catch(() => setBadges({}));
    }, []);

    if (!badges || !Object.keys(badges).length) return null;
    const globalBadges: JSX.Element[] = [];

    Object.keys(badges).forEach(mod => {
        if (mod.toLowerCase() === "vencord") return;
        badges[mod].forEach(badge => {
            if (typeof badge === "string") {
                const fullNames = { hunter: "Bug Hunter", early: "Early User" };
                badge = {
                    name: fullNames[badge as string] ? fullNames[badge as string] : badge,
                    badge: `${API_URL}/badges/${mod}/${(badge as string).replace(mod, "").trim().split(" ")[0]}`
                };
            } else if (typeof badge === "object") badge.custom = true;
            if (!settings.store.showCustom && badge.custom) return;
            const cleanName = badge.name.replace(mod, "").trim();
            const prefix = settings.store.showPrefix ? mod : "";
            if (!badge.custom) badge.name = `${prefix} ${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}`;
            globalBadges.push(<BadgeComponent name={badge.name} img={badge.badge} />);
        });
    });

    return (
        <div
            className="vc-global-badges"
            style={{
                display: "flex",
                alignItems: "center"
            }}
        >
            {globalBadges}
        </div>
    );
}

const Badge: ProfileBadge = {
    id: "global_badges_profile_badge",
    component: GlobalBadges,
    position: BadgePosition.START
};

export default definePlugin({
    name: "GlobalBadges",
    description: "Adds global badges from other client mods",
    authors: [Devs.domi_btnr],
    settings,

    start: () => addProfileBadge(Badge),
    stop: () => removeProfileBadge(Badge)
});
