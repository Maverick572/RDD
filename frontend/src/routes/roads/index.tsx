import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import {
  ArrowUpDown,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Filter,
  Images,
  Layers,
  MapPin,
  Search,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PriorityBadge, RhiBadge } from "@/components/road/RhiBadge";
import { useAreaFilter } from "@/hooks/useAreaFilter";
import { formatDate, rhiBand, RHI_HEX } from "@/lib/rhi";
import { roadsService } from "@/services/roads.service";
import type { RhiBand, Road } from "@/types";

export const Route = createFileRoute("/roads/")({
  component: RoadsListPage,
});

function RoadsListPage() {
  const areaFilter = useAreaFilter();
  const [roads, setRoads] = useState<Road[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedBand, setSelectedBand] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"rhi_asc" | "rhi_desc" | "defects_desc" | "length_desc">("rhi_asc");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    roadsService
      .getRoads({
        stateId: areaFilter.stateId,
        districtId: areaFilter.districtId,
        cityId: areaFilter.cityId,
      })
      .then(setRoads)
      .finally(() => setLoading(false));
  }, [areaFilter.stateId, areaFilter.districtId, areaFilter.cityId]);

  const filteredRoads = roads
    .filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        const matches =
          r.code.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (selectedCategory !== "all" && r.category !== selectedCategory) {
        return false;
      }
      if (selectedBand !== "all" && rhiBand(r.rhi) !== selectedBand) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "rhi_asc") return a.rhi - b.rhi;
      if (sortBy === "rhi_desc") return b.rhi - a.rhi;
      if (sortBy === "defects_desc") return b.defectCount - a.defectCount;
      if (sortBy === "length_desc") return b.lengthKm - a.lengthKm;
      return 0;
    });

  return (
    <AppShell
      areaFilter={areaFilter}
      title="Road Network Corridors"
      subtitle="Comprehensive registry of highway & municipal corridors with AI health ratings"
    >
      <div className="space-y-4 p-4 lg:p-6">
        {/* Filter / Search Bar */}
        <div className="panel p-4 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search code or corridor name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Category */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="National Highway">National Highway</option>
              <option value="State Highway">State Highway</option>
              <option value="Arterial">Arterial</option>
              <option value="Sub-arterial">Sub-arterial</option>
              <option value="Collector">Collector</option>
            </select>

            {/* Condition Band */}
            <select
              value={selectedBand}
              onChange={(e) => setSelectedBand(e.target.value)}
              className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground cursor-pointer"
            >
              <option value="all">All Conditions</option>
              <option value="good">Good (≥ 75)</option>
              <option value="fair">Fair (50–74)</option>
              <option value="poor">Poor (30–49)</option>
              <option value="critical">Critical (&lt; 30)</option>
            </select>

            {/* Sorting */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground cursor-pointer"
            >
              <option value="rhi_asc">Worst Health (RHI Asc)</option>
              <option value="rhi_desc">Best Health (RHI Desc)</option>
              <option value="defects_desc">Most Defects</option>
              <option value="length_desc">Longest Length</option>
            </select>

            <span className="text-xs text-muted-foreground font-mono ml-auto">
              {filteredRoads.length} corridors
            </span>
          </div>
        </div>

        {/* Roads Grid / Table */}
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Corridor</th>
                  <th className="px-4 py-3">Category / Surface</th>
                  <th className="px-4 py-3">Geometry</th>
                  <th className="px-4 py-3">Health Index (RHI)</th>
                  <th className="px-4 py-3">Distress</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Last Inspected</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredRoads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      No road corridors match your current filters.
                    </td>
                  </tr>
                ) : (
                  filteredRoads.map((road) => {
                    const band = rhiBand(road.rhi);
                    const color = RHI_HEX[band];
                    return (
                      <tr
                        key={road.id}
                        className="hover:bg-muted/40 transition-colors group"
                      >
                        <td className="px-4 py-3">
                          <Link
                            to="/roads/$id"
                            params={{ id: road.id }}
                            className="font-bold font-mono text-foreground hover:text-primary transition-colors block"
                          >
                            {road.code}
                          </Link>
                          <span className="text-xs text-foreground/80 font-medium line-clamp-1">
                            {road.name}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-muted-foreground">
                          <div className="font-medium text-foreground">
                            {road.category}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {road.surface}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-mono font-medium text-foreground">
                            {road.lengthKm} km
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {road.lanes} Lanes
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="font-mono text-base font-bold"
                              style={{ color }}
                            >
                              {road.rhi}
                            </span>
                            <RhiBadge rhi={road.rhi} showScore={false} size="sm" />
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`font-mono font-bold ${
                              road.defectCount > 8
                                ? "text-rose-600"
                                : "text-foreground"
                            }`}
                          >
                            {road.defectCount}
                          </span>
                          <span className="text-[11px] text-muted-foreground ml-1">
                            defects
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <PriorityBadge priority={road.priority} />
                        </td>

                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(road.lastInspection)}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              to="/gallery"
                              search={{ roadId: road.id }}
                              className="rounded p-1.5 text-muted-foreground hover:text-primary hover:bg-muted"
                              title="Inspection Gallery"
                            >
                              <Images className="h-4 w-4" />
                            </Link>
                            <Link
                              to="/roads/$id"
                              params={{ id: road.id }}
                              className="flex items-center gap-1 rounded bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                            >
                              <span>Details</span>
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
