"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type cytoscape from "cytoscape";
import type { NetworkGraph } from "@/types";

export interface NetworkCanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
}

interface Props {
  graph: NetworkGraph;
  selectedNodeId: string | null;
  selectedCommunityId: string | null;
  hiddenCommunityIds: ReadonlySet<string>;
  activePathId: string | null;
  onSelectNode: (id: string | null) => void;
}

interface HoverInfo {
  x: number;
  y: number;
  label: string;
  detail: string;
}

/* ───────────────────────── Elements ───────────────────────── */

/** Community-anchored starting positions so the force layout converges to readable clusters. */
function seedPositions(graph: NetworkGraph): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const count = graph.communities.length;
  const radius = 240;
  graph.communities.forEach((community, ci) => {
    const angle = (2 * Math.PI * ci) / Math.max(1, count) - Math.PI / 2;
    const cx = count === 1 ? 0 : Math.cos(angle) * radius;
    const cy = count === 1 ? 0 : Math.sin(angle) * radius;
    const members = graph.nodes
      .filter((n) => n.communityId === community.id)
      .sort((a, b) => b.influence - a.influence);
    members.forEach((n, k) => {
      if (k === 0) {
        positions[n.id] = { x: cx, y: cy };
        return;
      }
      const a = (2 * Math.PI * k) / members.length + ci;
      const r = 26 + 9 * Math.sqrt(members.length) * (0.7 + (k % 3) * 0.25);
      positions[n.id] = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    });
  });
  return positions;
}

function buildElements(graph: NetworkGraph): cytoscape.ElementDefinition[] {
  const positions = seedPositions(graph);
  const colorOf: Record<string, string> = Object.fromEntries(graph.communities.map((c) => [c.id, c.color]));
  const platformOf: Record<string, string> = Object.fromEntries(graph.nodes.map((n) => [n.id, n.platform]));

  const nodes: cytoscape.ElementDefinition[] = graph.nodes.map((n) => ({
    group: "nodes" as const,
    data: {
      id: n.id,
      label: n.label,
      pathLabel: n.label,
      communityId: n.communityId,
      color: colorOf[n.communityId] ?? "#667085",
      size: Math.round(13 + n.influence * 30),
      type: n.type,
      showLabel: n.role === "hub",
    },
    position: positions[n.id],
  }));

  const edges: cytoscape.ElementDefinition[] = graph.edges.map((e) => ({
    group: "edges" as const,
    data: {
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
      w: Math.round((0.7 + Math.min(e.weight, 9) * 0.22) * 100) / 100,
      cross: platformOf[e.source] !== platformOf[e.target],
    },
  }));

  return [...nodes, ...edges];
}

/* Cytoscape's style typings are stricter than its runtime, hence the cast below. */
const STYLE = [
  {
    selector: "node",
    style: {
      "background-color": "data(color)",
      width: "data(size)",
      height: "data(size)",
      "border-width": 1.5,
      "border-color": "#0a0d12",
      label: "",
      "font-size": 10,
      color: "#cbd5e1",
      "text-valign": "bottom",
      "text-margin-y": 4,
      "text-outline-color": "#0a0d12",
      "text-outline-width": 2,
      "min-zoomed-font-size": 7,
    },
  },
  { selector: "node[type = 'channel']", style: { shape: "round-rectangle" } },
  { selector: "node[type = 'user']", style: { shape: "ellipse" } },
  { selector: "node[?showLabel]", style: { label: "data(label)" } },
  {
    selector: "edge",
    style: {
      width: "data(w)",
      "line-color": "#354154",
      "target-arrow-color": "#354154",
      "target-arrow-shape": "triangle",
      "arrow-scale": 0.7,
      "curve-style": "bezier",
      opacity: 0.6,
    },
  },
  { selector: "edge[?cross]", style: { "line-style": "dashed", "line-color": "#4b5c75", "target-arrow-color": "#4b5c75" } },
  { selector: ".faded", style: { opacity: 0.07 } },
  { selector: "node.highlighted", style: { label: "data(label)", "border-color": "#4fd1c5", "border-width": 2 } },
  {
    selector: "edge.highlighted",
    style: { "line-color": "#4fd1c5", "target-arrow-color": "#4fd1c5", opacity: 0.95, "z-index": 5 },
  },
  {
    selector: "node.selected",
    style: { "border-width": 3.5, "border-color": "#f1f5f9", label: "data(label)", "z-index": 10 },
  },
  {
    selector: "node.pathnode",
    style: {
      "border-width": 3.5,
      "border-color": "#fb923c",
      label: "data(pathLabel)",
      color: "#fdba74",
      "font-size": 11,
      "z-index": 9,
    },
  },
  {
    selector: "edge.pathedge",
    style: {
      "line-color": "#fb923c",
      "target-arrow-color": "#fb923c",
      width: 3.5,
      opacity: 1,
      "line-style": "solid",
      "arrow-scale": 1,
      "z-index": 9,
    },
  },
  { selector: ".hidden", style: { display: "none" } },
];

const LAYOUT = {
  name: "cose",
  randomize: false,
  animate: false,
  fit: true,
  padding: 34,
  nodeRepulsion: 6500,
  idealEdgeLength: 58,
  edgeElasticity: 70,
  gravity: 0.9,
  numIter: 1000,
  nodeOverlap: 14,
  componentSpacing: 80,
};

/* ───────────────────────── Component ───────────────────────── */

