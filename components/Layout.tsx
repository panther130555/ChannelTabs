/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { React, useRef, useState } from "@webpack/common";

import {
    addPane, closePane, closeTab, ensureInit, focusPane, moveTab, newTab, selectTab, setSplitRatios, useLayout
} from "../store";
import Pane, { channelLabel } from "./Pane";

const DND_TYPE = "application/x-vc-channeltab"; // carries the channelId (for docking into a split)
const TAB_DND = "application/x-vc-channeltab-id"; // carries the tab id (for reordering the strip)

function TabBar() {
    const { tabs, activeId, panes } = useLayout();

    return (
        <div style={{
            display: "flex", alignItems: "stretch", gap: 2, padding: "4px 6px 0",
            background: "var(--background-base-low, var(--background-secondary))",
            borderBottom: "1px solid var(--border-subtle, var(--background-modifier-accent))",
            overflowX: "auto", flexShrink: 0, height: 34
        }}>
            {tabs.map(tab => {
                const active = tab.id === activeId;
                const inSplit = panes.includes(tab.channelId);
                return (
                    <div
                        key={tab.id}
                        draggable
                        onDragStart={e => {
                            e.dataTransfer.setData(DND_TYPE, tab.channelId);
                            e.dataTransfer.setData(TAB_DND, tab.id);
                            e.dataTransfer.effectAllowed = "copyMove";
                        }}
                        onDragOver={e => { if (e.dataTransfer.types.includes(TAB_DND)) e.preventDefault(); }}
                        onDrop={e => {
                            const fromId = e.dataTransfer.getData(TAB_DND);
                            if (fromId && fromId !== tab.id) { e.preventDefault(); e.stopPropagation(); moveTab(fromId, tab.id); }
                        }}
                        onClick={() => selectTab(tab.id)}
                        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); addPane(tab.channelId); }}
                        onAuxClick={e => { if (e.button === 1) { e.preventDefault(); closeTab(tab.id); } }}
                        style={{
                            display: "flex", alignItems: "center", gap: 6, padding: "0 8px", maxWidth: 180,
                            borderRadius: "6px 6px 0 0", cursor: "grab", userSelect: "none", fontSize: 13,
                            color: active ? "var(--text-default, var(--header-primary))" : "var(--text-muted, var(--interactive-normal))",
                            background: active ? "var(--background-base-lower, var(--background-primary))" : "transparent",
                            borderBottom: inSplit && !active ? "2px solid var(--brand-500, var(--brand-experiment))" : "2px solid transparent"
                        }}
                        title={channelLabel(tab.channelId)}
                    >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {channelLabel(tab.channelId)}
                        </span>
                        {tabs.length > 1 && (
                            <span
                                onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
                                style={{ opacity: 0.6, padding: "0 2px", borderRadius: 4, lineHeight: 1 }}
                            >×</span>
                        )}
                    </div>
                );
            })}
            <div
                onClick={() => newTab()}
                title="New tab"
                style={{ display: "flex", alignItems: "center", padding: "0 10px", cursor: "pointer", fontSize: 18, opacity: 0.7, userSelect: "none" }}
            >+</div>
        </div>
    );
}

function gridStyle(count: number, colRatio: number, rowRatio: number, portrait: boolean): React.CSSProperties {
    const base: React.CSSProperties = { width: "100%", height: "100%", minHeight: 0, minWidth: 0, display: "grid", gap: 8, padding: 8, background: "var(--background-base-lowest, var(--background-tertiary))" };
    const cols = `${colRatio}fr ${1 - colRatio}fr`;
    const rows = `${rowRatio}fr ${1 - rowRatio}fr`;
    if (count <= 1) return { ...base, gridTemplateColumns: "1fr", gridTemplateRows: "1fr" };
    // Two panes: side-by-side on a wide screen, stacked top/bottom on a tall (portrait) one.
    if (count === 2) return portrait
        ? { ...base, gridTemplateColumns: "1fr", gridTemplateRows: rows }
        : { ...base, gridTemplateColumns: cols, gridTemplateRows: "1fr" };
    return { ...base, gridTemplateColumns: cols, gridTemplateRows: rows }; // 3 or 4 -> 2x2
}

