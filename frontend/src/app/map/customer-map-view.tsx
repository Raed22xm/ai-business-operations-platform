"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Calendar,
  Camera,
  Check,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  LayoutGrid,
  Mail,
  Map as MapIcon,
  MapPin,
  Move,
  Network,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  ArrowUpRight,
  Save,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { CustomerMapNode } from "./types";
import { caseStatusLabel } from "@/lib/cases-shared";
import { addPersonFromMapAction } from "./actions";
import { processAvatarImage } from "./image-helper";
import {
  DENMARK_VIEWBOX,
  DENMARK_REGIONS,
  DANISH_CITIES,
  type DanishCity,
  matchDanishAddressLocation,
  getGoogleMapsUrl,
  getAppleMapsUrl,
} from "./denmark-data";
import { CustomerMetaSection } from "./customer-meta-section";
import {
  getCustomerMeta,
  loadAllCustomerMeta,
  saveAllCustomerMeta,
  type CustomerMeta,
  DELIVERABLE_CATEGORIES,
} from "./customer-meta";

const AVATAR_PALETTES = [
  { bg: "linear-gradient(135deg, #059669 0%, #064e3b 100%)", border: "#10b981", glow: "rgba(16, 185, 129, 0.4)" },
  { bg: "linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)", border: "#3b82f6", glow: "rgba(59, 130, 246, 0.4)" },
  { bg: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)", border: "#8b5cf6", glow: "rgba(139, 92, 246, 0.4)" },
  { bg: "linear-gradient(135deg, #d97706 0%, #78350f 100%)", border: "#f59e0b", glow: "rgba(245, 158, 11, 0.4)" },
  { bg: "linear-gradient(135deg, #e11d48 0%, #881337 100%)", border: "#f43f5e", glow: "rgba(244, 63, 94, 0.4)" },
  { bg: "linear-gradient(135deg, #0891b2 0%, #164e63 100%)", border: "#06b6d4", glow: "rgba(6, 182, 212, 0.4)" },
];