export const NetworkCanvas = forwardRef<NetworkCanvasHandle, Props>(function NetworkCanvas(
  { graph, selectedNodeId, selectedCommunityId, hiddenCommunityIds, activePathId, onSelectNode },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const onSelectRef = useRef(onSelectNode);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  useEffect(() => {
    onSelectRef.current = onSelectNode;
  }, [onSelectNode]);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => zoomBy(cyRef.current, 1.3),
      zoomOut: () => zoomBy(cyRef.current, 1 / 1.3),
      fit: () => cyRef.current?.fit(undefined, 34),
    }),
    [],
  );

  // Build the Cytoscape instance whenever the graph itself changes.
  useEffect(() => {
    let cancelled = false;
    let instance: cytoscape.Core | null = null;
    let observer: ResizeObserver | null = null;
    setReady(false);
    setFailure(null);

    (async () => {
      try {
        const mod = await import("cytoscape");
        const container = containerRef.current;
        if (cancelled || !container) return;
        const create = mod.default;
        const cy = create({
          container,
          elements: buildElements(graph),
          style: STYLE as never,
          layout: LAYOUT as never,
          minZoom: 0.25,
          maxZoom: 3,
          wheelSensitivity: 0.25,
          boxSelectionEnabled: false,
        });
        instance = cy;
        cyRef.current = cy;

        cy.on("tap", "node", (evt: cytoscape.EventObject) => onSelectRef.current(evt.target.id() as string));
        cy.on("tap", (evt: cytoscape.EventObject) => {
          if (evt.target === cy) onSelectRef.current(null);
        });
        cy.on("mouseover", "node", (evt: cytoscape.EventObject) => {
          const node = evt.target;
          const pos = node.renderedPosition();
          setHover({
            x: pos.x,
            y: pos.y,
            label: node.data("label") as string,
            detail: `${node.data("type") === "channel" ? "Telegram channel" : "X account"} · ${node.connectedEdges().length} connections`,
          });
          container.style.cursor = "pointer";
        });
        cy.on("mouseout", "node", () => {
          setHover(null);
          container.style.cursor = "default";
        });
        cy.on("pan zoom drag", () => setHover(null));

        if (typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(() => {
            cy.resize();
          });
          observer.observe(container);
        }
        setReady(true);
      } catch (err) {
        if (!cancelled) setFailure(err instanceof Error ? err.message : "The network view failed to initialise.");
      }
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      instance?.destroy();
      if (cyRef.current === instance) cyRef.current = null;
      setHover(null);
    };
  }, [graph]);

  // Apply selection / filter / path visual state.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !ready) return;

    cy.batch(() => {
      cy.elements().removeClass("faded highlighted selected pathnode pathedge hidden");

      cy.nodes().forEach((n: cytoscape.NodeSingular) => {
        n.data("pathLabel", n.data("label"));
        if (hiddenCommunityIds.has(n.data("communityId") as string)) n.addClass("hidden");
      });

      const path = activePathId ? graph.propagationPaths.find((p) => p.id === activePathId) : undefined;
      if (path) {
        const edgeIds = new Set(path.edgeIds);
        cy.elements().addClass("faded");
        path.hops.forEach((hop, i) => {
          const n = cy.getElementById(hop.nodeId);
          if (n.nonempty()) {
            n.data("pathLabel", `${i + 1} · ${n.data("label") as string}`);
            n.removeClass("faded").addClass("pathnode");
          }
        });
        cy.edges()
          .filter((e: cytoscape.EdgeSingular) => edgeIds.has(e.id()))
          .removeClass("faded")
          .addClass("pathedge");
      } else if (selectedNodeId) {
        const node = cy.getElementById(selectedNodeId);
        if (node.nonempty()) {
          const around = node.closedNeighborhood();
          cy.elements().not(around).addClass("faded");
          around.addClass("highlighted");
          node.addClass("selected");
        }
      } else if (selectedCommunityId) {
        const members = cy.nodes().filter((n: cytoscape.NodeSingular) => n.data("communityId") === selectedCommunityId);
        const inside = members.union(members.connectedEdges());
        cy.elements().not(inside).addClass("faded");
        members.addClass("highlighted");
      }
    });
  }, [ready, graph, selectedNodeId, selectedCommunityId, hiddenCommunityIds, activePathId]);

  // Centre on a node selected from outside the canvas (e.g. the side panel).
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !ready || !selectedNodeId) return;
    const node = cy.getElementById(selectedNodeId);
    if (node.nonempty()) cy.animate({ center: { eles: node } }, { duration: 260 });
  }, [ready, selectedNodeId]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" role="img" aria-label="Interactive network graph of accounts, channels and communities" />
      {!ready && !failure ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-fg-dim">Laying out network…</div>
      ) : null}
      {failure ? (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-xs text-rose-300">{failure}</div>
      ) : null}
      {hover ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-line-strong bg-ink-850/95 px-2.5 py-1.5 text-xs shadow-xl"
          style={{ left: hover.x, top: Math.max(8, hover.y - 52) }}
        >
          <div className="font-medium text-fg">{hover.label}</div>
          <div className="text-[11px] text-fg-dim">{hover.detail}</div>
        </div>
      ) : null}
    </div>
  );
});

function zoomBy(cy: cytoscape.Core | null, factor: number): void {
  if (!cy) return;
  const level = Math.min(cy.maxZoom(), Math.max(cy.minZoom(), cy.zoom() * factor));
  cy.animate({ zoom: { level, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } } }, { duration: 160 });
}
