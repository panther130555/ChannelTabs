/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { sendMessage } from "@utils/discord";
import { findByPropsLazy, findComponentByCodeLazy } from "@webpack";
import { ChannelStore, MessageStore, Parser, useEffect, useRef, UserStore, useState, useStateFromStores } from "@webpack/common";

const ChannelMessage = findComponentByCodeLazy("childrenExecutedCommand:", ".hideAccessories");
const MessageFetcher = findByPropsLazy("fetchMessages");
const InputComponent = findComponentByCodeLazy("editorClassName", "CHANNEL_TEXT_AREA");
const ChatInputTypes = findByPropsLazy("FORM", "USER_PROFILE");

function loadMessages(channelId: string, before?: string) {
    try {
        MessageFetcher.fetchMessages({ channelId, limit: 50, ...(before ? { before } : {}) });
    } catch {
        try { MessageFetcher.fetchMessages(channelId); } catch { /* give up quietly */ }
    }
}

export function channelLabel(channelId: string): string {
    const ch = ChannelStore.getChannel(channelId);
    if (!ch) return "Unknown";
    if (ch.name) return ch.type === 0 ? "#" + ch.name : ch.name;
    const recip = ch.recipients?.[0];
    const user = recip && UserStore.getUser(recip);
    return user ? "@" + (user.globalName || user.username) : "Direct Message";
}

function authorName(m: any): string {
    return m.author?.globalName || m.author?.username || m.author?.id || "Unknown";
}

// Rich rows via Discord's own message component. If it throws (it leans on context we aren't in),
// the ErrorBoundary below swaps in SimpleMessages instead of crashing the whole pane.
function RichMessages({ channel, array }: { channel: any; array: any[]; }) {
    return (
        <>
            {array.map((m: any) => (
                <ChannelMessage
                    key={m.id}
                    id={`vc-channeltabs-${channel.id}-${m.id}`}
                    message={m}
                    channel={channel}
                    compact={false}
                    subscribeToComponentDispatch={false}
                />
            ))}
        </>
    );
}

// Dependency-free fallback: just author + parsed content. Always works.
function SimpleMessages({ array }: { array: any[]; }) {
    return (
        <div style={{ padding: "8px 12px" }}>
            {array.map((m: any) => (
                <div key={m.id} style={{ marginBottom: 8, lineHeight: 1.3 }}>
                    <span style={{ fontWeight: 600, color: "var(--text-default, var(--header-primary))", marginRight: 6 }}>
                        {authorName(m)}
                    </span>
                    <span style={{ color: "var(--text-default, var(--text-normal))", wordBreak: "break-word" }}>
                        {(() => { try { return Parser.parse(m.content ?? ""); } catch { return m.content ?? ""; } })()}
                    </span>
                </div>
            ))}
        </div>
    );
}

// Bare textarea — the guaranteed fallback if Discord's real editor won't mount for a side pane.
function SimpleComposer({ channelId }: { channelId: string; }) {
    const [value, setValue] = useState("");
    const label = channelLabel(channelId);

    const submit = () => {
        const content = value.trim();
        if (!content) return;
        setValue("");
        try { sendMessage(channelId, { content }); } catch { /* ignore send failure */ }
    };

    return (
        <textarea
            value={value}
            onChange={e => setValue(e.currentTarget.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder={`Message ${label}`}
            rows={1}
            style={{
                width: "100%", resize: "none", boxSizing: "border-box", padding: "10px 12px",
                borderRadius: 8, border: "none", outline: "none", fontSize: 14, fontFamily: "inherit",
                background: "var(--input-background, var(--channeltextarea-background))",
                color: "var(--text-default, var(--text-normal))", maxHeight: 120
            }}
        />
    );
}

// Discord's real chat editor (emoji/mention autocomplete, markdown, proper sending) pointed at
// this pane's channel. Needs the full prop set — notably textValue="" — or it reads `.length` on
// undefined and throws. The ErrorBoundary below swaps in SimpleComposer if it ever does.
function RealComposer({ channelId }: { channelId: string; }) {
    const channel = ChannelStore.getChannel(channelId);
    const editorRef = useRef<any>(null);
    if (!channel) return null;

    return (
        <div style={{ borderRadius: 8, overflow: "hidden", background: "var(--channeltextarea-background)" }}>
            <InputComponent
                channel={channel}
                type={ChatInputTypes?.FORM}
                textValue=""
                placeholder={`Message ${channelLabel(channelId)}`}
                setEditorRef={(ref: any) => { editorRef.current = ref; }}
                onSubmit={(res: any) => {
                    const content = (res?.value ?? "").trim();
                    if (content) { try { sendMessage(channelId, { content }); } catch { /* ignore */ } }
                    return { shouldClear: true, shouldRefocus: true };
                }}
            />
        </div>
    );
}

function Composer({ channelId }: { channelId: string; }) {
    return (
        <ErrorBoundary noop fallback={() => <SimpleComposer channelId={channelId} />}>
            <RealComposer channelId={channelId} />
        </ErrorBoundary>
    );
}

/** A fully independent, live view of one channel: messages + a simple composer. */
function PaneInner({ channelId }: { channelId: string; }) {
    const channel = ChannelStore.getChannel(channelId);
    const messages = useStateFromStores([MessageStore], () => MessageStore.getMessages(channelId));
    const scrollerRef = useRef<HTMLDivElement>(null);
    const array: any[] = messages?._array ?? [];
    const lastId = array.length ? array[array.length - 1].id : "";

    useEffect(() => {
        if (!messages?.ready && !messages?.loadingMore) loadMessages(channelId);
    }, [channelId, messages?.ready]);

    useEffect(() => {
        const el = scrollerRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [lastId]);

    if (!channel) return <div style={{ padding: 12, opacity: 0.6 }}>Channel unavailable</div>;

    const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        if (el.scrollTop < 120 && messages?.hasMoreBefore && !messages?.loadingMore && array.length)
            loadMessages(channelId, array[0].id);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", height: "100%", minHeight: 0, minWidth: 0 }}>
            <div
                ref={scrollerRef}
                onScroll={onScroll}
                style={{ flex: "1 1 auto", overflowY: "auto", overflowX: "hidden", minHeight: 0, paddingBottom: 8 }}
            >
                {array.length === 0
                    ? <div style={{ padding: 16, opacity: 0.6, fontSize: 14 }}>{messages?.ready ? "No messages yet." : "Loading messages…"}</div>
                    : (
                        <ErrorBoundary noop fallback={() => <SimpleMessages array={array} />}>
                            <RichMessages channel={channel} array={array} />
                        </ErrorBoundary>
                    )}
            </div>
            <div style={{ padding: "0 12px 12px", flexShrink: 0 }}>
                <Composer channelId={channelId} />
            </div>
        </div>
    );
}

export default ErrorBoundary.wrap(PaneInner, { noop: false });