function PaneFrame({ index, channelId, focused, orig }: {
    index: number; channelId: string; focused: boolean; orig: () => any;
}) {
    const span3 = index === 2 ? { gridColumn: "1 / span 2" } : undefined; // 3rd pane spans the bottom row
    return (
        <div
            // Only a LEFT press focuses the pane. A right press must not reflow the grid, or the
            // native context menu would open on whatever lands under the cursor after the swap.
            onMouseDownCapture={e => { if (!focused && e.button === 0) focusPane(index); }}
            style={{
                position: "relative", display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0,
                borderRadius: 8, overflow: "hidden",
                background: "var(--background-base-lower, var(--background-primary))",
                boxShadow: focused
                    ? "inset 0 0 0 2px var(--brand-500, var(--brand-experiment))"
                    : "inset 0 0 0 1px color-mix(in srgb, var(--border-subtle, #000) 50%, transparent)",
                ...(span3 || {})
            }}
        >
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 8px",
                fontSize: 12, fontWeight: 600, flexShrink: 0,
                color: focused ? "var(--text-default, var(--header-primary))" : "var(--text-muted, var(--channels-default))",
                background: "color-mix(in srgb, var(--background-base-low, #000) 72%, transparent)",
                backdropFilter: "blur(2px)"
            }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {channelLabel(channelId)}{focused ? " · active" : ""}
                </span>
                <span onClick={e => { e.stopPropagation(); closePane(index); }} style={{ cursor: "pointer", opacity: 0.6, padding: "0 4px" }}>×</span>
            </div>
            <div style={{ flex: "1 1 auto", minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
                {/* The FOCUSED pane is the real selected channel, so it renders 100% native Discord
                    (full composer with upload/GIF/sticker buttons, working message right-click menus,
                    etc). Only one native instance is ever mounted (the singleton constraint), and the
                    grid cell is sized by the resize ratios so swapping focus never shifts positions.
                    The other panes stay the lightweight custom view. Native falls back to custom if it
                    throws. */}
                {focused
                    ? (
                        <ErrorBoundary noop fallback={() => <Pane channelId={channelId} />}>
                            <div style={{ flex: "1 1 auto", minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
                                {orig()}
                            </div>
                        </ErrorBoundary>
                    )
                    : <Pane channelId={channelId} />}
            </div>
        </div>
    );
}

function SplitGrid({ orig }: { orig: () => any; }) {
    const { panes, focus, colRatio, rowRatio } = useLayout();
    const ref = useRef<HTMLDivElement>(null);
    const [portrait, setPortrait] = useState(false);
    const count = panes.length;

    // Track the pane area's aspect ratio so a 2-pane split can stack vertically on tall monitors.
    React.useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const update = () => setPortrait(el.clientHeight > el.clientWidth);
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const twoPortrait = count === 2 && portrait;
    const hasCol = count >= 2 && !twoPortrait; // a vertical divider exists whenever columns are side-by-side
    const hasRow = count >= 3 || twoPortrait; // a horizontal divider exists in the 2x2 or a stacked pair

    const startDrag = (axis: "col" | "row") => (e: React.PointerEvent) => {
        e.preventDefault();
        const move = (ev: PointerEvent) => {
            const rect = ref.current?.getBoundingClientRect();
            if (!rect) return;
            if (axis === "col") setSplitRatios({ col: (ev.clientX - rect.left) / rect.width });
            else setSplitRatios({ row: (ev.clientY - rect.top) / rect.height });
        };
        const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            document.body.style.cursor = "";
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        document.body.style.cursor = axis === "col" ? "col-resize" : "row-resize";
    };

    // The 3-pane layout has columns only in the top row (bottom pane spans full width),
    // so the vertical divider only covers that top row there.
    const colSpan = count === 3 ? rowRatio : 1;

    return (
        <div ref={ref} style={{ position: "relative", flex: "1 1 auto", minHeight: 0, minWidth: 0 }}>
            <div style={gridStyle(count, colRatio, rowRatio, portrait)}>
                {panes.map((channelId, i) => (
                    <PaneFrame key={channelId} index={i} channelId={channelId} focused={i === focus} orig={orig} />
                ))}
            </div>
            {hasCol && <div onPointerDown={startDrag("col")} style={{ position: "absolute", zIndex: 5, top: 0, height: `${colSpan * 100}%`, left: `${colRatio * 100}%`, width: 10, transform: "translateX(-50%)", cursor: "col-resize" }} />}
            {hasRow && <div onPointerDown={startDrag("row")} style={{ position: "absolute", zIndex: 5, left: 0, width: "100%", top: `${rowRatio * 100}%`, height: 10, transform: "translateY(-50%)", cursor: "row-resize" }} />}
        </div>
    );
}

function ChannelAreaInner({ channel, orig }: { channel: any; orig: () => any; }) {
    const { panes } = useLayout();
    const [dropHint, setDropHint] = useState(false);

    React.useEffect(() => { ensureInit(channel?.id); }, [channel?.id]);

    // Capture-phase handlers: the focused pane is native Discord, whose chat area has its own
    // file-upload dropzone that eats drag events before they bubble to us. Capture fires parent->child,
    // so we intercept the tab drag first and stop it from reaching the native handler underneath.
    const paneDragOver = (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes(DND_TYPE)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
        if (!dropHint) setDropHint(true);
    };
    const paneDrop = (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes(DND_TYPE)) return;
        e.preventDefault();
        e.stopPropagation();
        setDropHint(false);
        const channelId = e.dataTransfer.getData(DND_TYPE);
        if (channelId) addPane(channelId);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0, minWidth: 0, height: "100%" }}>
            <TabBar />
            <div
                style={{ position: "relative", flex: "1 1 auto", minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}
                onDragOverCapture={paneDragOver}
                onDropCapture={paneDrop}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropHint(false); }}
            >
                {panes.length <= 1
                    ? <div style={{ flex: "1 1 auto", minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>{orig()}</div>
                    : <SplitGrid orig={orig} />}
                {dropHint && panes.length < 4 && (
                    <div style={{
                        position: "absolute", inset: 0, pointerEvents: "none",
                        border: "3px dashed var(--brand-500, var(--brand-experiment))",
                        background: "color-mix(in srgb, var(--brand-500, #5865f2) 8%, transparent)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 16, fontWeight: 600, color: "var(--text-default, var(--header-primary))"
                    }}>
                        Drop to open in split
                    </div>
                )}
            </div>
        </div>
    );
}

const ChannelArea = ErrorBoundary.wrap(ChannelAreaInner, { noop: false });

/** Entry point called from the patched ChannelView.renderChat(). Falls back to native on any failure. */
export function renderChannelArea(channel: any, orig: () => any) {
    try {
        return <ChannelArea channel={channel} orig={orig} />;
    } catch {
        return orig();
    }
}
