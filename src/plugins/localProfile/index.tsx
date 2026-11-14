/*
 * Discord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get } from "@api/DataStore";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { findStoreLazy } from "@webpack";
import { FluxDispatcher, IconUtils, UserStore } from "@webpack/common";

import { AVATAR_KEY, BANNER_KEY, onFilesChange, onSettingsChange, settings, StoredFile } from "./settings";

const logger = new Logger("LocalProfile");

const ProfileStore: any = findStoreLazy("UserProfileStore");

const EVENTS = ["CONNECTION_OPEN", "CURRENT_USER_UPDATE", "USER_UPDATE"];
const FAKE_BANNER = "vc_local_banner";
const MARK = "vc-local-banner";
const BANNER_SELECTOR = `[style*="${MARK}"], img[src*="${MARK}"]`;
// 1x1 transparent GIF. The mark lets us find the banner element to put a video in it.
const PLACEHOLDER = `data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7#${MARK}`;

interface Media {
    url: string;
    video: boolean;
}

const originals: { avatar?: any; profile?: any; profileHadOwn?: boolean; } = {};
const wrappers: { avatar?: any; profile?: any; } = {};

let active = false;
let lastUser: any;
let realBanner: any;
let realStyles: any;
let avatar: Media | null = null;
let banner: Media | null = null;
let loadToken = 0;
let observer: MutationObserver | undefined;
let scanTimer: ReturnType<typeof setTimeout> | undefined;
let unsubscribeSettings: (() => void) | undefined;
let unsubscribeFiles: (() => void) | undefined;

// Un seul profil enveloppé par version des réglages, pour ne pas recréer un objet à chaque appel
let profileCache = new WeakMap<object, any>();

const me = (): any => UserStore.getCurrentUser();
const clean = (value: string) => (value ?? "").trim();

function hexToInt(value: string): number | null {
    const hex = clean(value).replace(/^#/, "");
    return /^[0-9a-f]{6}$/i.test(hex) ? parseInt(hex, 16) : null;
}

function themeColors(): [number, number] | null {
    const primary = hexToInt(settings.store.themePrimary);
    const accent = hexToInt(settings.store.themeAccent);

    if (primary === null && accent === null) return null;
    return [primary ?? accent!, accent ?? primary!];
}

function nameStyle() {
    if (!settings.store.nameStyleEnabled) return null;

    const colors = clean(settings.store.nameColors)
        .split(",")
        .map(hexToInt)
        .filter((c): c is number => c !== null);

    return {
        fontId: settings.store.nameFont,
        effectId: settings.store.nameEffect,
        colors
    };
}

// ----- Files -----

function freeMedia(media: Media | null) {
    if (media) URL.revokeObjectURL(media.url);
}

async function loadMedia(key: string): Promise<Media | null> {
    const file = await get<StoredFile>(key);
    if (!file?.blob) return null;

    return { url: URL.createObjectURL(file.blob), video: file.type.startsWith("video/") };
}

async function loadFiles() {
    const token = ++loadToken;
    const [newAvatar, newBanner] = await Promise.all([loadMedia(AVATAR_KEY), loadMedia(BANNER_KEY)]);

    if (token !== loadToken || !active) {
        freeMedia(newAvatar);
        freeMedia(newBanner);
        return;
    }

    freeMedia(avatar);
    freeMedia(banner);
    avatar = newAvatar;
    banner = newBanner;

    updateObserver();
    apply();
}

// ----- Banner video -----

function attachVideo(el: Element, url: string) {
    if (el.hasAttribute("data-vc-video")) return;
    el.setAttribute("data-vc-video", "1");

    const video = document.createElement("video");
    video.setAttribute("data-vc-banner-video", "1");
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;pointer-events:none;";

    const host = el instanceof HTMLImageElement ? el.parentElement : el;
    if (!host) return;

    if (getComputedStyle(host).position === "static") (host as HTMLElement).style.position = "relative";
    (host as HTMLElement).style.overflow = "hidden";

    if (el instanceof HTMLImageElement) el.insertAdjacentElement("afterend", video);
    else el.appendChild(video);

    video.src = url;
    video.play().catch(e => logger.error("Banner video failed", e));
}

function scanBanners() {
    scanTimer = undefined;
    if (!active || !banner?.video) return;

    document.querySelectorAll(BANNER_SELECTOR).forEach(el => attachVideo(el, banner!.url));
}

function scheduleScan() {
    if (scanTimer === undefined) scanTimer = setTimeout(scanBanners, 150);
}

function clearVideos() {
    document.querySelectorAll("video[data-vc-banner-video]").forEach(v => v.remove());
    document.querySelectorAll("[data-vc-video]").forEach(el => el.removeAttribute("data-vc-video"));
}

// L'observateur ne tourne que si la bannière est une vidéo, et il ne regarde que les éléments ajoutés
function updateObserver() {
    const needed = active && !!banner?.video;

    if (!needed) {
        observer?.disconnect();
        observer = undefined;
        return;
    }

    if (observer) return;

    observer = new MutationObserver(records => {
        for (const record of records) {
            for (const node of record.addedNodes) {
                if (node instanceof Element && (node.matches(BANNER_SELECTOR) || node.querySelector(BANNER_SELECTOR))) {
                    scheduleScan();
                    return;
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

// ----- Apply -----

function apply() {
    const user = me();
    if (!active || !user) return;

    profileCache = new WeakMap();

    // Discord can replace the user object, in that case what we saved belongs to the old one
    if (user !== lastUser) {
        lastUser = user;
        realBanner = undefined;
        realStyles = undefined;
    }

    if (banner) {
        if (realBanner === undefined) realBanner = user.banner ?? null;
        user.banner = FAKE_BANNER;
    } else if (realBanner !== undefined) {
        user.banner = realBanner;
        realBanner = undefined;
    }

    const style = nameStyle();
    if (style) {
        if (realStyles === undefined) realStyles = user.displayNameStyles ?? null;
        user.displayNameStyles = style;
    } else if (realStyles !== undefined) {
        user.displayNameStyles = realStyles;
        realStyles = undefined;
    }

    clearVideos();
    UserStore.emitChange();
    ProfileStore.emitChange();
    scheduleScan();
}

const onUserEvent = (event: any) => {
    // USER_UPDATE is sent for every user, only our own account matters here
    if (event?.type === "USER_UPDATE" && event.user?.id !== me()?.id) return;
    setTimeout(apply, 0);
};

function restore() {
    const user = me();

    if (user && user === lastUser) {
        if (realBanner !== undefined) user.banner = realBanner;
        if (realStyles !== undefined) user.displayNameStyles = realStyles;
    }

    realBanner = undefined;
    realStyles = undefined;
    lastUser = undefined;
}

export default definePlugin({
    name: "LocalProfile",
    description: "Client-side only: use an animated avatar, a banner (image, GIF or video from a file on your computer), a profile theme and a display name style on your own account. Only you can see them.",
    tags: ["Appearance"],
    authors: [Devs.Arkromin],
    settings,

    patches: [
        {
            // The profile card builds the banner address without going through IconUtils, so the function itself is patched
            find: ".USER_BANNER(",
            replacement: {
                match: /(function \i\((\i)\)\{let \i,\{id:(\i),banner:(\i),canAnimate:\i,size:\i\}=\2;)/,
                replace: "$1const _vcb=$self.bannerOverride($3,$4);if(_vcb!==void 0)return _vcb;"
            }
        }
    ],

    bannerOverride(id: string, bannerHash: string) {
        if (active && banner && id != null && id === me()?.id && bannerHash === FAKE_BANNER) {
            return banner.video ? PLACEHOLDER : banner.url;
        }

        return undefined;
    },

    start() {
        active = true;

        originals.avatar = (IconUtils as any).getUserAvatarURL;

        wrappers.avatar = function (this: any, user: any, ...rest: any[]) {
            if (active && avatar && user?.id != null && user.id === me()?.id) return avatar.url;
            return originals.avatar.call(this, user, ...rest);
        };

        (IconUtils as any).getUserAvatarURL = wrappers.avatar;

        originals.profileHadOwn = Object.prototype.hasOwnProperty.call(ProfileStore, "getUserProfile");
        originals.profile = ProfileStore.getUserProfile;
        const previous = originals.profile.bind(ProfileStore);

        wrappers.profile = function (id: string, ...args: any[]) {
            const profile = previous(id, ...args);
            if (!active || !profile || id !== me()?.id) return profile;

            const colors = themeColors();
            const hasBanner = !!banner;
            if (!colors && !hasBanner) return profile;

            let wrapped = profileCache.get(profile);
            if (!wrapped) {
                wrapped = new Proxy(profile, {
                    get(target, key) {
                        if (colors && key === "themeColors") return colors;
                        if (colors && key === "premiumType") return 2;
                        if (hasBanner && key === "banner") return FAKE_BANNER;
                        return Reflect.get(target, key, target);
                    }
                });
                profileCache.set(profile, wrapped);
            }

            return wrapped;
        };

        ProfileStore.getUserProfile = wrappers.profile;

        for (const event of EVENTS) FluxDispatcher.subscribe(event, onUserEvent);
        unsubscribeSettings = onSettingsChange(apply);
        unsubscribeFiles = onFilesChange(loadFiles);

        loadFiles();
        logger.info("Started");
    },

    stop() {
        active = false;
        loadToken++;

        for (const event of EVENTS) FluxDispatcher.unsubscribe(event, onUserEvent);
        unsubscribeSettings?.();
        unsubscribeSettings = undefined;
        unsubscribeFiles?.();
        unsubscribeFiles = undefined;

        observer?.disconnect();
        observer = undefined;
        clearTimeout(scanTimer);
        scanTimer = undefined;

        // Only undo what is still ours, other plugins may have wrapped these functions after us.
        // The wrappers do nothing once the plugin is stopped.
        if ((IconUtils as any).getUserAvatarURL === wrappers.avatar) (IconUtils as any).getUserAvatarURL = originals.avatar;

        if (ProfileStore.getUserProfile === wrappers.profile) {
            if (originals.profileHadOwn) ProfileStore.getUserProfile = originals.profile;
            else delete ProfileStore.getUserProfile;
        }

        restore();
        clearVideos();

        freeMedia(avatar);
        freeMedia(banner);
        avatar = null;
        banner = null;

        UserStore.emitChange();
        ProfileStore.emitChange();
    }
});
