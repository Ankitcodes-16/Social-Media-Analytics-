"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Database } from "lucide-react";
import type { Platform, PostSort, Sentiment } from "@/types";
import { getPost, getPosts, getTopics } from "@/services";
import { useAsync } from "@/hooks/useAsync";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { AsyncBoundary } from "@/components/ui/AsyncBoundary";
import { EmptyState, ListSkeleton, LoadingState } from "@/components/ui/States";
import { ImplementationBadge } from "@/components/ui/Badge";
import { Button, SearchInput, SelectField } from "@/components/ui/Controls";
import { PostCard } from "@/components/explorer/PostCard";
import { PostDetailPanel } from "@/components/explorer/PostDetailPanel";

const PAGE_SIZE = 20;

const RANGE_OPTIONS = [
  { value: "all", label: "All time (48 h)" },
  { value: "1", label: "Last hour" },
  { value: "6", label: "Last 6 hours" },
  { value: "12", label: "Last 12 hours" },
  { value: "24", label: "Last 24 hours" },
];

const SORT_OPTIONS: Array<{ value: PostSort; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "engagement", label: "Most engaged" },
  { value: "views", label: "Most viewed" },
];

function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function ExplorerView() {
  const router = useRouter();
  const params = useSearchParams();

  // Filters live in the URL, so every view is shareable and deep-linkable.
  const q = params.get("q") ?? "";
  const platform = oneOf<Platform | "all">(params.get("platform"), ["all", "x", "telegram"], "all");
  const sentiment = oneOf<Sentiment | "all">(params.get("sentiment"), ["all", "positive", "neutral", "negative"], "all");
  const sort = oneOf<PostSort>(params.get("sort"), ["newest", "oldest", "engagement", "views"], "newest");
  const range = oneOf<string>(params.get("range"), RANGE_OPTIONS.map((o) => o.value), "all");
  const topic = params.get("topic") ?? "all";
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const postId = params.get("post");

  const update = (patch: Record<string, string | null>, keepPage = false): void => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      const isDefault =
        value === null ||
        value === "" ||
        (key === "sort" ? value === "newest" : key === "page" ? value === "1" : value === "all");
      if (isDefault) next.delete(key);
      else next.set(key, value);
    }
    if (!keepPage && !("page" in patch)) next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `/explorer?${qs}` : "/explorer", { scroll: false });
  };

  // Search box: debounced into the URL without clobbering what the user is typing.
  const [qInput, setQInput] = useState(q);
  const debouncedQ = useDebouncedValue(qInput, 300);
  const lastPushed = useRef(q);
  useEffect(() => {
    if (debouncedQ !== q && debouncedQ !== lastPushed.current) {
      lastPushed.current = debouncedQ;
      update({ q: debouncedQ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);
  useEffect(() => {
    if (q !== lastPushed.current) {
      lastPushed.current = q;
      setQInput(q);
    }
  }, [q]);

  const topics = useAsync(() => getTopics(), []);
  const posts = useAsync(
    () =>
      getPosts({
        q,
        platform,
        topicId: topic,
        sentiment,
        rangeHours: range === "all" ? "all" : Number(range),
        sort,
        page,
        pageSize: PAGE_SIZE,
      }),
    [q, platform, topic, sentiment, range, sort, page],
  );
  const selected = useAsync(() => (postId ? getPost(postId) : Promise.resolve(null)), [postId]);

  const filtersActive = q !== "" || platform !== "all" || topic !== "all" || sentiment !== "all" || range !== "all";
  const closePost = (): void => update({ post: null }, true);
  const total = posts.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = posts.data?.page ?? page;
  const first = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const last = Math.min(total, currentPage * PAGE_SIZE);

  const topicOptions = [
    { value: "all", label: "All topics" },
    ...(topics.data ?? []).map((t) => ({ value: t.id, label: t.name })),
    ...(topic !== "all" && !topics.data?.some((t) => t.id === topic) ? [{ value: topic, label: topic }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Data Explorer"
        description="Search and filter individual posts. Open a post to see its engagement, sentiment, topic and where its author sits in the network."
      />

      <Card className="mb-4">
        <CardBody className="space-y-3">
          <SearchInput value={qInput} onChange={setQInput} placeholder="Search text, authors or #hashtags" className="max-w-xl" />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
            <SelectField<Platform | "all">
              label="Platform"
              value={platform}
              onChange={(v) => update({ platform: v })}
              options={[
                { value: "all", label: "All" },
                { value: "x", label: "X" },
                { value: "telegram", label: "Telegram" },
              ]}
            />
            <SelectField<string> label="Topic" value={topic} onChange={(v) => update({ topic: v })} options={topicOptions} />
            <SelectField<Sentiment | "all">
              label="Sentiment"
              value={sentiment}
              onChange={(v) => update({ sentiment: v })}
              options={[
                { value: "all", label: "All" },
                { value: "negative", label: "Negative" },
                { value: "neutral", label: "Neutral" },
                { value: "positive", label: "Positive" },
              ]}
            />
            <SelectField<string> label="Time" value={range} onChange={(v) => update({ range: v })} options={RANGE_OPTIONS} />
            <SelectField<PostSort> label="Sort" value={sort} onChange={(v) => update({ sort: v })} options={SORT_OPTIONS} />
            {filtersActive ? (
              <Button variant="ghost" size="sm" onClick={() => router.replace("/explorer", { scroll: false })}>
                Clear filters
              </Button>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <div className={`grid items-start gap-4 ${postId ? "lg:grid-cols-[minmax(0,1fr)_25rem]" : ""}`}>
        <div className="min-w-0">
          <AsyncBoundary
            state={posts}
            loading={<ListSkeleton rows={6} />}
            errorTitle="Couldn't load posts"
            isEmpty={(d) => d.total === 0}
            empty={
              <EmptyState
                title="No posts match these filters"
                description="Try a broader search, another time range, or clear the filters."
                icon={<Database size={22} />}
                action={
                  filtersActive ? (
                    <Button onClick={() => router.replace("/explorer", { scroll: false })}>Clear filters</Button>
                  ) : undefined
                }
              />
            }
          >
            {(data) => (
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-fg-dim">
                  <span>
                    Showing <span className="tabular-nums text-fg">{first}–{last}</span> of{" "}
                    <span className="tabular-nums text-fg">{formatNumber(data.total)}</span> posts
                  </span>
                  <span className="flex items-center gap-2">
                    <Button size="sm" disabled={currentPage <= 1} onClick={() => update({ page: String(currentPage - 1) }, true)}>
                      <ChevronLeft size={13} />
                      Prev
                    </Button>
                    <span className="tabular-nums">
                      Page {currentPage} / {pages}
                    </span>
                    <Button size="sm" disabled={currentPage >= pages} onClick={() => update({ page: String(currentPage + 1) }, true)}>
                      Next
                      <ChevronRight size={13} />
                    </Button>
                  </span>
                </div>
                <div className="space-y-2.5">
                  {data.items.map((p) => (
                    <PostCard
                      key={p.id}
                      post={p}
                      query={q}
                      selected={p.id === postId}
                      onSelect={(post) => update({ post: post.id === postId ? null : post.id }, true)}
                    />
                  ))}
                </div>
              </div>
            )}
          </AsyncBoundary>

          <p className="mt-5 flex flex-wrap items-center gap-2 text-[11px] leading-relaxed text-fg-dim">
            <ImplementationBadge status="simulated" />
            The explorer holds an indexed sample of the simulated stream, not every analysed post. Authors are synthetic demo identities.
          </p>
        </div>

        {postId ? (
          <>
            <button type="button" aria-label="Close post details" onClick={closePost} className="fixed inset-0 z-30 bg-black/50 lg:hidden" />
            <aside
              aria-label="Post details"
              className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col overflow-hidden rounded-t-xl border border-line bg-ink-900 lg:sticky lg:inset-auto lg:top-20 lg:z-auto lg:max-h-[calc(100vh-7rem)] lg:rounded-lg"
            >
              {selected.status === "error" ? (
                <div className="p-4 text-xs text-rose-300">
                  Couldn&apos;t load this post.{" "}
                  <button type="button" onClick={selected.reload} className="underline">
                    Try again
                  </button>
                </div>
              ) : selected.data === undefined ? (
                <LoadingState label="Loading post" className="h-72 border-0" />
              ) : selected.data === null ? (
                <div className="p-4">
                  <EmptyState title="Post not found" description="It may have been removed from the sample." />
                  <div className="mt-3 text-center">
                    <Button size="sm" onClick={closePost}>
                      Close
                    </Button>
                  </div>
                </div>
              ) : (
                <PostDetailPanel
                  post={selected.data}
                  query={q}
                  onClose={closePost}
                  onFilterHashtag={(tag) => {
                    setQInput(`#${tag}`);
                    update({ q: `#${tag}`, post: null });
                  }}
                  onFilterTopic={(id) => update({ topic: id }, true)}
                />
              )}
            </aside>
          </>
        ) : null}
      </div>
    </>
  );
}

export default function ExplorerPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <ExplorerView />
    </Suspense>
  );
}
