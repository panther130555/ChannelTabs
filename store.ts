/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChannelStore, NavigationRouter, SelectedChannelStore, showToast, useEffect, useState } from "@webpack/common";

export interface Tab {
    id: string;
    channelId: string;
}

export interface LayoutState {
    tabs: Tab[];
    activeId: string;
    panes: string[]; // channelIds currently shown in the split grid (1..4); panes[focus] is the native one
    focus: number;
    colRatio: number; // 0..1 width share of the left column in the split grid
    rowRatio: number; // 0..1 height share of the top row in the split grid
}

const MAX_PANES = 4;

let state: LayoutState = { tabs: [], activeId: "", panes: [], focus: 0, colRatio: 0.5, rowRatio: 0.5 };
let initialized = false;
let selfNav = false; // true while we are the ones navigating, so CHANNEL_SELECT doesn't double-handle

const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const set = (next: Partial<LayoutState>) => { state = { ...state, ...next }; emit(); };

let tabSeq = 0;
const newId = () => `vc-tab-${Date.now()}-${tabSeq++}`;

export function getState() { return state; }

export function useLayout(): LayoutState {
    const [, force] = useState(0);
    useEffect(() => {
        const l = () => force(x => x + 1);
        listeners.add(l);
        return () => void listeners.delete(l);
    }, []);
    return state;
}

function navigate(channelId: string) {
    const ch = ChannelStore.getChannel(channelId);
    if (!ch) return;
    const path = ch.guild_id ? `/channels/${ch.guild_id}/${channelId}` : `/channels/@me/${channelId}`;
    selfNav = true;
    try { NavigationRouter.transitionTo(path); } finally { setTimeout(() => (selfNav = false), 0); }
}

/** Called once the first time our UI renders, seeding a single tab for whatever channel is open. */
export function ensureInit(channelId: string) {
    if (initialized || !channelId) return;
    initialized = true;
    const id = newId();
    state = { tabs: [{ id, channelId }], activeId: id, panes: [channelId], focus: 0, colRatio: 0.5, rowRatio: 0.5 };
    emit();
}

/**
 * User navigated through Discord itself (sidebar, search, etc.). Browser-style: every channel you
 * open becomes its own tab. If it's already a tab, just re-activate that one instead of duplicating.
 * The focused pane follows along so the split shows what you just opened.
 */
export function onExternalNavigate(channelId: string | null) {
    if (!channelId || !initialized) return;
    if (selfNav) return;

    const panes = state.panes.slice();
    panes[state.focus] = channelId;

    const existing = state.tabs.find(t => t.channelId === channelId);
    if (existing) {
        set({ activeId: existing.id, panes });
        return;
    }
    const id = newId();
    set({ tabs: [...state.tabs, { id, channelId }], activeId: id, panes });
}

export function selectTab(tabId: string) {
    const tab = state.tabs.find(t => t.id === tabId);
    if (!tab) return;
    const panes = state.panes.slice();
    panes[state.focus] = tab.channelId;
    set({ activeId: tabId, panes });
    navigate(tab.channelId);
}

export function newTab(channelId?: string) {
    const ch = channelId ?? state.panes[state.focus] ?? SelectedChannelStore.getChannelId();
    if (!ch) return;
    const id = newId();
    const panes = state.panes.slice();
    panes[state.focus] = ch;
    set({ tabs: [...state.tabs, { id, channelId: ch }], activeId: id, panes });
    navigate(ch);
}

export function closeTab(tabId: string) {
    if (state.tabs.length <= 1) return;
    const idx = state.tabs.findIndex(t => t.id === tabId);
    if (idx < 0) return;
    const tabs = state.tabs.filter(t => t.id !== tabId);
    let activeId = state.activeId;
    if (tabId === state.activeId) {
        const next = tabs[Math.min(idx, tabs.length - 1)];
        activeId = next.id;
        const panes = state.panes.slice();
        panes[state.focus] = next.channelId;
        set({ tabs, activeId, panes });
        navigate(next.channelId);
        return;
    }
    set({ tabs, activeId });
}

/** Dock a channel as an extra pane in the split grid. */
export function addPane(channelId: string) {
    // Seed the layout if the user hits "split" before our UI has initialized it.
    if (!initialized) {
        const current = SelectedChannelStore.getChannelId();
        if (current) ensureInit(current);
    }
    if (state.panes.length >= MAX_PANES) {
        showToast({ text: "ChannelTabs: already showing 4 panes (max)" });
        return;
    }
    if (state.panes.includes(channelId)) {
        showToast({ text: "ChannelTabs: that channel is already open in the split" });
        return;
    }
    set({ panes: [...state.panes, channelId] });
    showToast({ text: `ChannelTabs: split added (${state.panes.length} panes)` });
}

export function closePane(index: number) {
    if (state.panes.length <= 1) return;
    const panes = state.panes.filter((_, i) => i !== index);
    let focus = state.focus;
    if (index === focus) focus = 0;
    else if (index < focus) focus -= 1;
    focus = Math.max(0, Math.min(focus, panes.length - 1));
    set({ panes, focus });
    navigate(panes[focus]);
}

export function focusPane(index: number) {
    if (index === state.focus || index < 0 || index >= state.panes.length) return;
    const match = state.tabs.find(t => t.channelId === state.panes[index]);
    set({ focus: index, ...(match ? { activeId: match.id } : {}) });
    // Make the focused pane the real selected channel so Discord's member list, channel header
    // and read-state reflect what you're actually looking at. Panes are uniform, so this no
    // longer moves anything on screen.
    navigate(state.panes[index]);
}

/** Reorder the tab strip: drop the dragged tab at the target tab's position. */
export function moveTab(fromTabId: string, targetTabId: string) {
    const from = state.tabs.findIndex(t => t.id === fromTabId);
    const to = state.tabs.findIndex(t => t.id === targetTabId);
    if (from < 0 || to < 0 || from === to) return;
    const tabs = state.tabs.slice();
    const [moved] = tabs.splice(from, 1);
    tabs.splice(to, 0, moved);
    set({ tabs });
}

/** Set the split-grid divider positions (clamped so no pane collapses). */
export function setSplitRatios(next: { col?: number; row?: number; }) {
    const clamp = (n: number) => Math.max(0.15, Math.min(0.85, n));
    set({
        ...(next.col != null ? { colRatio: clamp(next.col) } : {}),
        ...(next.row != null ? { rowRatio: clamp(next.row) } : {})
    });
}
