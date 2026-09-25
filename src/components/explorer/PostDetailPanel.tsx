"use client";

import { Eye, Heart, MessageCircle, Network, Repeat2, X } from "lucide-react";
import type { SocialPost } from "@/types";
import { formatDateTime, formatNumber, timeAgo } from "@/lib/format";
import { ImplementationBadge, PlatformBadge, SentimentBadge } from "@/components/ui/Badge";
import { HighlightedText } from "@/components/ui/HighlightedText";
import { LinkButton } from "@/components/ui/Controls";

function Stat({ icon: Icon, label, value }: { icon: typeof Heart; label: string; value?: number }) {
  return (
    <div className="rounded-md border border-line bg-ink-850/60 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-fg-dim">
        <Icon size={11} />
        {label}
      </div>
      <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-fg">{value !== undefined ? formatNumber(value) : "—"}</div>
    </div>
  );
}

export function PostDetailPanel({
  post,
  query,
  onClose,
  onFilterHashtag,
  onFilterTopic,
}: {
  post: SocialPost;
  query?: string;
  onClose: () => void;
  onFilterHashtag: (tag: string) => void;
  onFilterTopic: (topicId: string) => void;
}) {
  const tg = post.platform === "telegram";
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <PlatformBadge platform={post.platform} />
            {post.sentiment ? <SentimentBadge sentiment={post.sentiment} score={post.sentimentScore} /> : null}
          </div>
          <div className="mt-2 break-words text-[15px] font-semibold text-fg">{post.authorName}</div>
          <div className="mt-0.5 text-xs text-fg-dim">
            {formatDateTime(post.timestamp)} · {timeAgo(post.timestamp)}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close post details" className="rounded p-1 text-fg-dim hover:bg-ink-800 hover:text-fg">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-fg">
          <HighlightedText text={post.text} query={query} />
        </p>

        <div className="grid grid-cols-2 gap-2">
          <Stat icon={Heart} label={tg ? "Reactions" : "Likes"} value={post.engagement.likes} />
          <Stat icon={MessageCircle} label={tg ? "Comments" : "Replies"} value={post.engagement.replies} />
          <Stat icon={Repeat2} label={tg ? "Forwards" : "Reposts"} value={post.engagement.shares} />
          <Stat icon={Eye} label="Views" value={post.engagement.views} />
        </div>

        {post.hashtags.length > 0 ? (
          <div>
            <div className="eyebrow mb-1.5">Hashtags</div>
            <div className="flex flex-wrap gap-1.5">
              {post.hashtags.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => onFilterHashtag(h)}
                  className="rounded bg-ink-800 px-1.5 py-0.5 text-[11px] text-signal hover:bg-ink-700"
                  title="Search for this hashtag"
                >
                  #{h}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <dl className="space-y-2 border-t border-line pt-3 text-xs">
          {post.topic ? (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-fg-dim">Topic</dt>
              <dd>
                <button type="button" onClick={() => onFilterTopic(post.topic!.id)} className="text-fg hover:text-signal" title="Filter by this topic">
                  {post.topic.name}
                </button>
              </dd>
            </div>
          ) : null}
          {post.community ? (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-fg-dim">Community</dt>
              <dd className="flex items-center gap-1.5 text-fg">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: post.community.color }} />
                {post.community.name}
              </dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <dt className="text-fg-dim">Language</dt>
            <dd className="uppercase text-fg">{post.language}</dd>
          </div>
          {post.sentimentScore !== undefined ? (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-fg-dim">Sentiment score</dt>
              <dd className="tabular-nums text-fg">{post.sentimentScore.toFixed(2)}</dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <dt className="text-fg-dim">Post ID</dt>
            <dd className="font-mono text-fg-muted">{post.id}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/network?node=${encodeURIComponent(post.authorId)}`} size="sm">
            <Network size={12} />
            Author in network
          </LinkButton>
          {post.topic ? (
            <LinkButton href={`/network?topic=${post.topic.id}`} size="sm">
              Topic network
            </LinkButton>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3 text-[11px] leading-relaxed text-fg-dim">
          <ImplementationBadge status="simulated" />
          Synthetic post and identity. Sentiment and topic labels are simulated.
        </div>
      </div>
    </div>
  );
}

