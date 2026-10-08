import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  User,
  ShieldCheck,
  Building2,
  AlertTriangle,
  Languages,
  LayoutDashboard,
  FileText
} from 'lucide-react';

export default function Layout() {
  const [role, setRole] = useState('citizen'); // 'citizen' | 'officer'
  const navigate = useNavigate();

  const handleRoleToggle = (newRole) => {
    setRole(newRole);
    if (newRole === 'citizen') {
      navigate('/');
    } else {
      navigate('/officer');
    }
  };

  const navItems = [
    { name: 'Citizen Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Officer Dashboard', path: '/officer', icon: Building2 },
    { name: 'Complaint Detail', path: '/complaints/CPG-2026-00101', icon: FileText },
    { name: 'Incident Cluster', path: '/incident', icon: ShieldAlert },
    { name: 'Neglect Radar', path: '/neglect-radar', icon: AlertTriangle },
    { name: 'Status Translator', path: '/status-translator', icon: Languages },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Prototype Synthetic Data Banner */}
      <div className="bg-amber-500 text-slate-950 font-semibold px-4 py-1.5 text-center text-xs tracking-wide shadow-sm flex items-center justify-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-slate-950 animate-pulse"></span>
        <span>Prototype — synthetic demonstration data</span>
      </div>

      {/* Main Government-style Header */}
      <header className="bg-slate-900 text-white border-b-4 border-blue-600 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-blue-700 flex items-center justify-center font-bold text-white text-xl tracking-wider shadow">
              JS
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold tracking-tight text-white">JanSahay</span>
                <span className="text-xs uppercase px-2 py-0.5 rounded bg-blue-950 text-blue-300 font-semibold border border-blue-800">
                  Grievance AI Layer
                </span>
              </div>
              <p className="text-xs text-blue-200 font-medium">
                From Complaint to Resolution
              </p>
              <p className="text-[11px] text-slate-400">
                JanSahay: AI-assisted grievance resolution layer for CPGRAMS.
              </p>
            </div>
          </div>

          {/* Role Toggle Switcher */}
          <div className="flex items-center gap-3 bg-slate-800/80 p-1.5 rounded-lg border border-slate-700 self-start md:self-auto">
            <span className="text-xs text-slate-300 pl-1 font-medium">Active Mode:</span>
            <div className="flex rounded-md bg-slate-900 p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => handleRoleToggle('citizen')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition ${
                  role === 'citizen'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <User size={13} />
                Citizen
              </button>
              <button
                type="button"
                onClick={() => handleRoleToggle('officer')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition ${
                  role === 'officer'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck size={13} />
                Officer
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Bar */}
        <nav className="bg-slate-950 border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                      isActive
                        ? 'border-blue-500 text-white bg-slate-900/60'
                        : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`
                  }
                >
                  <Icon size={14} />
                  {item.name}
                </NavLink>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Page Body Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet context={{ role }} />
      </main>

      {/* Mandatory Disclaimer Footer */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 py-6 text-center text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-2">
          <p className="font-semibold text-slate-300">
            JanSahay is a prototype and is not affiliated with or endorsed by DARPG/CPGRAMS.
          </p>
          <p className="text-[11px] text-slate-500">
            Synthetic civic intelligence demonstration &bull; Phase 0 Baseline Bootstrap
          </p>
        </div>
      </footer>
    </div>
  );
}
