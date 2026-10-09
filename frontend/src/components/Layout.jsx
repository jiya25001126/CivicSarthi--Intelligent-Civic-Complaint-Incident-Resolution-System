import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  LogOut,
  LogIn,
  UserPlus
} from 'lucide-react';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, isCitizen, isOfficer, isAdmin } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
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
      {/* System Transparency Banner */}
      <div className="bg-slate-800 text-slate-300 font-medium px-4 py-1 text-center text-xs tracking-wide border-b border-slate-700 flex items-center justify-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        <span>CivicSarthi — Role-governed civic complaint resolution & decision support system.</span>
      </div>

      {/* Main GovTech Header */}
      <header className="bg-slate-900 text-white border-b-4 border-blue-600 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 rounded bg-blue-700 flex items-center justify-center font-bold text-white text-xl tracking-wider shadow">
              CS
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold tracking-tight text-white">CivicSarthi</span>
                <span className="text-xs uppercase px-2 py-0.5 rounded bg-blue-950 text-blue-300 font-semibold border border-blue-800">
                  Civic Resolution System
                </span>
              </div>
              <p className="text-xs text-blue-200 font-medium">
                From Complaint to Resolution.
              </p>
              <p className="text-[11px] text-slate-400">
                CivicSarthi — Intelligent Civic Complaint & Incident Resolution System
              </p>
            </div>
          </div>

          {/* Authenticated Identity / Session Management */}
          <div className="flex items-center gap-3 self-start md:self-auto">
            {isAuthenticated ? (
              <div className="flex items-center gap-3 bg-slate-800/90 py-1.5 px-3 rounded-lg border border-slate-700">
                <div className="text-right">
                  <div className="text-xs font-semibold text-white flex items-center gap-1.5 justify-end">
                    {isAdmin ? (
                      <Shield className="text-amber-400" size={13} />
                    ) : isOfficer ? (
                      <ShieldCheck className="text-blue-400" size={13} />
                    ) : (
                      <User className="text-emerald-400" size={13} />
                    )}
                    <span>{user.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    <span className="capitalize font-medium text-slate-300">{user.role}</span>
                    {user.departmentId && ` • ${user.departmentId}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Sign out of session"
                  className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs"
                >
                  <LogOut size={13} />
                  <span className="hidden sm:inline text-[11px]">Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 border border-slate-700 transition"
                >
                  <LogIn size={13} />
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition"
                >
                  <UserPlus size={13} />
                  Register Citizen
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Navigation Bar */}
        <nav className="bg-slate-950 border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between overflow-x-auto">
            <div className="flex items-center">
              {/* Public Unauthenticated Navigation */}
              {!isAuthenticated && (
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
                    to="/citizen/track"
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                        isActive
                          ? 'border-blue-500 text-white bg-slate-900/60'
                          : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`
                    }
                  >
                    <Search size={14} />
                    Track Grievance
                  </NavLink>
                </>
              )}

              {/* Citizen Navigation Links */}
              {isCitizen &&
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

              {/* Officer / Admin Navigation Links */}
              {(isOfficer || isAdmin) &&
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

      {/* Civic Transparency Footer */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 py-6 text-center text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-2">
          <p className="font-semibold text-slate-300">
            CivicSarthi — Intelligent Civic Complaint & Incident Resolution System
          </p>
          <p className="text-[11px] text-slate-400">
            CivicSarthi is an independent civic resolution platform and is not affiliated with or endorsed by DARPG/CPGRAMS.
          </p>
          <p className="text-[11px] text-slate-500">
            Demonstration environment &bull; Synthetic grievance management data &bull; Does not submit directly to official government portals without authorization.
          </p>
        </div>
      </footer>
    </div>
  );
}
