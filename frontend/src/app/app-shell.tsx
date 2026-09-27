"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Aperture, ArrowUpRight, BarChart3, BriefcaseBusiness, ChevronDown, CircleHelp, Cpu, LayoutDashboard, Menu, Search, Settings2, Users, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

type NavKey = "overview" | "customers" | "cases";
const links = [
  { key: "overview", href: "/", label: "Dashboard", icon: LayoutDashboard },
  { key: "customers", href: "/customers", label: "Customers", icon: Users },
  { key: "cases", href: "/cases", label: "Cases", icon: BriefcaseBusiness },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const current: NavKey = pathname.startsWith("/customers") ? "customers" : pathname.startsWith("/cases") ? "cases" : "overview";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (menuOpen) menuRef.current?.showModal();
    else menuRef.current?.close();
  }, [menuOpen]);
  function closeMenu() { setMenuOpen(false); menuButton.current?.focus(); }

  return (
    <div className="operations-shell">
      <a className="skip-link" href="#workspace-content">Skip to content</a>
      <aside className="operations-sidebar" aria-label="Application">
        <Brand />
        <SiteNav current={current} className="workspace-nav" />
        <SidebarLinks />
        <div className="sidebar-bottom"><span className="connection-dot" />Local workspace<span className="sidebar-version">v1.0</span></div>
      </aside>
      <div className="operations-body">
        <header className="workspace-topbar">
          <button ref={menuButton} className="icon-button mobile-menu-toggle" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={20} /></button>
          <form action={current === "overview" ? "/" : "/customers"} className="workspace-search" role="search">
            <Search size={17} aria-hidden="true" />
            <input key={pathname} name={current === "overview" ? "q" : "search"} aria-label="Search customers" placeholder="Search customers…" type="search" />
            <button type="submit" aria-label="Submit customer search"><ArrowUpRight size={15} /></button>
          </form>
          <div className="topbar-right">
            <Link href="/cases" className="icon-button topbar-cases" aria-label="View cases"><BriefcaseBusiness size={18} /></Link>
            <span className="topbar-divider" />
            <details className="workspace-account">
              <summary><span className="workspace-avatar"><Users size={17} /></span><span className="workspace-account-label">My workspace</span><ChevronDown size={13} /></summary>
              <div className="workspace-popover"><strong>Your local workspace</strong><p>Manage your customers, cases, and tasks in one place.</p><span>Sign-in and notifications are not connected yet.</span></div>
            </details>
          </div>
        </header>
        <div id="workspace-content" tabIndex={-1} className="workspace-content">{children}</div>
      </div>
      <dialog ref={menuRef} className="mobile-navigation" onCancel={() => setMenuOpen(false)} onClose={() => setMenuOpen(false)}>
        <div className="mobile-navigation-heading"><Brand /><button className="icon-button" aria-label="Close navigation" onClick={closeMenu}><X size={20} /></button></div>
        <SiteNav current={current} className="workspace-nav" onNavigate={closeMenu} />
        <SidebarLinks onNavigate={closeMenu} />
      </dialog>
    </div>
  );
}

function Brand() {
  return <Link href="/" className="workspace-brand"><Aperture size={29} strokeWidth={2.3} aria-hidden="true" /><span>Operations Hub</span></Link>;
}

export function SiteNav({ current, className, onNavigate }: { current: NavKey; className?: string; onNavigate?: () => void }) {
  return <nav aria-label="Sections" className={className ?? "workspace-inline-nav"}>{links.map(({ key, href, label, icon: Icon }) => <Link key={key} href={href} onClick={onNavigate} aria-current={current === key ? "page" : undefined} className={`workspace-nav-link${current === key ? " is-active" : ""}`}><Icon size={19} strokeWidth={1.5} aria-hidden="true" /><span>{label}</span></Link>)}</nav>;
}

function SidebarLinks({ onNavigate }: { onNavigate?: () => void }) {
  return <div className="workspace-secondary-nav">
    <Link className="workspace-nav-link" href="/#business-kpis" onClick={onNavigate}><BarChart3 size={19} strokeWidth={1.5} />Business KPIs</Link>
    <Link className="workspace-nav-link" href="/#assistant-workspace" onClick={onNavigate}><Cpu size={19} strokeWidth={1.5} />AI assistant<span className="nav-soon">Soon</span></Link>
    <details className="workspace-settings"><summary className="workspace-nav-link"><Settings2 size={19} strokeWidth={1.5} />Workspace info</summary><p><CircleHelp size={15} />This is a local workspace. Account settings will be available when sign-in is added.</p></details>
  </div>;
}
