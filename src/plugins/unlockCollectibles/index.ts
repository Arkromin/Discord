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

import * as DataStore from "@api/DataStore";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { findStoreLazy } from "@webpack";
import { FluxDispatcher, RestAPI, UserStore } from "@webpack/common";

const logger = new Logger("UnlockCollectibles");

const PurchaseStore: any = findStoreLazy("CollectiblesPurchaseStore");
const CatalogStore: any = findStoreLazy("CollectiblesCategoryStore");
const ProfileStore: any = findStoreLazy("UserProfileStore");

const DATA_KEY = "UnlockCollectibles_overrides";
const EVENTS = ["CONNECTION_OPEN", "CURRENT_USER_UPDATE", "USER_UPDATE"];

const TYPE_EFFECT = 1;
const TYPE_FRAME = 3;

interface Overrides {
    deco?: { skuId: string; asset: string; };
    np?: { skuId: string; label: string; palette: string; asset: string; };
    effect?: string;
    frame?: string;
}

let overrides: Overrides = {};
let realDeco: any;
let realNameplate: any;
const originals: { getPurchase?: any; getUserProfile?: any; patch?: any; } = {};

const me = (): any => UserStore.getCurrentUser();
const isOwned = (id: string) => originals.getPurchase(id);
const getItem = (id: string) => CatalogStore.getProduct(id)?.items?.[0];
const save = () => DataStore.set(DATA_KEY, overrides);

function show() {
    const user = me();
    if (!user) return;

    if (overrides.deco) {
        if (realDeco === undefined) realDeco = user.avatarDecoration ?? null;
        user.avatarDecoration = { skuId: overrides.deco.skuId, asset: overrides.deco.asset };
    }
    if (overrides.np) {
        if (realNameplate === undefined) realNameplate = user.collectibles?.nameplate ?? null;
        user.collectibles = { ...(user.collectibles ?? {}), nameplate: { ...overrides.np } };
    }

    UserStore.emitChange();
    ProfileStore.emitChange();
}

const later = (value: any) => {
    setTimeout(show, 300);
    return value;
};

const onUserEvent = () => {
    setTimeout(show, 0);
};

function addFakePurchase(id: string) {
    try {
        PurchaseStore.purchases.set(id, CatalogStore.getProduct(id));
    } catch {
        // the purchases list may not be loaded yet
    }
}

function interceptPatch(this: any, data: any, ...rest: any[]) {
    try {
        const body = data?.body;
        const url = String(data?.url ?? "");

        if (body && /\/users\/(@|%40)me$/.test(url)) {
            if ("avatar_decoration_sku_id" in body) {
                const id = body.avatar_decoration_sku_id;
                const item = id ? getItem(id) : undefined;
                if (id && item && !isOwned(id)) {
                    if (realDeco === undefined) realDeco = me()?.avatarDecoration ?? null;
                    overrides.deco = { skuId: id, asset: item.asset };
                    save();
                    return originals.patch.call(this, { ...data, body: { avatar_decoration_sku_id: realDeco?.skuId ?? null } }, ...rest).then(later);
                }
                if (overrides.deco) {
                    delete overrides.deco;
                    realDeco = undefined;
                    save();
                }
            }

            if ("nameplate_sku_id" in body) {
                const id = body.nameplate_sku_id;
                const item = id ? getItem(id) : undefined;
                if (id && item && !isOwned(id)) {
                    if (realNameplate === undefined) realNameplate = me()?.collectibles?.nameplate ?? null;
                    overrides.np = { skuId: id, label: item.label, palette: item.palette, asset: item.asset };
                    save();
                    return originals.patch.call(this, { ...data, body: { nameplate_sku_id: realNameplate?.skuId ?? null } }, ...rest).then(later);
                }
                if (overrides.np) {
                    delete overrides.np;
                    realNameplate = undefined;
                    save();
                }
            }
        }

        if (body && /\/users\/(@|%40)me\/profile$/.test(url) && body.collectibles_sku_ids) {
            const ids: string[] = body.collectibles_sku_ids;
            const fake = ids.filter(id => !isOwned(id));

            delete overrides.effect;
            delete overrides.frame;
            for (const id of fake) {
                const item = getItem(id);
                if (item?.type === TYPE_EFFECT) overrides.effect = id;
                else if (item?.type === TYPE_FRAME || item?.layers) overrides.frame = id;
                addFakePurchase(id);
            }
            save();
            PurchaseStore.emitChange();

            if (fake.length) {
                return originals.patch.call(this, { ...data, body: { ...body, collectibles_sku_ids: ids.filter(id => isOwned(id)) } }, ...rest).then(later);
            }
        }
    } catch (e) {
        logger.error("Failed to intercept request", e);
    }

    return originals.patch.call(this, data, ...rest);
}

export default definePlugin({
    name: "UnlockCollectibles",
    description: "Lets you equip any avatar decoration, profile effect, profile frame or nameplate from the shop. Client-side only: only you can see them.",
    tags: ["Appearance"],
    authors: [Devs.Arkromin],

    async start() {
        overrides = (await DataStore.get<Overrides>(DATA_KEY)) ?? {};
        realDeco = undefined;
        realNameplate = undefined;

        originals.getPurchase = PurchaseStore.getPurchase.bind(PurchaseStore);
        originals.getUserProfile = ProfileStore.getUserProfile.bind(ProfileStore);
        originals.patch = (RestAPI as any).patch;

        PurchaseStore.getPurchase = (id: string) => originals.getPurchase(id) ?? CatalogStore.getProduct(id) ?? null;

        ProfileStore.getUserProfile = function (id: string, ...args: any[]) {
            const profile = originals.getUserProfile(id, ...args);
            if (!profile || id !== me()?.id || !(overrides.effect || overrides.frame)) return profile;

            return new Proxy(profile, {
                get(target, key) {
                    if (key === "profileEffect" && overrides.effect) {
                        return { skuId: overrides.effect, expiresAt: undefined };
                    }
                    if (key === "profileFrame" && overrides.frame) {
                        return { skuId: overrides.frame, type: TYPE_FRAME };
                    }
                    if (key === "collectibles") {
                        const list = (target.collectibles ?? []).filter((x: any) =>
                            !(overrides.effect && x.type === TYPE_EFFECT) && !(overrides.frame && x.type === TYPE_FRAME));
                        if (overrides.effect) list.push({ skuId: overrides.effect, type: TYPE_EFFECT });
                        if (overrides.frame) list.push({ skuId: overrides.frame, type: TYPE_FRAME });
                        return list;
                    }
                    return Reflect.get(target, key, target);
                }
            });
        };

        (RestAPI as any).patch = interceptPatch;

        for (const event of EVENTS) FluxDispatcher.subscribe(event, onUserEvent);

        for (const id of [overrides.effect, overrides.frame]) {
            if (id) addFakePurchase(id);
        }

        PurchaseStore.emitChange();
        show();
    },

    stop() {
        for (const event of EVENTS) FluxDispatcher.unsubscribe(event, onUserEvent);

        delete PurchaseStore.getPurchase;
        delete ProfileStore.getUserProfile;
        (RestAPI as any).patch = originals.patch;

        PurchaseStore.emitChange();
        ProfileStore.emitChange();
    }
});
