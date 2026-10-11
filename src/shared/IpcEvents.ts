/*
 * Discord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
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

export const enum IpcEvents {
    INIT_FILE_WATCHERS = "DiscordInitFileWatchers",

    OPEN_QUICKCSS = "DiscordOpenQuickCss",
    GET_QUICK_CSS = "DiscordGetQuickCss",
    SET_QUICK_CSS = "DiscordSetQuickCss",
    QUICK_CSS_UPDATE = "DiscordQuickCssUpdate",

    GET_SETTINGS = "DiscordGetSettings",
    SET_SETTINGS = "DiscordSetSettings",

    GET_THEMES_LIST = "DiscordGetThemesList",
    GET_THEME_DATA = "DiscordGetThemeData",
    GET_THEME_SYSTEM_VALUES = "DiscordGetThemeSystemValues",
    THEME_UPDATE = "DiscordThemeUpdate",

    OPEN_EXTERNAL = "DiscordOpenExternal",
    OPEN_THEMES_FOLDER = "DiscordOpenThemesFolder",
    OPEN_SETTINGS_FOLDER = "DiscordOpenSettingsFolder",

    GET_UPDATES = "DiscordGetUpdates",
    GET_REPO = "DiscordGetRepo",
    UPDATE = "DiscordUpdate",
    BUILD = "DiscordBuild",

    OPEN_MONACO_EDITOR = "DiscordOpenMonacoEditor",
    GET_MONACO_THEME = "DiscordGetMonacoTheme",

    GET_PLUGIN_IPC_METHOD_MAP = "DiscordGetPluginIpcMethodMap",

    CSP_IS_DOMAIN_ALLOWED = "DiscordCspIsDomainAllowed",
    CSP_REMOVE_OVERRIDE = "DiscordCspRemoveOverride",
    CSP_REQUEST_ADD_OVERRIDE = "DiscordCspRequestAddOverride",

    GET_RENDERER_CSS = "DiscordGetRendererCss",
    RENDERER_CSS_UPDATE = "DiscordRendererCssUpdate",
    PRELOAD_GET_RENDERER_JS = "DiscordPreloadGetRendererJs",

    SUPPORTS_WINDOWS_MATERIAL = "DiscordSupportsWindowsMaterial",
}
