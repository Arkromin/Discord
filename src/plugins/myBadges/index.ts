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

import { addProfileBadge, BadgePosition, BadgeUserArgs, ProfileBadge, removeProfileBadge } from "@api/Badges";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { UserStore } from "@webpack/common";

const ICON_URL = "https://cdn.discordapp.com/badge-icons/";

// Local, cosmetic only: these badges are drawn on YOUR OWN profile in YOUR client.
// Nobody else sees them, and Discord's servers are not told about them.
const BADGES: { id: string, description: string, icon: string, link?: string; }[] = [
    { id: "staff", description: "Discord Staff", icon: "5e74e9b61934fc1f67c65515d1f7e60d", link: "https://discord.com/company" },
    { id: "partner", description: "Partnered Server Owner", icon: "3f9748e53446a137a052f3454e2de41e", link: "https://discord.com/partners" },
    { id: "certified_moderator", description: "Moderator Programs Alumni", icon: "fee1624003e2fee35cb398e125dc479b", link: "https://discord.com/safety" },
    { id: "hypesquad", description: "HypeSquad Events", icon: "bf01d1073931f921909045f3a39fd264", link: "https://discord.com/hypesquad" },
    { id: "hypesquad_house_1", description: "HypeSquad Bravery", icon: "8a88d63823d8a71cd5e390baa45efa02", link: "https://discord.com/settings/hypesquad-online" },
    { id: "hypesquad_house_2", description: "HypeSquad Brilliance", icon: "011940fd013da3f7fb926e4a1cd2e618", link: "https://discord.com/settings/hypesquad-online" },
    { id: "hypesquad_house_3", description: "HypeSquad Balance", icon: "3aa41de486fa12454c3761e8e223442e", link: "https://discord.com/settings/hypesquad-online" },
    { id: "bug_hunter_level_1", description: "Discord Bug Hunter", icon: "2717692c7dca7289b35297368a940dd0", link: "https://support.discord.com/hc/en-us/articles/360046057772-Discord-Bugs" },
    { id: "bug_hunter_level_2", description: "Discord Bug Hunter (Gold)", icon: "848f79194d4be5ff5f81505cbd0ce1e6", link: "https://support.discord.com/hc/en-us/articles/360046057772-Discord-Bugs" },
    { id: "active_developer", description: "Active Developer", icon: "6bdc42827a38498929a4920da12695d9", link: "https://support-dev.discord.com/hc/en-us/articles/10113997751447" },
    { id: "verified_developer", description: "Early Verified Bot Developer", icon: "6df5892e0f35b051f8b61eace34f4967" },
    { id: "early_supporter", description: "Early Supporter", icon: "7060786766c9c840eb3019e725d2b358", link: "https://discord.com/settings/premium" },
    { id: "premium", description: "Subscriber", icon: "2ba85e8026a8614b640c2837bcdfe21b", link: "https://discord.com/settings/premium" }
];

interface CatalogTier {
    key: string;
    name: string;
    owned: boolean;
    simple_icon_url: string;
    complex_icon_static_url: string;
    requirements: never[];
}

interface CatalogBadge {
    badge_id: string;
    name: string;
    description: string;
    owned: boolean;
    current_tier: string;
    next_tier: null;
    simple_icon_url: string;
    tiers: CatalogTier[];
}

interface CatalogBadges {
    earnable: unknown[];
    owned: unknown[];
}

// Same cosmetic badges, shaped like the badge objects used by Discord's "Your badges" panel
const CATALOG_BADGES: CatalogBadge[] = BADGES.map(b => {
    const icon = `${ICON_URL}${b.icon}.png`;
    return {
        badge_id: `my_badges_${b.id}`,
        name: b.description,
        description: b.description,
        owned: true,
        current_tier: "default",
        next_tier: null,
        simple_icon_url: icon,
        tiers: [{
            key: "default",
            name: b.description,
            owned: true,
            simple_icon_url: icon,
            complex_icon_static_url: icon,
            requirements: []
        }]
    };
});

const Badge: ProfileBadge = {
    id: "my_badges_profile_badge",
    position: BadgePosition.START,
    shouldShow: ({ userId }: BadgeUserArgs) => userId === UserStore.getCurrentUser()?.id,
    getBadges: () => BADGES.map(b => ({
        id: `my_badges_${b.id}`,
        description: b.description,
        iconSrc: `${ICON_URL}${b.icon}.png`,
        link: b.link
    }))
};

export default definePlugin({
    name: "MyBadges",
    description: "Shows the Discord profile badges on your own profile and in your \"Your badges\" panel (visible only to you, cosmetic)",
    authors: [Devs.Arkromin],
    enabledByDefault: true,

    patches: [
        {
            // Discord's "Your badges" panel: add our badges to the list of owned badges (own panel only)
            find: '"BadgeDirectoryPanel"',
            replacement: {
                match: /(displayedUserId:(\i),.{0,400}?\{earnable:\i,owned:\i\}=\i\.useMemo\(\(\)=>)(\(0,\i\.\i\)\(\i\))/,
                replace: "$1$self.addCatalogBadges($3,$2)"
            }
        }
    ],

    addCatalogBadges(result: CatalogBadges, userId?: string): CatalogBadges {
        try {
            if (!userId || userId !== UserStore.getCurrentUser()?.id) return result;

            const known = new Set(result.owned.map((b: any) => b?.badge_id));
            const extra = CATALOG_BADGES.filter(b => !known.has(b.badge_id));
            return { ...result, owned: [...result.owned, ...extra] };
        } catch {
            return result;
        }
    },

    start: () => addProfileBadge(Badge),
    stop: () => removeProfileBadge(Badge)
});
