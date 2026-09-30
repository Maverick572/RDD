import React, { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  ChevronRight,
  Cpu,
  Globe2,
  Images,
  Layers,
  LayoutDashboard,
  Menu,
  RotateCcw,
  Route,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { CityArea, DistrictArea, StateArea } from "@/types";

interface AppShellProps {
  children: React.ReactNode;
  areaFilter?: {
    stateId?: string;
    districtId?: string;
    cityId?: string;
    states?: StateArea[];
    districts?: DistrictArea[];
    cities?: CityArea[];
    setStateId?: (id: string | undefined) => void;
    setDistrictId?: (id: string | undefined) => void;
    setCityId?: (id: string | undefined) => void;
    resetFilter?: () => void;
  };
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  areaFilter,
  title,
  subtitle,
  actions,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Road Network", href: "/roads", icon: Route },
    { label: "Inspection Gallery", href: "/gallery", icon: Images },
    { label: "Defect Registry", href: "/defects", icon: AlertTriangle },
    { label: "Media Processing", href: "/media", icon: Cpu },
    { label: "Maintenance", href: "/maintenance", icon: CalendarCheck },
    { label: "Analytics", href: "/analytics", icon: BarChart3 },
  ];

  const currentPath = location.pathname;

  return (
    <div className="flex min-h-screen bg-background text-foreground antialiased">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        {/* Brand header */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-xs">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold tracking-tight text-sidebar-accent-foreground text-base">
                <span>RoadSense</span>
              </div>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded p-1 text-sidebar-foreground hover:bg-sidebar-accent lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? currentPath === "/"
                : currentPath === item.href || currentPath.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-xs"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 transition-colors ${isActive
                    ? "text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground"
                    }`}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Container */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 backdrop-blur-xs px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div>
              {title && (
                <h1 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Area Breadcrumbs & Filters */}
          <div className="flex items-center gap-3">
            {areaFilter && areaFilter.states && (
              <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border bg-background p-1 text-xs shadow-2xs">
                <div className="flex items-center gap-1 px-2 text-muted-foreground">
                  <Globe2 className="h-3.5 w-3.5" />
                  <span className="font-medium">Area:</span>
                </div>

                {/* State selector */}
                <select
                  value={areaFilter.stateId || ""}
                  onChange={(e) => areaFilter.setStateId?.(e.target.value || undefined)}
                  className="rounded bg-muted/60 px-2 py-1 text-xs font-medium text-foreground outline-none hover:bg-muted focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="">All India (5 States)</option>
                  {areaFilter.states.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>

                {/* District selector */}
                {areaFilter.stateId && areaFilter.districts && (
                  <>
                    <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                    <select
                      value={areaFilter.districtId || ""}
                      onChange={(e) =>
                        areaFilter.setDistrictId?.(e.target.value || undefined)
                      }
                      className="rounded bg-muted/60 px-2 py-1 text-xs font-medium text-foreground outline-none hover:bg-muted focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <option value="">All Districts</option>
                      {areaFilter.districts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                {/* City selector */}
                {areaFilter.districtId && areaFilter.cities && (
                  <>
                    <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                    <select
                      value={areaFilter.cityId || ""}
                      onChange={(e) =>
                        areaFilter.setCityId?.(e.target.value || undefined)
                      }
                      className="rounded bg-muted/60 px-2 py-1 text-xs font-medium text-foreground outline-none hover:bg-muted focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <option value="">All Municipalities</option>
                      {areaFilter.cities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                {(areaFilter.stateId || areaFilter.districtId || areaFilter.cityId) && (
                  <button
                    onClick={areaFilter.resetFilter}
                    title="Reset to All India"
                    className="flex items-center gap-1 rounded bg-secondary px-2 py-1 text-[11px] font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                )}
              </div>
            )}

            {actions}
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};