function getAvatarStyle(id: number) {
  const index = Math.abs(id) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface DragSession {
  type: "customer" | "center";
  id?: number;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  moved: boolean;
}

export function CustomerMapView({ nodes: initialNodes }: { nodes: CustomerMapNode[] }) {
  const [nodes, setNodes] = useState<CustomerMapNode[]>(initialNodes);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "nocases">("all");
  const [viewMode, setViewMode] = useState<"network" | "grid">("network");
  const [selectedNode, setSelectedNode] = useState<CustomerMapNode | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);

  // Picture / Avatar storage (stored in localStorage by customer ID)
  const [customerAvatars, setCustomerAvatars] = useState<Record<number, string>>({});

  // Work Location in Denmark (stored in localStorage by customer ID)
  const [customerLocations, setCustomerLocations] = useState<Record<number, string>>({});

  // Customer Addresses (stored in localStorage by customer ID)
  const [customerAddresses, setCustomerAddresses] = useState<Record<number, string>>({});

  // Denmark map visual toggles
  const [showDenmarkMap, setShowDenmarkMap] = useState(true);
  const [showDkCities, setShowDkCities] = useState(true);

  // Add person modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 680 });

  // Custom dragged positions stored by customer ID
  const [customPositions, setCustomPositions] = useState<Record<number, { x: number; y: number }>>({});
  const [centerPos, setCenterPos] = useState<{ x: number; y: number } | null>(null);
  const [activeDraggingId, setActiveDraggingId] = useState<string | number | null>(null);

  const dragRef = useRef<DragSession | null>(null);

  // Sync initial nodes if server revalidates
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes]);

  // Load saved positions, avatars, locations & addresses from localStorage on mount
  useEffect(() => {
    try {
      const savedNodes = localStorage.getItem("ops_hub_customer_map_positions");
      if (savedNodes) {
        setCustomPositions(JSON.parse(savedNodes));
      }
      const savedCenter = localStorage.getItem("ops_hub_customer_map_center");
      if (savedCenter) {
        setCenterPos(JSON.parse(savedCenter));
      }
      const savedAvatars = localStorage.getItem("ops_hub_customer_avatars");
      if (savedAvatars) {
        setCustomerAvatars(JSON.parse(savedAvatars));
      }
      const savedLocations = localStorage.getItem("ops_hub_customer_locations");
      if (savedLocations) {
        setCustomerLocations(JSON.parse(savedLocations));
      }
      const savedAddresses = localStorage.getItem("ops_hub_customer_addresses");
      let addrs: Record<number, string> = {};
      if (savedAddresses) {
        try {
          addrs = JSON.parse(savedAddresses);
        } catch {
          addrs = {};
        }
      }
      // Pre-populate Zobir / Studio 22 address with Centrumgaden 22, 2750 Ballerup
      const zobirNode = initialNodes.find(
        (n) =>
          n.customer.name.toLowerCase().includes("zobir") ||
          n.customer.company?.toLowerCase().includes("studio 22")
      );
      if (zobirNode && !addrs[zobirNode.customer.id]) {
        addrs[zobirNode.customer.id] = "Centrumgaden 22, 2750 Ballerup";
        try {
          localStorage.setItem("ops_hub_customer_addresses", JSON.stringify(addrs));
        } catch {
          // Ignore
        }
      }
      setCustomerAddresses(addrs);
    } catch {
      // Ignore storage errors
    }
  }, [initialNodes]);

  // Save an avatar for a customer
  function handleSaveAvatar(customerId: number, dataUrl: string | null) {
    setCustomerAvatars((prev) => {
      const next = { ...prev };
      if (dataUrl) {
        next[customerId] = dataUrl;
      } else {
        delete next[customerId];
      }
      try {
        localStorage.setItem("ops_hub_customer_avatars", JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }

  // Denmark map coordinate projection onto canvas
  const denmarkTransform = useMemo(() => {
    const padding = 24;
    const availW = Math.max(300, dimensions.width - padding * 2);
    const availH = Math.max(300, dimensions.height - padding * 2);

    const scale = Math.min(
      availW / DENMARK_VIEWBOX.width,
      availH / DENMARK_VIEWBOX.height
    );

    const renderedW = DENMARK_VIEWBOX.width * scale;
    const renderedH = DENMARK_VIEWBOX.height * scale;

    const offsetX = (dimensions.width - renderedW) / 2;
    const offsetY = (dimensions.height - renderedH) / 2;

    return {
      scale,
      offsetX,
      offsetY,
      renderedW,
      renderedH,
    };
  }, [dimensions]);

  function dkToScreen(dkX: number, dkY: number) {
    return {
      x: denmarkTransform.offsetX + dkX * denmarkTransform.scale,
      y: denmarkTransform.offsetY + dkY * denmarkTransform.scale,
    };
  }

  // Set / Snap location in Denmark
  function handleSetLocation(customerId: number, locationName: string, targetCity?: DanishCity) {
    setCustomerLocations((prev) => {
      const next = { ...prev, [customerId]: locationName };
      try {
        localStorage.setItem("ops_hub_customer_locations", JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });

    if (targetCity) {
      const screen = dkToScreen(targetCity.x, targetCity.y);
      setCustomPositions((prev) => {
        const next = { ...prev, [customerId]: screen };
        try {
          localStorage.setItem("ops_hub_customer_map_positions", JSON.stringify(next));
        } catch {
          // Ignore
        }
        return next;
      });
    }
  }

  // Save full street address and auto-snap to Denmark map location
  function handleSaveAddress(customerId: number, address: string) {
    const trimmed = address.trim();
    setCustomerAddresses((prev) => {
      const next = { ...prev };
      if (trimmed) {
        next[customerId] = trimmed;
      } else {
        delete next[customerId];
      }
      try {
        localStorage.setItem("ops_hub_customer_addresses", JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });

    if (trimmed) {
      const matchedCity = matchDanishAddressLocation(trimmed);
      if (matchedCity) {
        handleSetLocation(customerId, matchedCity.name, matchedCity);
      }
    }
  }

  // Update canvas dimensions on resize
  useEffect(() => {
    function updateDimensions() {
      if (canvasRef.current) {
        const { clientWidth, clientHeight } = canvasRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setDimensions({ width: clientWidth, height: clientHeight });
        }
      }
    }
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [viewMode]);

  // Filter nodes
  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      const q = search.trim().toLowerCase();
      const nodeLoc = customerLocations[node.customer.id] || "";
      const nodeAddr = customerAddresses[node.customer.id] || "";
      const matchesSearch =
        !q ||
        node.customer.name.toLowerCase().includes(q) ||
        (node.customer.company && node.customer.company.toLowerCase().includes(q)) ||
        node.customer.email.toLowerCase().includes(q) ||
        nodeLoc.toLowerCase().includes(q) ||
        nodeAddr.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (filter === "active") return node.hasActiveCases;
      if (filter === "nocases") return node.cases.length === 0;
      return true;
    });
  }, [nodes, search, filter, customerLocations, customerAddresses]);

  // Center position (Operations HQ)
  const activeCenter = useMemo(() => {
    if (centerPos && centerPos.x > 0 && centerPos.y > 0) {
      return centerPos;
    }
    // Default Operations HQ in Central/Eastern Denmark (near Kattegat / Samsø hub)
    return { x: dimensions.width / 2, y: dimensions.height / 2 };
  }, [centerPos, dimensions]);

  // Compute positions with Denmark geographic awareness
  const positionedNodes = useMemo(() => {
    const cx = activeCenter.x;
    const cy = activeCenter.y;
    const count = filteredNodes.length;

    if (count === 0) return [];

    const useMultiOrbit = count > 8;
    const innerRadius = Math.min(dimensions.width, dimensions.height) * 0.26;
    const outerRadius = Math.min(dimensions.width, dimensions.height) * 0.42;
    const baseRadius = Math.min(dimensions.width, dimensions.height) * 0.36;

    return filteredNodes.map((node, i) => {
      // 1. If user dragged them to a custom position, respect it
      if (customPositions[node.customer.id]) {
        const custom = customPositions[node.customer.id];
        return {
          ...node,
          x: custom.x,
          y: custom.y,
        };
      }

      // 2. If customer has a specific street address, map by address location
      const addr = customerAddresses[node.customer.id];
      if (addr) {
        const matched = matchDanishAddressLocation(addr);
        if (matched) {
          const screen = dkToScreen(matched.x, matched.y);
          return {
            ...node,
            x: screen.x,
            y: screen.y,
          };
        }
      }

      // 3. If customer has a known location in Denmark, position on their Danish city
      const loc = customerLocations[node.customer.id];
      if (loc) {
        const city = DANISH_CITIES.find(
          (c) =>
            c.name.toLowerCase() === loc.toLowerCase() ||
            c.id === loc.toLowerCase() ||
            loc.toLowerCase().includes(c.name.toLowerCase())
        );
        if (city) {
          const screen = dkToScreen(city.x, city.y);
          return {
            ...node,
            x: screen.x,
            y: screen.y,
          };
        }
      }

      // 4. Auto-detect Studio 22 / Zobir -> Ballerup / København
      if (
        node.customer.name.toLowerCase().includes("zobir") ||
        node.customer.company?.toLowerCase().includes("studio 22") ||
        node.customer.company?.toLowerCase().includes("frisør")
      ) {
        const ballerup = DANISH_CITIES.find((c) => c.id === "ballerup") || DANISH_CITIES[0];
        const screen = dkToScreen(ballerup.x, ballerup.y);
        return {
          ...node,
          x: screen.x,
          y: screen.y,
        };
      }

      // 5. Default orbit positioning
      let r = baseRadius;
      let angle = (i / count) * 2 * Math.PI - Math.PI / 2;

      if (useMultiOrbit) {
        const isInner = i % 2 === 0;
        r = isInner ? innerRadius : outerRadius;
        angle = (i / count) * 2 * Math.PI - Math.PI / 2;
      }

      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);

      return {
        ...node,
        x,
        y,
      };
    });
  }, [filteredNodes, dimensions, activeCenter, customPositions, customerLocations, customerAddresses, denmarkTransform]);

  // Drag handlers
  function handlePointerDown(
    e: React.PointerEvent<HTMLElement>,
    type: "customer" | "center",
    id?: number,
    initialX: number = 0,
    initialY: number = 0,
  ) {
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    dragRef.current = {
      type,
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: initialX,
      origY: initialY,
      moved: false,
    };

    setActiveDraggingId(type === "center" ? "center" : (id ?? null));
  }

  function handlePointerMove(e: React.PointerEvent<HTMLElement>) {
    if (!dragRef.current) return;

    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    if (!dragRef.current.moved && Math.hypot(dx, dy) > 4) {
      dragRef.current.moved = true;
    }

    if (dragRef.current.moved) {
      const padding = 50;
      const newX = Math.max(padding, Math.min(dimensions.width - padding, dragRef.current.origX + dx));
      const newY = Math.max(padding, Math.min(dimensions.height - padding, dragRef.current.origY + dy));

      if (dragRef.current.type === "customer" && typeof dragRef.current.id === "number") {
        const custId = dragRef.current.id;
        setCustomPositions((prev) => ({
          ...prev,
          [custId]: { x: newX, y: newY },
        }));
      } else if (dragRef.current.type === "center") {
        setCenterPos({ x: newX, y: newY });
      }
    }
  }

  function handlePointerUp(
    e: React.PointerEvent<HTMLElement>,
    node?: CustomerMapNode,
  ) {
    if (!dragRef.current) return;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    const { moved, type } = dragRef.current;
    dragRef.current = null;
    setActiveDraggingId(null);

    if (!moved) {
      if (type === "customer" && node) {
        setSelectedNode(node);
      }
    } else {
      try {
        if (type === "customer") {
          setCustomPositions((prev) => {
            localStorage.setItem("ops_hub_customer_map_positions", JSON.stringify(prev));
            return prev;
          });
        } else if (type === "center") {
          setCenterPos((prev) => {
            if (prev) {
              localStorage.setItem("ops_hub_customer_map_center", JSON.stringify(prev));
            }
            return prev;
          });
        }
      } catch {
        // Ignore
      }
    }
  }

  // Reset layout
  function resetPositions() {
    setCustomPositions({});
    setCenterPos(null);
    try {
      localStorage.removeItem("ops_hub_customer_map_positions");
      localStorage.removeItem("ops_hub_customer_map_center");
    } catch {
      // Ignore
    }
  }

  // Close drawer on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelectedNode(null);
        setIsAddModalOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const totalActiveCases = useMemo(() => {
    return nodes.reduce((acc, curr) => acc + curr.activeCasesCount, 0);
  }, [nodes]);

  const hasCustomPositions = Object.keys(customPositions).length > 0 || centerPos !== null;

  return (
    <div className="map-page-container">
      {/* Header */}
      <header className="map-header">
        <div className="map-title-area">
          <h1>
            <span>Customer Map</span>
            <span className="map-title-badge">
              <Sparkles size={12} className="inline mr-1" />
              Interactive Relationship Network
            </span>
          </h1>
          <p className="map-subtitle">
            Add pictures, drag circles anywhere, and add any person you want directly to your operations network.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasCustomPositions ? (
            <button
              type="button"
              onClick={resetPositions}
              className="workspace-button small-button"
              title="Reset circles to default circular layout"
            >
              <RotateCcw size={14} />
              Reset Layout
            </button>
          ) : null}

          {/* Add Any Person Button */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="workspace-button is-primary"
          >
            <UserPlus size={15} />
            Add Person
          </button>
        </div>
      </header>

      {/* Toolbar & Filters */}
      <div className="map-toolbar">
        {/* Search */}
        <div className="map-search-box">
          <Search size={16} className="map-search-icon" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers or companies…"
            className="map-search-input"
            aria-label="Filter customers on map"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="map-search-clear"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        {/* Filter Pills */}
        <div className="map-filter-group" role="tablist" aria-label="Customer status filters">
          <button
            type="button"
            className={`map-filter-pill ${filter === "all" ? "is-active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All ({nodes.length})
          </button>
          <button
            type="button"
            className={`map-filter-pill ${filter === "active" ? "is-active" : ""}`}
            onClick={() => setFilter("active")}
          >
            Active Cases ({nodes.filter((n) => n.hasActiveCases).length})
          </button>
          <button
            type="button"
            className={`map-filter-pill ${filter === "nocases" ? "is-active" : ""}`}
            onClick={() => setFilter("nocases")}
          >
            No Cases ({nodes.filter((n) => n.cases.length === 0).length})
          </button>
        </div>

        {/* View Switcher & Denmark Controls */}
        <div className="flex items-center gap-2">
          {/* Denmark Map Toggles */}
          <div className="map-view-switcher" role="group" aria-label="Denmark map options">
            <button
              type="button"
              className={`map-view-button ${showDenmarkMap ? "is-active" : ""}`}
              onClick={() => setShowDenmarkMap((prev) => !prev)}
              title="Toggle Denmark Map Background"
            >
              <MapIcon size={14} />
              <span>🇩🇰 Denmark Map</span>
            </button>
            {showDenmarkMap ? (
              <button
                type="button"
                className={`map-view-button ${showDkCities ? "is-active" : ""}`}
                onClick={() => setShowDkCities((prev) => !prev)}
                title="Toggle Danish City Markers"
              >
                <MapPin size={14} />
                <span>Cities</span>
              </button>
            ) : null}
          </div>

          <div className="map-view-switcher" role="group" aria-label="View format">
            <button
              type="button"
              className={`map-view-button ${viewMode === "network" ? "is-active" : ""}`}
              onClick={() => setViewMode("network")}
              aria-label="Interactive Network View"
            >
              <Network size={15} />
              Network Map
            </button>
            <button
              type="button"
              className={`map-view-button ${viewMode === "grid" ? "is-active" : ""}`}
              onClick={() => setViewMode("grid")}
              aria-label="Face Cards Grid View"
            >
              <LayoutGrid size={15} />
              Face Cards
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === "network" ? (
        <div className="map-canvas-wrapper">
          <div className="map-canvas-inner" ref={canvasRef}>
            <div className="map-grid-bg" />

            {/* Denmark Vector Map Layer */}
            {showDenmarkMap ? (
              <svg
                className="map-denmark-svg-layer"
                viewBox={`0 0 ${DENMARK_VIEWBOX.width} ${DENMARK_VIEWBOX.height}`}
                style={{
                  position: "absolute",
                  left: `${denmarkTransform.offsetX}px`,
                  top: `${denmarkTransform.offsetY}px`,
                  width: `${denmarkTransform.renderedW}px`,
                  height: `${denmarkTransform.renderedH}px`,
                  pointerEvents: "none",
                }}
              >
                {/* Denmark Regions */}
                <g className="map-denmark-regions">
                  {DENMARK_REGIONS.map((region) => (
                    <path
                      key={region.id}
                      d={region.d}
                      className="map-denmark-region"
                      id={region.id}
                    />
                  ))}
                </g>

                {/* Major Regional Labels */}
                <g className="map-denmark-watermarks">
                  <text x={245} y={190} className="map-denmark-region-label">NORDJYLLAND</text>
                  <text x={205} y={400} className="map-denmark-region-label">MIDTJYLLAND</text>
                  <text x={160} y={640} className="map-denmark-region-label">SYDDANMARK</text>
                  <text x={380} y={610} className="map-denmark-region-label">FYN</text>
                  <text x={530} y={600} className="map-denmark-region-label">SJÆLLAND</text>
                  <text x={615} y={490} className="map-denmark-region-label-small">HOVEDSTADEN</text>
                  <text x={875} y={660} className="map-denmark-region-label-small">BORNHOLM</text>
                </g>

                {/* Danish City Anchor Markers */}
                {showDkCities &&
                  DANISH_CITIES.map((city) => (
                    <g key={city.id} className="map-denmark-city-pin">
                      <circle cx={city.x} cy={city.y} r={8} className="map-denmark-city-halo" />
                      <circle cx={city.x} cy={city.y} r={3} className="map-denmark-city-dot" />
                      <text
                        x={city.x + 9}
                        y={city.y + 3.5}
                        className="map-denmark-city-label"
                      >
                        {city.name}
                      </text>
                    </g>
                  ))}
              </svg>
            ) : null}

            {/* Helper Hint Pill */}
            <div className="map-hint-pill">
              <MapPin size={13} className="text-emerald-400" />
              <span>🇩🇰 Denmark Map: Drag people to their city or click to set workplace</span>
            </div>

            {/* SVG Connecting Lines */}
            <svg className="map-svg-layer">
              {positionedNodes.map((node) => {
                const isSelected = selectedNode?.customer.id === node.customer.id;
                const isHovered = hoveredNodeId === node.customer.id;
                const isDragging = activeDraggingId === node.customer.id;
                const isHighlighted = isSelected || isHovered || isDragging;

                return (
                  <line
                    key={`line-${node.customer.id}`}
                    x1={activeCenter.x}
                    y1={activeCenter.y}
                    x2={node.x}
                    y2={node.y}
                    className={`map-link-line ${node.hasActiveCases ? "has-active" : ""} ${
                      isHighlighted ? "is-highlighted" : ""
                    }`}
                  />
                );
              })}
            </svg>

            {/* Center Operations Hub */}
            <div
              className={`map-center-hub ${activeDraggingId === "center" ? "is-dragging" : ""}`}
              style={{ left: `${activeCenter.x}px`, top: `${activeCenter.y}px` }}
              onPointerDown={(e) => handlePointerDown(e, "center", undefined, activeCenter.x, activeCenter.y)}
              onPointerMove={handlePointerMove}
              onPointerUp={(e) => handlePointerUp(e)}
              title="Operations Hub HQ (Drag to reposition)"
            >
              <div className="map-hub-core">
                <div className="map-hub-pulse" />
                <BriefcaseBusiness size={28} strokeWidth={2} />
              </div>
              <span className="map-hub-label">Operations HQ</span>
              <span className="map-hub-counter">
                {totalActiveCases} {totalActiveCases === 1 ? "active case" : "active cases"}
              </span>
            </div>

            {/* Customer Nodes */}
            {positionedNodes.map((node) => {
              const isSelected = selectedNode?.customer.id === node.customer.id;
              const isDragging = activeDraggingId === node.customer.id;
              const avatarStyle = getAvatarStyle(node.customer.id);
              const initials = getInitials(node.customer.name);
              const photo = customerAvatars[node.customer.id];
              const nodeAddr =
                customerAddresses[node.customer.id] ||
                (node.customer.name.toLowerCase().includes("zobir") ||
                node.customer.company?.toLowerCase().includes("studio 22")
                  ? "Centrumgaden 22, 2750 Ballerup"
                  : "");
              const matchedFromAddr = nodeAddr ? matchDanishAddressLocation(nodeAddr) : null;
              const nodeLoc =
                customerLocations[node.customer.id] ||
                (matchedFromAddr ? matchedFromAddr.name : null) ||
                (node.customer.name.toLowerCase().includes("zobir") ||
                node.customer.company?.toLowerCase().includes("studio 22")
                  ? "Ballerup / København"
                  : "Danmark");

              return (
                <div
                  key={node.customer.id}
                  className={`map-customer-node ${isSelected ? "is-selected" : ""} ${
                    isDragging ? "is-dragging" : ""
                  }`}
                  style={{ left: `${node.x}px`, top: `${node.y}px` }}
                  onPointerDown={(e) => handlePointerDown(e, "customer", node.customer.id, node.x, node.y)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={(e) => handlePointerUp(e, node)}
                  onMouseEnter={() => setHoveredNodeId(node.customer.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedNode(node);
                    }
                  }}
                  aria-pressed={isSelected}
                  aria-label={`Customer ${node.customer.name} in ${nodeLoc}, drag to move or click to view details`}
                >
                  <div
                    className={`map-node-avatar ${photo ? "has-photo" : ""}`}
                    style={{
                      background: photo ? undefined : avatarStyle.bg,
                      borderColor: avatarStyle.border,
                      boxShadow: isDragging
                        ? `0 0 25px ${avatarStyle.glow}`
                        : undefined,
                    }}
                  >
                    {photo ? (
                      /* User Photo */
                      <img
                        src={photo}
                        alt={node.customer.name}
                        className="map-node-avatar-img"
                      />
                    ) : (
                      /* Initials */
                      <span>{initials}</span>
                    )}

                    <span
                      className={`map-node-badge ${node.cases.length === 0 ? "is-zero" : ""}`}
                      title={`${node.cases.length} total cases`}
                    >
                      {node.cases.length}
                    </span>
                  </div>

                  <div className="map-node-label-box">
                    <span className="map-node-name">{node.customer.name}</span>
                    <span className="map-node-company">
                      {node.customer.company || "Direct Client"}
                    </span>
                    <span className="map-node-location">
                      <MapPin size={9} className="text-emerald-400" />
                      <span>{nodeLoc}</span>
                    </span>
                    {nodeAddr ? (
                      <a
                        href={getGoogleMapsUrl(nodeAddr, nodeLoc)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="map-node-address-link"
                        title={`View where ${node.customer.name} is located (${nodeAddr})`}
                      >
                        <MapPin size={8} className="text-emerald-400 shrink-0" />
                        <span className="truncate">{nodeAddr}</span>
                        <ArrowUpRight size={9} className="shrink-0 text-slate-400" />
                      </a>
                    ) : null}
                  </div>

                  {/* Hover Quick Action Indicator */}
                  <div className="map-node-quick-action">
                    <span>Click for workplace & photo</span>
                  </div>
                </div>
              );
            })}

            {/* Empty State */}
            {positionedNodes.length === 0 ? (
              <div className="map-empty-state">
                <Users className="map-empty-icon" />
                <h3>No people on map yet</h3>
                <p>
                  {search
                    ? `No customers matched "${search}".`
                    : "Add any person or client to build your interactive relationship map."}
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="workspace-button is-primary"
                >
                  <UserPlus size={15} />
                  Add First Person
                </button>
              </div>
            ) : null}
          </div>

          {/* Slide-out Customer Details Drawer with Photo Upload, Location & Address Link */}
          {selectedNode ? (
            <CustomerDetailDrawer
              node={selectedNode}
              photo={customerAvatars[selectedNode.customer.id] || null}
              location={
                customerLocations[selectedNode.customer.id] ||
                (customerAddresses[selectedNode.customer.id]
                  ? matchDanishAddressLocation(customerAddresses[selectedNode.customer.id])?.name || ""
                  : "") ||
                (selectedNode.customer.name.toLowerCase().includes("zobir") ||
                selectedNode.customer.company?.toLowerCase().includes("studio 22")
                  ? "Ballerup / København"
                  : "")
              }
              address={
                customerAddresses[selectedNode.customer.id] ||
                (selectedNode.customer.name.toLowerCase().includes("zobir") ||
                selectedNode.customer.company?.toLowerCase().includes("studio 22")
                  ? "Centrumgaden 22, 2750 Ballerup"
                  : "")
              }
              onSavePhoto={(dataUrl) => handleSaveAvatar(selectedNode.customer.id, dataUrl)}
              onSetLocation={(locName, city) => handleSetLocation(selectedNode.customer.id, locName, city)}
              onSaveAddress={(addr) => handleSaveAddress(selectedNode.customer.id, addr)}
              onClose={() => setSelectedNode(null)}
            />
          ) : null}
        </div>
      ) : (
        /* Face Cards Grid View */
        <div className="map-grid-container">
          {filteredNodes.map((node) => {
            const avatarStyle = getAvatarStyle(node.customer.id);
            const initials = getInitials(node.customer.name);
            const photo = customerAvatars[node.customer.id];
            const nodeAddr =
              customerAddresses[node.customer.id] ||
              (node.customer.name.toLowerCase().includes("zobir") ||
              node.customer.company?.toLowerCase().includes("studio 22")
                ? "Centrumgaden 22, 2750 Ballerup"
                : "");
            const matchedFromAddr = nodeAddr ? matchDanishAddressLocation(nodeAddr) : null;
            const nodeLoc =
              customerLocations[node.customer.id] ||
              (matchedFromAddr ? matchedFromAddr.name : null) ||
              (node.customer.name.toLowerCase().includes("zobir") ||
              node.customer.company?.toLowerCase().includes("studio 22")
                ? "Ballerup / København"
                : "Danmark");

            const custMeta = getCustomerMeta(node.customer.id, node.customer.name, node.customer.company);

            return (
              <div
                key={node.customer.id}
                className="map-face-card"
                onClick={() => setSelectedNode(node)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedNode(node);
                  }
                }}
              >
                <div className="map-face-card-header">
                  <div
                    className={`map-card-avatar ${photo ? "has-photo" : ""}`}
                    style={{
                      background: photo ? undefined : avatarStyle.bg,
                      borderColor: avatarStyle.border,
                    }}
                  >
                    {photo ? (
                      <img
                        src={photo}
                        alt={node.customer.name}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="map-card-info">
                    <strong className="map-card-name">{node.customer.name}</strong>
                    <span className="map-card-company">
                      {node.customer.company || "Direct Client"}
                    </span>
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5 font-medium">
                      <MapPin size={11} /> {nodeLoc}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2 truncate">
                    <Mail size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate">{node.customer.email}</span>
                  </div>
                  {node.customer.phone ? (
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-slate-400 shrink-0" />
                      <span>{node.customer.phone}</span>
                    </div>
                  ) : null}

                  {nodeAddr ? (
                    <a
                      href={getGoogleMapsUrl(nodeAddr, nodeLoc)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="map-card-address-link"
                      title={`View where ${node.customer.name} is located on Google Maps`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin size={11} className="text-emerald-400 shrink-0" />
                        <span className="truncate font-medium">{nodeAddr}</span>
                      </div>
                      <span className="map-card-address-tag">
                        Maps <ArrowUpRight size={11} />
                      </span>
                    </a>
                  ) : null}
                </div>

                {/* Deliverables & Notes Summary */}
                {custMeta.deliverables.length > 0 || custMeta.techStack.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/60">
                    {custMeta.deliverables.slice(0, 2).map((d) => {
                      const cat = DELIVERABLE_CATEGORIES[d.category] || DELIVERABLE_CATEGORIES.custom;
                      return (
                        <span
                          key={d.id}
                          className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1"
                          title={`${d.title} (${cat.label})`}
                        >
                          <span>{cat.icon}</span>
                          <span className="truncate max-w-[100px]">{d.title}</span>
                        </span>
                      );
                    })}
                    {custMeta.deliverables.length > 2 ? (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-400 border border-emerald-800/50">
                        +{custMeta.deliverables.length - 2}
                      </span>
                    ) : null}
                    {custMeta.notes.length > 0 ? (
                      <span
                        className="text-[10px] text-slate-400 flex items-center gap-0.5 ml-auto"
                        title={`${custMeta.notes.length} internal notes`}
                      >
                        📝 {custMeta.notes.length}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <div className="map-card-meta">
                  <span
                    className={`map-card-case-badge ${node.hasActiveCases ? "active" : "none"}`}
                  >
                    <BriefcaseBusiness size={12} />
                    {node.activeCasesCount} active {node.activeCasesCount === 1 ? "case" : "cases"}
                  </span>
                  <span className="text-emerald-400 text-xs font-medium hover:underline inline-flex items-center gap-0.5">
                    View Info & Photo <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            );
          })}

          {filteredNodes.length === 0 ? (
            <div className="col-span-full map-empty-state">
              <Users className="map-empty-icon" />
              <h3>No customers found</h3>
              <p>Try adjusting your search or filters.</p>
            </div>
          ) : null}

          {/* Drawer also accessible in grid view */}
          {selectedNode ? (
            <CustomerDetailDrawer
              node={selectedNode}
              photo={customerAvatars[selectedNode.customer.id] || null}
              location={
                customerLocations[selectedNode.customer.id] ||
                (customerAddresses[selectedNode.customer.id]
                  ? matchDanishAddressLocation(customerAddresses[selectedNode.customer.id])?.name || ""
                  : "") ||
                (selectedNode.customer.name.toLowerCase().includes("zobir") ||
                selectedNode.customer.company?.toLowerCase().includes("studio 22")
                  ? "Ballerup / København"
                  : "")
              }
              address={
                customerAddresses[selectedNode.customer.id] ||
                (selectedNode.customer.name.toLowerCase().includes("zobir") ||
                selectedNode.customer.company?.toLowerCase().includes("studio 22")
                  ? "Centrumgaden 22, 2750 Ballerup"
                  : "")
              }
              onSavePhoto={(dataUrl) => handleSaveAvatar(selectedNode.customer.id, dataUrl)}
              onSetLocation={(locName, city) => handleSetLocation(selectedNode.customer.id, locName, city)}
              onSaveAddress={(addr) => handleSaveAddress(selectedNode.customer.id, addr)}
              onClose={() => setSelectedNode(null)}
            />
          ) : null}
        </div>
      )}

      {/* Add Person Modal */}
      {isAddModalOpen ? (
        <AddPersonModal
          onClose={() => setIsAddModalOpen(false)}
          onPersonAdded={(newNode, photoUrl, locationName, targetCity, addressStr) => {
            setNodes((prev) => [newNode, ...prev]);
            if (photoUrl) {
              handleSaveAvatar(newNode.customer.id, photoUrl);
            }
            if (addressStr) {
              handleSaveAddress(newNode.customer.id, addressStr);
            } else if (locationName) {
              handleSetLocation(newNode.customer.id, locationName, targetCity);
            }
            setSelectedNode(newNode);
            setIsAddModalOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function CustomerDetailDrawer({
  node,
  photo,
  location,
  address,
  onSavePhoto,
  onSetLocation,
  onSaveAddress,
  onClose,
}: {
  node: CustomerMapNode;
  photo: string | null;
  location: string;
  address: string;
  onSavePhoto: (dataUrl: string | null) => void;
  onSetLocation: (locationName: string, targetCity?: DanishCity) => void;
  onSaveAddress: (address: string) => void;
  onClose: () => void;
}) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const avatarStyle = getAvatarStyle(node.customer.id);
  const initials = getInitials(node.customer.name);

  const currentAddress =
    address ||
    (node.customer.name.toLowerCase().includes("zobir") ||
    node.customer.company?.toLowerCase().includes("studio 22")
      ? "Centrumgaden 22, 2750 Ballerup"
      : "");

  const [addrInput, setAddrInput] = useState(currentAddress);
  const [isSaved, setIsSaved] = useState(false);

  // Customer Deliverables, Tech Stack & Notes metadata
  const [meta, setMeta] = useState<CustomerMeta>(() =>
    getCustomerMeta(node.customer.id, node.customer.name, node.customer.company)
  );

  useEffect(() => {
    setMeta(getCustomerMeta(node.customer.id, node.customer.name, node.customer.company));
  }, [node.customer.id, node.customer.name, node.customer.company]);

  function handleUpdateMeta(newMeta: CustomerMeta) {
    setMeta(newMeta);
    const all = loadAllCustomerMeta();
    all[node.customer.id] = newMeta;
    saveAllCustomerMeta(all);
  }

  useEffect(() => {
    setAddrInput(
      address ||
      (node.customer.name.toLowerCase().includes("zobir") ||
      node.customer.company?.toLowerCase().includes("studio 22")
        ? "Centrumgaden 22, 2750 Ballerup"
        : "")
    );
  }, [address, node.customer.id, node.customer.name, node.customer.company]);

  function handleSaveAddressClick() {
    const val = addrInput.trim();
    onSaveAddress(val);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  }

  function copyEmail() {
    navigator.clipboard.writeText(node.customer.email).then(() => {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const dataUrl = await processAvatarImage(file, 220);
      onSavePhoto(dataUrl);
    } catch {
      alert("Failed to process image. Please try another image.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  const effectiveLocation =
    location ||
    (currentAddress ? matchDanishAddressLocation(currentAddress)?.name || "" : "") ||
    (node.customer.name.toLowerCase().includes("zobir") ||
    node.customer.company?.toLowerCase().includes("studio 22")
      ? "Ballerup / København"
      : "Danmark");

  return (
    <aside className="map-drawer" aria-label={`Details for ${node.customer.name}`}>
      {/* Header */}
      <div className="map-drawer-header">
        <div className="map-drawer-profile">
          <div className="relative group">
            <div
              className={`map-drawer-avatar ${photo ? "has-photo" : ""}`}
              style={{
                background: photo ? undefined : avatarStyle.bg,
                borderColor: avatarStyle.border,
              }}
            >
              {photo ? (
                <img
                  src={photo}
                  alt={node.customer.name}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>

            {/* Quick Upload Icon on Avatar */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="map-avatar-camera-btn"
              title="Change Picture"
              aria-label="Upload picture"
            >
              <Camera size={13} />
            </button>
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-100">{node.customer.name}</h3>
            <p className="text-xs text-emerald-400 font-medium">
              {node.customer.company || "Direct Client"}
            </p>
            <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
              <MapPin size={11} className="text-emerald-400" />
              {effectiveLocation}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="map-drawer-close"
          aria-label="Close drawer"
        >
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="map-drawer-body">
        {/* Photo Management Section */}
        <section className="map-photo-section">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
            aria-hidden="true"
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="workspace-button small-button flex-1 justify-center"
            >
              <Upload size={13} />
              {isUploading ? "Processing…" : photo ? "Change Picture" : "Add Picture"}
            </button>

            {photo ? (
              <button
                type="button"
                onClick={() => onSavePhoto(null)}
                className="workspace-button small-button text-rose-400 hover:text-rose-300"
                title="Remove Picture"
              >
                <Trash2 size={13} />
              </button>
            ) : null}
          </div>
        </section>

        {/* Work Location in Denmark Section */}
        <section className="map-info-section">
          <div className="flex items-center justify-between mb-1.5">
            <h4>Workplace in Denmark</h4>
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
              <MapPin size={12} />
              {effectiveLocation}
            </span>
          </div>

          <p className="text-xs text-slate-400 mb-2.5">
            Where in Denmark does {node.customer.name} work? Click a city to position them on the Denmark map:
          </p>

          <div className="map-city-chips">
            {DANISH_CITIES.map((c) => {
              const isSelected =
                effectiveLocation === c.name ||
                effectiveLocation === c.id ||
                effectiveLocation.toLowerCase().includes(c.name.toLowerCase());

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSetLocation(c.name, c)}
                  className={`map-city-chip ${isSelected ? "is-selected" : ""}`}
                  title={`Place in ${c.name} (${c.region})`}
                >
                  <MapPin size={11} className={isSelected ? "text-emerald-300" : "text-slate-400"} />
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Customer Physical Address & Live Location Link Section */}
        <section className="map-info-section map-address-section">
          <div className="flex items-center justify-between mb-1.5">
            <h4>Address &amp; Location Link</h4>
            {currentAddress ? (
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <Check size={12} />
                Live Link Ready
              </span>
            ) : null}
          </div>

          {currentAddress ? (
            <div className="map-address-display-card">
              <div className="map-address-card-top">
                <div className="map-address-pin-badge">
                  <MapPin size={15} className="text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="map-address-text truncate">{currentAddress}</span>
                  <span className="map-address-city-hint">
                    📍 {effectiveLocation || "Danmark"}
                  </span>
                </div>
              </div>

              {/* High-visibility clickable link: "View where [Name] is located" */}
              <a
                href={getGoogleMapsUrl(currentAddress, effectiveLocation)}
                target="_blank"
                rel="noopener noreferrer"
                className="map-address-link-btn"
                title={`Open ${currentAddress} on Google Maps in a new tab`}
              >
                <div className="map-address-btn-icon">
                  <MapIcon size={16} />
                </div>
                <div className="map-address-btn-text">
                  <span className="map-address-btn-title">
                    View where {node.customer.name} is located
                  </span>
                  <span className="map-address-btn-subtitle">
                    Open in Google Maps
                  </span>
                </div>
                <ArrowUpRight size={17} className="map-address-btn-arrow" />
              </a>

              {/* Other Maps Navigation */}
              <div className="map-address-alt-links">
                <span className="text-[11px] text-slate-500">Other maps:</span>
                <div className="flex items-center gap-2.5">
                  <a
                    href={getAppleMapsUrl(currentAddress, effectiveLocation)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="map-alt-link"
                    title="Open in Apple Maps"
                  >
                    Apple Maps <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            </div>
          ) : null}

          {/* Address Edit / Add Input */}
          <div className="map-address-form">
            <label className="text-[11px] text-slate-400 font-medium block mb-1">
              {currentAddress ? "Change or update address:" : "Add customer Danish address:"}
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={addrInput}
                  onChange={(e) => setAddrInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSaveAddressClick();
                    }
                  }}
                  placeholder="e.g. Centrumgaden 22, 2750 Ballerup"
                  className="map-input text-xs pr-7"
                />
                <MapPin size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
              <button
                type="button"
                onClick={handleSaveAddressClick}
                className="workspace-button small-button is-primary"
                title="Save address and position on map"
              >
                {isSaved ? <Check size={13} /> : <Save size={13} />}
                <span>{isSaved ? "Saved" : "Save"}</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
              Entering an address creates a live navigation link and automatically positions {node.customer.name} on the Denmark map.
            </p>
          </div>
        </section>

        {/* Customer Deliverables ('What We Did'), Tech Stack ('Stuff Used') & Notes */}
        <CustomerMetaSection
          customerId={node.customer.id}
          customerName={node.customer.name}
          meta={meta}
          onUpdateMeta={handleUpdateMeta}
        />

        {/* Contact Info */}
        <section className="map-info-section">
          <h4>Customer Information</h4>
          <div className="map-contact-list">
            <div className="map-contact-item">
              <a href={`mailto:${node.customer.email}`} className="map-contact-link">
                <Mail size={14} />
                <span className="truncate">{node.customer.email}</span>
              </a>
              <button
                type="button"
                onClick={copyEmail}
                className="map-copy-btn"
                title="Copy email"
                aria-label="Copy email address"
              >
                {copiedEmail ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>

            {node.customer.phone ? (
              <div className="map-contact-item">
                <a href={`tel:${node.customer.phone}`} className="map-contact-link">
                  <Phone size={14} />
                  <span>{node.customer.phone}</span>
                </a>
              </div>
            ) : null}

            <div className="map-contact-item text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Calendar size={13} />
                Customer ID #{node.customer.id} · Created
              </span>
              <span>{new Date(node.customer.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </section>

        {/* Linked Cases */}
        <section className="map-info-section">
          <div className="flex items-center justify-between mb-2">
            <h4>Connected Cases ({node.cases.length})</h4>
            <Link
              href={`/cases?customerId=${node.customer.id}`}
              className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
            >
              All cases <ExternalLink size={11} />
            </Link>
          </div>

          <div className="map-cases-list">
            {node.cases.length === 0 ? (
              <div className="p-3 bg-slate-900/60 rounded border border-slate-800 text-xs text-slate-400 text-center">
                No active work cases.
              </div>
            ) : (
              node.cases.map((c) => (
                <Link key={c.id} href={`/cases/${c.id}`} className="map-case-item">
                  <div className="map-case-header">
                    <span className="map-case-title truncate">{c.title}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        c.status === "Open"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          : c.status === "InProgress"
                          ? "bg-amber-950 text-amber-400 border border-amber-800"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {caseStatusLabel(c.status)}
                    </span>
                  </div>
                  {c.description ? (
                    <p className="map-case-desc line-clamp-2">{c.description}</p>
                  ) : null}
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Footer Quick Actions */}
      <div className="map-drawer-footer">
        <Link
          href={`/customers/${node.customer.id}`}
          className="workspace-button is-primary justify-center w-full"
        >
          Open Customer Profile
          <ArrowRight size={14} />
        </Link>
        <Link
          href={`/cases?customerId=${node.customer.id}`}
          className="workspace-button justify-center w-full"
        >
          <BriefcaseBusiness size={14} />
          View Cases
        </Link>
      </div>
    </aside>
  );
}

function AddPersonModal({
  onClose,
  onPersonAdded,
}: {
  onClose: () => void;
  onPersonAdded: (
    newNode: CustomerMapNode,
    photoUrl: string | null,
    locationName: string,
    targetCity?: DanishCity,
    address?: string
  ) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [cityId, setCityId] = useState("taarnby");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processAvatarImage(file, 220);
      setPhotoPreview(dataUrl);
    } catch {
      alert("Failed to load picture.");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await addPersonFromMapAction({
        name: name.trim(),
        email: email.trim(),
        company: company.trim() || null,
        phone: phone.trim() || null,
      });

      if (res.status === "error") {
        setError(res.message);
        return;
      }

      const newNode: CustomerMapNode = {
        customer: res.customer,
        cases: [],
        activeCasesCount: 0,
        hasActiveCases: false,
        latestCaseTitle: null,
      };

      const selectedCity = DANISH_CITIES.find((c) => c.id === cityId) || DANISH_CITIES[0];
      onPersonAdded(
        newNode,
        photoPreview,
        selectedCity.name,
        selectedCity,
        address.trim() || undefined
      );
    });
  }

  return (
    <div className="map-modal-backdrop" onClick={onClose}>
      <div className="map-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="map-modal-header">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
              <UserPlus size={16} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Add Person to Map</h3>
              <p className="text-xs text-slate-400">Add a client or person directly to your network.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="map-drawer-close" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="map-modal-body">
          {error ? <div className="map-form-error">{error}</div> : null}

          {/* Picture Picker */}
          <div className="flex flex-col items-center gap-2 mb-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFile}
              accept="image/*"
              className="hidden"
            />
            <div
              className="map-modal-avatar-preview"
              onClick={() => fileInputRef.current?.click()}
              title="Click to select a photo"
            >
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <Camera size={24} className="mb-1 text-slate-400" />
                  <span className="text-[10px] font-medium text-emerald-400">Add Photo</span>
                </div>
              )}
            </div>
            {photoPreview ? (
              <button
                type="button"
                onClick={() => setPhotoPreview(null)}
                className="text-xs text-rose-400 hover:underline"
              >
                Remove photo
              </button>
            ) : (
              <span className="text-[11px] text-slate-500">Optional: Click circle to choose picture</span>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="map-label">Full Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Zobir, Aleksandra, or Company contact"
                className="map-input"
              />
            </div>

            <div>
              <label className="map-label">Email Address *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. name@studio22.dk"
                className="map-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="map-label">Company / Role</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Studio 22 Frisør"
                  className="map-input"
                />
              </div>

              <div>
                <label className="map-label">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +45 12 34 56 78"
                  className="map-input"
                />
              </div>
            </div>

            <div>
              <label className="map-label">Customer Physical Address (Adresse i Danmark)</label>
              <div className="relative">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAddress(val);
                    const matched = matchDanishAddressLocation(val);
                    if (matched) {
                      setCityId(matched.id);
                    }
                  }}
                  placeholder="e.g. Centrumgaden 22, 2750 Ballerup"
                  className="map-input pr-8"
                />
                <MapPin size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Entering an address automatically locates them on the Denmark map and generates live location navigation links.
              </p>
              {address.trim() ? (
                <div className="mt-1.5 p-2 bg-emerald-950/40 border border-emerald-800/50 rounded flex items-center justify-between text-xs text-emerald-300">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={13} className="text-emerald-400" />
                    <span>Auto-selected: {DANISH_CITIES.find((c) => c.id === cityId)?.name || "Denmark"}</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                    Live link ready
                  </span>
                </div>
              ) : null}
            </div>

            <div>
              <label className="map-label">Workplace in Denmark (By i Danmark)</label>
              <select
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                className="map-input cursor-pointer"
              >
                {DANISH_CITIES.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-slate-100">
                    {c.name} ({c.region})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="map-modal-footer">
            <button type="button" onClick={onClose} className="workspace-button" disabled={isPending}>
              Cancel
            </button>
            <button type="submit" className="workspace-button is-primary" disabled={isPending}>
              {isPending ? "Adding…" : "Add Person"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
