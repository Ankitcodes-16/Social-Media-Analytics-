"use client";

import { Eye, Heart, MessageCircle, Repeat2 } from "lucide-react";
import type { SocialPost } from "@/types";
import { formatCompact, formatDateTime, timeAgo } from "@/lib/format";
import { Badge, PlatformBadge, SentimentBadge } from "@/components/ui/Badge";
import { HighlightedText } from "@/components/ui/HighlightedText";

export function EngagementStats({ post }: { post: SocialPost }) {
  const e = post.engagement;
  const tg = post.platform === "telegram";
  const items = [
    { icon: Heart, value: e.likes, title: tg ? "Reactions" : "Likes" },
    { icon: MessageCircle, value: e.replies, title: tg ? "Comments" : "Replies" },
    { icon: Repeat2, value: e.shares, title: tg ? "Forwards" : "Reposts" },
    { icon: Eye, value: e.views, title: "Views" },
  ];
  return (
    <div className="flex items-center gap-3.5 text-xs text-fg-dim">
      {items.map(({ icon: Icon, value, title }) => (
        <span key={title} title={title} className="inline-flex items-center gap-1 tabular-nums">
          <Icon size={12} />
          {value !== undefined ? formatCompact(value) : "—"}
        </span>
      ))}
    </div>
  );
}

export function PostCard({
  post,
  query,
  selected = false,
  onSelect,
  showTopic = true,
}: {
  post: SocialPost;
  query?: string;
  selected?: boolean;
  onSelect?: (post: SocialPost) => void;
  showTopic?: boolean;
}) {
  const content = (
    <>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <PlatformBadge platform={post.platform} compact />
        <span className="max-w-[16rem] truncate text-[13px] font-medium text-fg">{post.authorName}</span>
        {post.community ? (
          <span className="flex items-center gap-1 text-xs text-fg-dim">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: post.community.color }} />
            {post.community.name}
          </span>
        ) : null}
        <span className="ml-auto text-xs text-fg-dim" title={formatDateTime(post.timestamp)}>
          {timeAgo(post.timestamp)}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-fg">
        <HighlightedText text={post.text} query={query} />
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <EngagementStats post={post} />
        <div className="flex items-center gap-1.5">
          {showTopic && post.topic ? <Badge>{post.topic.name}</Badge> : null}
          {post.sentiment ? <SentimentBadge sentiment={post.sentiment} score={post.sentimentScore} /> : null}
        </div>
      </div>
    </>
  );

  const base = "block w-full rounded-lg border p-3.5 text-left transition-colors";
  if (!onSelect) return <article className={`${base} border-line bg-ink-900`}>{content}</article>;
  return (
    <button
      type="button"
      onClick={() => onSelect(post)}
      aria-pressed={selected}
      className={`${base} ${selected ? "border-signal/50 bg-ink-850" : "border-line bg-ink-900 hover:border-line-strong"}`}
    >
      {content}
    </button>
  );
}
