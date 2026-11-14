import { NavLink, Outlet, useLocation } from "react-router-dom";
import { clearAuth } from "../lib/auth";

const groups = [
    {
        title: "Workspace",
        links: [
            ["/", "Overview", "◫"],
            ["/orders", "Orders", "▤"],
            ["/shipments", "Shipments", "⇄"],
            ["/estimates", "Landed cost", "◈"],
        ],
    },
    {
        title: "Configuration",
        links: [
            ["/customers", "Customers", "♙"],
            ["/products", "Products", "▦"],
            ["/destinations", "Destinations", "◎"],
            ["/rules", "Duty & tax rules", "⌘"],
            ["/exchange-rates", "Exchange rates", "↗"],
        ],
    },
    {
        title: "Shipment operations",
        links: [
            ["/documents", "Documents & events", "▧"],
            ["/exceptions", "Exceptions", "⚑"],
        ],
    },
] as const;
const pageNames: Record<string, string> = {
    "/": "Overview",
    "/orders": "Orders",
    "/shipments": "Shipments",
    "/estimates": "Landed cost",
    "/customers": "Customers",
    "/products": "Products",
    "/destinations": "Destinations",
    "/rules": "Duty & tax rules",
    "/exchange-rates": "Exchange rates",
    "/documents": "Documents & events",
    "/exceptions": "Exceptions",
};

export default function Layout() {
    const location = useLocation();
    const title = pageNames[location.pathname] || "Workspace";
    return (
        <div className="app-shell">
            <aside className="sidebar">
                <div className="brand-lockup">
                    <div className="brand-mark">C</div>
                    <div>
                        <div className="brand">CrossTrade</div>
                        <div className="brand-sub">
                            CAP-22 · Data operations
                        </div>
                    </div>
                </div>
                <div className="workspace-label">WORKSPACE</div>
                <nav className="side-nav">
                    {groups.map((group) => (
                        <div className="nav-group" key={group.title}>
                            <div className="nav-group-title">{group.title}</div>
                            {group.links.map(([to, label, icon]) => (
                                <NavLink
                                    key={to}
                                    to={to}
                                    end={to === "/"}
                                    className={({ isActive }) =>
                                        isActive
                                            ? "nav-link active"
                                            : "nav-link"
                                    }
                                >
                                    <span className="nav-icon">{icon}</span>
                                    <span>{label}</span>
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    <div className="environment">
                        <span className="status-dot" /> Local environment
                    </div>
                    <button
                        className="logout-button"
                        onClick={() => {
                            clearAuth();
                            window.location.href = "/";
                        }}
                    >
                        Sign out
                    </button>
                </div>
            </aside>
            <main className="main-area">
                <header className="topbar">
                    <div>
                        <div className="eyebrow">CAP-22 / OPERATIONS</div>
                        <div className="topbar-title">{title}</div>
                    </div>
                    <div className="topbar-right">
                        <span className="api-status">
                            <span className="status-dot" /> API workspace
                        </span>
                    </div>
                </header>
                <div className="page-content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
