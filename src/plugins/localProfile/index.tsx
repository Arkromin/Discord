/*
 * Discord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { findStoreLazy } from "@webpack";
import { FluxDispatcher, IconUtils, UserStore } from "@webpack/common";

import { onSettingsChange, settings } from "./settings";

const logger = new Logger("LocalProfile");

const ProfileStore: any = findStoreLazy("UserProfileStore");

const EVENTS = ["CONNECTION_OPEN", "CURRENT_USER_UPDATE", "USER_UPDATE"];
const FAKE_BANNER = "vc_local_banner";
const MARK = "vc-local-banner";
// 1x1 transparent GIF. The mark lets us find the banner element to put a video in it.
const PLACEHOLDER = `data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7#${MARK}`;

const originals: { avatar?: any; banner?: any; profile?: any; profileHadOwn?: boolean; } = {};
const wrappers: { avatar?: any; banner?: any; profile?: any; } = {};

let active = false;
let lastUser: any;
let realBanner: any;
let realStyles: any;
let observer: MutationObserver | undefined;
let scanTimer: ReturnType<typeof setTimeout> | undefined;
let unsubscribeSettings: (() => void) | undefined;

const me = (): any => UserStore.getCurrentUser();
const clean = (value: string) => (value ?? "").trim();
const isVideo = (url: string) => /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);

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

// ----- Banner video -----

function attachVideo(el: Element, url: string) {
    if (el.hasAttribute("data-vc-video")) return;
    el.setAttribute("data-vc-video", "1");

    const video = document.createElement("video");
    video.setAttribute("data-vc-banner-video", "1");
    video.src = url;
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

    video.play().catch(() => { });
}

function scanBanners() {
    scanTimer = undefined;

    const url = clean(settings.store.bannerUrl);
    if (!active || !url || !isVideo(url)) return;

    document.querySelectorAll(`[style*="${MARK}"], img[src*="${MARK}"]`).forEach(el => attachVideo(el, url));
}

function scheduleScan() {
    if (scanTimer === undefined) scanTimer = setTimeout(scanBanners, 250);
}

function clearVideos() {
    document.querySelectorAll("video[data-vc-banner-video]").forEach(v => v.remove());
    document.querySelectorAll("[data-vc-video]").forEach(el => el.removeAttribute("data-vc-video"));
}

// ----- Apply -----

function apply() {
    const user = me();
    if (!active || !user) return;

    // Discord can replace the user object, in that case what we saved belongs to the old one
    if (user !== lastUser) {
        lastUser = user;
        realBanner = undefined;
        realStyles = undefined;
    }

    if (clean(settings.store.bannerUrl)) {
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
    description: "Client-side only: use an animated avatar, a banner (image, GIF or video), a profile theme and a display name style on your own account. Only you can see them.",
    tags: ["Appearance"],
    authors: [Devs.Arkromin],
    settings,

    start() {
        active = true;

        originals.avatar = (IconUtils as any).getUserAvatarURL;
        originals.banner = (IconUtils as any).getUserBannerURL;

        wrappers.avatar = function (this: any, user: any, ...rest: any[]) {
            const url = clean(settings.store.avatarUrl);
            if (active && url && user?.id != null && user.id === me()?.id) return url;
            return originals.avatar.call(this, user, ...rest);
        };

        wrappers.banner = function (this: any, data: any, ...rest: any[]) {
            const url = clean(settings.store.bannerUrl);
            if (active && url && data?.id != null && data.id === me()?.id && data.banner === FAKE_BANNER) {
                return isVideo(url) ? PLACEHOLDER : url;
            }
            return originals.banner.call(this, data, ...rest);
        };

        (IconUtils as any).getUserAvatarURL = wrappers.avatar;
        (IconUtils as any).getUserBannerURL = wrappers.banner;

        originals.profileHadOwn = Object.prototype.hasOwnProperty.call(ProfileStore, "getUserProfile");
        originals.profile = ProfileStore.getUserProfile;
        const previous = originals.profile.bind(ProfileStore);

        wrappers.profile = function (id: string, ...args: any[]) {
            const profile = previous(id, ...args);
            if (!active || !profile || id !== me()?.id) return profile;

            const colors = themeColors();
            const hasBanner = !!clean(settings.store.bannerUrl);
            if (!colors && !hasBanner) return profile;

            return new Proxy(profile, {
                get(target, key) {
                    if (colors && key === "themeColors") return colors;
                    if (colors && key === "premiumType") return 2;
                    if (hasBanner && key === "banner") return FAKE_BANNER;
                    return Reflect.get(target, key, target);
                }
            });
        };

        ProfileStore.getUserProfile = wrappers.profile;

        for (const event of EVENTS) FluxDispatcher.subscribe(event, onUserEvent);
        unsubscribeSettings = onSettingsChange(apply);

        observer = new MutationObserver(scheduleScan);
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "src"] });

        apply();
        logger.info("Started");
    },

    stop() {
        active = false;

        for (const event of EVENTS) FluxDispatcher.unsubscribe(event, onUserEvent);
        unsubscribeSettings?.();
        unsubscribeSettings = undefined;

        observer?.disconnect();
        observer = undefined;
        clearTimeout(scanTimer);
        scanTimer = undefined;

        // Only undo what is still ours, other plugins may have wrapped these functions after us.
        // The wrappers do nothing once the plugin is stopped.
        if ((IconUtils as any).getUserAvatarURL === wrappers.avatar) (IconUtils as any).getUserAvatarURL = originals.avatar;
        if ((IconUtils as any).getUserBannerURL === wrappers.banner) (IconUtils as any).getUserBannerURL = originals.banner;

        if (ProfileStore.getUserProfile === wrappers.profile) {
            if (originals.profileHadOwn) ProfileStore.getUserProfile = originals.profile;
            else delete ProfileStore.getUserProfile;
        }

        restore();
        clearVideos();

        UserStore.emitChange();
        ProfileStore.emitChange();
    }
});
