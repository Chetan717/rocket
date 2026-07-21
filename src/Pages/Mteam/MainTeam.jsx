import React, { useState, useCallback } from "react";
import MarketingTeam from "./Marketingteam";
import CouponCodeManager from "./CouponCodeManager";

const TABS = [
  {
    id: "marketing",
    label: "Marketing Team",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    component: MarketingTeam,
  },
  {
    id: "coupons",
    label: "Coupon Manager",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
    component: CouponCodeManager,
  },
];

export default function MainTeam() {
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const handleTabChange = useCallback((id) => { setActiveTab(id); }, []);
  const ActiveComponent = TABS.find((t) => t.id === activeTab)?.component;

  return (
    <>
      <style>{`
        .mt-root { min-height: 100vh; background: #ffffff; font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .mt-tabbar { position: sticky; top: 0; z-index: 50; background: rgba(255,255,255,0.92); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(0,0,0,0.06); padding: 0 24px; display: flex; align-items: stretch; gap: 4px; }
        .mt-tab { position: relative; display: inline-flex; align-items: center; gap: 8px; padding: 16px 20px 14px; font-size: 13.5px; font-weight: 500; color: #6b7280; background: none; border: none; cursor: pointer; transition: color 0.2s; white-space: nowrap; outline: none; border-bottom: 2px solid transparent; margin-bottom: -1px; }
        .mt-tab:hover { color: #374151; }
        .mt-tab.active { color: #f97316; border-bottom-color: #f97316; }
        .mt-tab .mt-tab-icon { opacity: 0.7; transition: opacity 0.2s; }
        .mt-tab.active .mt-tab-icon, .mt-tab:hover .mt-tab-icon { opacity: 1; }
        .mt-panel { animation: mt-fadein 0.22s ease both; }
        @keyframes mt-fadein { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .mt-tab:focus-visible { outline: 2px solid #f97316; outline-offset: -2px; border-radius: 4px; }
      `}</style>
      <div className="mt-root">
        <nav className="mt-tabbar" role="tablist">
          {TABS.map((tab) => (
            <button key={tab.id} role="tab" aria-selected={activeTab === tab.id}
              className={`mt-tab${activeTab === tab.id ? " active" : ""}`}
              onClick={() => handleTabChange(tab.id)}>
              <span className="mt-tab-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
        <div key={activeTab} className="mt-panel">
          {ActiveComponent && <ActiveComponent />}
        </div>
      </div>
    </>
  );
}
