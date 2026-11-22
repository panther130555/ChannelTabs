/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import definePlugin from "@utils/types";
import { Menu } from "@webpack/common";

import { renderChannelArea } from "./components/Layout";
import { addPane, newTab, onExternalNavigate } from "./store";

// Right-click a channel / DM / thread -> dock it as an extra pane in the split grid.
const splitContextMenu: NavContextMenuPatchCallback = (children, props: { channel?: { id: string; }; }) => {
    const channel = props?.channel;
    if (!channel?.id) return;
    children.push(
        <Menu.MenuItem id="vc-channeltabs" label="ChannelTabs">
            <Menu.MenuItem id="vc-channeltabs-split" label="Open in split view" action={() => addPane(channel.id)} />
            <Menu.MenuItem id="vc-channeltabs-newtab" label="Open in new tab" action={() => newTab(channel.id)} />
        </Menu.MenuItem>
    );
};

export default definePlugin({
    name: "ChannelTabs",
    description: "Browser-style tabs for channels/DMs, plus a split grid (up to 4 channels live at once). Right-click a channel → Open in split view.",
    authors: [{ name: "opanther", id: 990361883775225926n }],

    // Hijack ChannelView.renderChat(): wrap the native chat with our tab bar + split grid.
    // The original body is preserved as __vcOrigRenderChat so the focused pane stays 100% native Discord.
    patches: [
        {
            find: "Missing channel in Channel.renderHeaderToolbar",
            replacement: {
                match: /renderChat\(\)\{/,
                replace: "renderChat(){return $self.renderChannelArea(this.props.channel,()=>this.__vcOrigRenderChat());}__vcOrigRenderChat(){"
            }
        }
    ],

    contextMenus: {
        "channel-context": splitContextMenu,
        "thread-context": splitContextMenu,
        "gdm-context": splitContextMenu
    },

    flux: {
        CHANNEL_SELECT: ({ channelId }: { channelId: string | null; }) => onExternalNavigate(channelId)
    },

    renderChannelArea
});
