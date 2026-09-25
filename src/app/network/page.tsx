"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Maximize2, Network as NetworkIcon, ZoomIn, ZoomOut } from "lucide-react";
import type { NetworkGraph } from "@/types";
import { getNetwork, getTopics } from "@/services";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader } from "@/components/layout/PageHeader";
import { AsyncBoundary } from "@/components/ui/AsyncBoundary";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { ImplementationBadge } from "@/components/ui/Badge";
import { Button, FilterChip, SelectField } from "@/components/ui/Controls";
import { NetworkCanvas, type NetworkCanvasHandle } from "@/components/network/NetworkCanvas";
import { CommunityPanel, NetworkLegend, NetworkOverviewPanel, NodePanel } from "@/components/network/NetworkPanels";

const STAGE_HEIGHT = "h-[calc(100vh-17rem)] min-h-[520px]";

function NetworkStage({
  graph,
  topic,
  topicName,
  initialNodeId,
}: {
  graph: NetworkGraph;
  topic: string;
  topicName: (id: string) => string;
  initialNodeId: string | null;
}) {
  const canvasRef = useRef<NetworkCanvasHandle | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialNodeId);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [activePathId, setActivePathId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const autoPathApplied = useRef(false);

  // When exploring one topic, start with its main propagation path highlighted.
  useEffect(() => {
    if (autoPathApplied.current) return;
    autoPathApplied.current = true;
    if (topic !== "all" && !initialNodeId && graph.propagationPaths.length > 0) {
      setActivePathId(graph.propagationPaths[0].id);
    }
  }, [graph, topic, initialNodeId]);

  const selectedNode = selectedNodeId ? graph.nodes.find((n) => n.id === selectedNodeId) : undefined;
  const selectedCommunity = selectedCommunityId ? graph.communities.find((c) => c.id === selectedCommunityId) : undefined;

  const selectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id);
    if (id) {
      setActivePathId(null);
      setSelectedCommunityId(null);
    }
  }, []);

  const selectCommunity = (id: string): void => {
    setSelectedCommunityId(id);
    setSelectedNodeId(null);
    setActivePathId(null);
  };

  const togglePath = (id: string): void => {
    setActivePathId((current) => (current === id ? null : id));
    setSelectedNodeId(null);
    setSelectedCommunityId(null);
  };

  const toggleCommunity = (id: string): void => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isolate = (id: string): void => {
    setHidden(new Set(graph.communities.filter((c) => c.id !== id).map((c) => c.id)));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1">Communities</span>
        {graph.communities.map((c) => (
          <FilterChip key={c.id} active={!hidden.has(c.id)} color={c.color} onClick={() => toggleCommunity(c.id)}>
            {c.name}
            <span className="tabular-nums text-fg-dim">{c.size}</span>
          </FilterChip>
        ))}
        {hidden.size > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setHidden(new Set())}>
            Show all
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className={`relative overflow-hidden rounded-lg border border-line bg-[#080b0f] ${STAGE_HEIGHT}`}>
          <NetworkCanvas
            ref={canvasRef}
            graph={graph}
            selectedNodeId={selectedNode?.id ?? null}
            selectedCommunityId={selectedCommunity?.id ?? null}
            hiddenCommunityIds={hidden}
            activePathId={activePathId}
            onSelectNode={selectNode}
          />
          <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-md border border-line bg-ink-900/90 backdrop-blur">
            <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => canvasRef.current?.zoomIn()} className="p-2 text-fg-muted hover:bg-ink-700 hover:text-fg">
              <ZoomIn size={15} />
            </button>
            <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => canvasRef.current?.zoomOut()} className="border-t border-line p-2 text-fg-muted hover:bg-ink-700 hover:text-fg">
              <ZoomOut size={15} />
            </button>
            <button type="button" aria-label="Fit to screen" title="Fit to screen" onClick={() => canvasRef.current?.fit()} className="border-t border-line p-2 text-fg-muted hover:bg-ink-700 hover:text-fg">
              <Maximize2 size={15} />
            </button>
          </div>
          <div className="absolute bottom-3 left-3 right-16">
            <NetworkLegend />
          </div>
        </div>

        <aside className={`overflow-y-auto rounded-lg border border-line bg-ink-900 ${STAGE_HEIGHT}`} aria-label="Network details">
          {selectedNode ? (
            <NodePanel node={selectedNode} graph={graph} topicName={topicName} onSelectNode={selectNode} onClose={() => selectNode(null)} />
          ) : selectedCommunity ? (
            <CommunityPanel
              community={selectedCommunity}
              graph={graph}
              onSelectNode={selectNode}
              onIsolate={() => isolate(selectedCommunity.id)}
              onClose={() => setSelectedCommunityId(null)}
            />
          ) : (
            <NetworkOverviewPanel
              graph={graph}
              activePathId={activePathId}
              onSelectNode={selectNode}
              onSelectCommunity={selectCommunity}
              onTogglePath={togglePath}
            />
          )}
        </aside>
      </div>

      <p className="flex flex-wrap items-center gap-2 text-[11px] leading-relaxed text-fg-dim">
        <ImplementationBadge status="simulated" />
        The graph is built from the simulated dataset (anonymised demo identities). Phase 4 derives it from ingested interactions.
      </p>
    </div>
  );
}

function NetworkView() {
  const router = useRouter();
  const params = useSearchParams();
  const topic = params.get("topic") ?? "all";
  const nodeParam = params.get("node");

  const topics = useAsync(() => getTopics(), []);
  const graph = useAsync(() => getNetwork({ topicId: topic }), [topic]);

  const topicName = useCallback((id: string): string => topics.data?.find((t) => t.id === id)?.name ?? id, [topics.data]);
  const setTopic = (value: string): void => {
    router.replace(value === "all" ? "/network" : `/network?topic=${encodeURIComponent(value)}`);
  };

  return (
    <>
      <PageHeader
        title="Network"
        description="How information moves between accounts and channels: communities, influential nodes and propagation paths."
        actions={
          <SelectField<string>
            label="Topic"
            value={topic}
            onChange={setTopic}
            options={[
              { value: "all", label: "All topics" },
              ...(topics.data ?? []).map((t) => ({ value: t.id, label: t.name })),
              ...(topic !== "all" && !topics.data?.some((t) => t.id === topic) ? [{ value: topic, label: topic }] : []),
            ]}
          />
        }
      />

      <AsyncBoundary
        state={graph}
        loading={<LoadingState label="Building network" className={STAGE_HEIGHT} />}
        errorTitle="Couldn't load the network"
        isEmpty={(g) => g.nodes.length === 0}
        empty={
          <EmptyState
            title="No accounts discussed this topic"
            description="Nothing in the indexed sample connects to this topic yet."
            icon={<NetworkIcon size={22} />}
            action={<Button onClick={() => setTopic("all")}>Show all topics</Button>}
          />
        }
      >
        {(g) => <NetworkStage key={g.topicId ?? "all"} graph={g} topic={topic} topicName={topicName} initialNodeId={nodeParam} />}
      </AsyncBoundary>
    </>
  );
}

export default function NetworkPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading network" className={STAGE_HEIGHT} />}>
      <NetworkView />
    </Suspense>
  );
}
