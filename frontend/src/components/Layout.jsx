import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Shield,
  User,
  ShieldCheck,
  Building2,
  FilePlus,
  ListFilter,
  Search,
  LayoutDashboard,
  ShieldAlert,
  AlertTriangle,
  Languages,
  Home,
  CheckCircle,
  HelpCircle
} from 'lucide-react';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine current context (public, citizen, officer)
  const isOfficer = location.pathname.startsWith('/officer');
  const isCitizen = location.pathname.startsWith('/citizen');
  const isPublic = !isOfficer && !isCitizen;

  const currentMode = isOfficer ? 'officer' : isCitizen ? 'citizen' : 'public';

  const handleModeSwitch = (mode) => {
    if (mode === 'public') navigate('/');
    else if (mode === 'citizen') navigate('/citizen');
    else if (mode === 'officer') navigate('/officer');
  };

  const citizenNav = [
    { name: 'Citizen Overview', path: '/citizen', icon: LayoutDashboard },
    { name: 'Submit Grievance', path: '/citizen/submit', icon: FilePlus },
    { name: 'My Complaints', path: '/citizen/complaints', icon: ListFilter },
    { name: 'Track Status', path: '/citizen/track', icon: Search }
  ];

  const officerNav = [
    { name: 'Officer Cockpit', path: '/officer', icon: LayoutDashboard },
    { name: 'Complaint Triage', path: '/officer/complaints', icon: ListFilter },
    { name: 'Departments', path: '/officer/departments', icon: Building2 }
  ];

  const flagshipNav = [
    { name: 'Parent Incident', path: '/incident', icon: ShieldAlert },
    { name: 'Neglect Radar', path: '/neglect-radar', icon: AlertTriangle },
    { name: 'Status Translator', path: '/status-translator', icon: Languages }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* Top Prototype Warning Banner */}
      <div className="bg-amber-500 text-slate-950 font-semibold px-4 py-1.5 text-center text-xs tracking-wide shadow-sm flex items-center justify-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-slate-950 animate-pulse"></span>
        <span>Prototype — synthetic demonstration data. Does not submit complaints to official government systems.</span>
      </div>

      {/* Main GovTech Header */}
      <header className="bg-slate-900 text-white border-b-4 border-blue-600 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
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

          {/* Role / Access Switcher */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-slate-800/80 p-1.5 rounded-lg border border-slate-700 self-start md:self-auto">
            <span className="text-[11px] text-slate-300 pl-1 font-medium">
              Demo Access Mode:
            </span>
            <div className="flex rounded-md bg-slate-900 p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => handleModeSwitch('public')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition ${
                  currentMode === 'public'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Home size={13} />
                Public
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('citizen')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition ${
                  currentMode === 'citizen'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <User size={13} />
                Citizen
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('officer')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition ${
                  currentMode === 'officer'
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

        {/* Dynamic Navigation Bar */}
        <nav className="bg-slate-950 border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between overflow-x-auto">
            <div className="flex items-center">
              {/* Public Links */}
              {currentMode === 'public' && (
                <>
                  <NavLink
                    to="/"
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                        isActive
                          ? 'border-blue-500 text-white bg-slate-900/60'
                          : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`
                    }
                  >
                    <Home size={14} />
                    Overview
                  </NavLink>
                  <NavLink
                    to="/citizen"
                    className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 border-transparent text-slate-400 hover:text-slate-200"
                  >
                    <User size={14} />
                    Citizen Portal
                  </NavLink>
                  <NavLink
                    to="/officer"
                    className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 border-transparent text-slate-400 hover:text-slate-200"
                  >
                    <ShieldCheck size={14} />
                    Officer Portal
                  </NavLink>
                </>
              )}

              {/* Citizen Links */}
              {currentMode === 'citizen' &&
                citizenNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/citizen'}
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

              {/* Officer Links */}
              {currentMode === 'officer' &&
                officerNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/officer'}
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

            {/* Flagship Feature Previews */}
            <div className="flex items-center pl-6 border-l border-slate-800 shrink-0">
              {flagshipNav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium border-b-2 whitespace-nowrap transition-colors ${
                        isActive
                          ? 'border-indigo-400 text-indigo-300 bg-slate-900/60'
                          : 'border-transparent text-slate-500 hover:text-slate-300'
                      }`
                    }
                  >
                    <Icon size={13} />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </nav>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* GovTech Disclaimer Footer */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 py-6 text-center text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-2">
          <p className="font-semibold text-slate-300">
            JanSahay is a prototype and is not affiliated with or endorsed by DARPG/CPGRAMS.
          </p>
          <p className="text-[11px] text-slate-500">
            Phase 1 Core Platform &bull; Synthetic grievance management demonstration &bull; All records are simulated demo data.
          </p>
        </div>
      </footer>
    </div>
  );
}
