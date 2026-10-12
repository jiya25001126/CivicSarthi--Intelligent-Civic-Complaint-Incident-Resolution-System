import React, { useState, useEffect } from 'react';
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
  UserPlus,
  RotateCcw,
  BarChart3
} from 'lucide-react';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, isCitizen, isOfficer, isAdmin } = useAuth();

  const [lang, setLang] = useState(() => {
    return localStorage.getItem('civicsarthi_lang') || 'en';
  });

  const toggleLanguage = () => {
    const nextLang = lang === 'en' ? 'hi' : 'en';
    setLang(nextLang);
    localStorage.setItem('civicsarthi_lang', nextLang);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const t = {
    en: {
      skipToContent: 'Skip to main content',
      systemNotice: 'CivicSarthi — Role-governed civic complaint resolution & decision support system.',
      logoTagline: 'From Complaint to Resolution.',
      logoSub: 'CivicSarthi — Intelligent Civic Complaint & Incident Resolution System',
      badge: 'Civic Resolution System',
      citizenOverview: 'Citizen Overview',
      submitGrievance: 'Submit Grievance',
      myComplaints: 'My Complaints',
      trackStatus: 'Track Status',
      officerCockpit: 'Officer Cockpit',
      complaintTriage: 'Complaint Triage',
      analyticsReports: 'Analytics & Reports',
      spamReviewDesk: 'Spam Review Desk',
      appealsDesk: 'Appeals Desk',
      reopeningDesk: 'Reopening Desk',
      departments: 'Departments',
      parentIncident: 'Parent Incident',
      neglectRadar: 'Neglect Radar',
      statusTranslator: 'Status Translator',
      overview: 'Overview',
      trackGrievance: 'Track Grievance',
      signIn: 'Sign In',
      registerCitizen: 'Register Citizen',
      logout: 'Logout',
      mainNav: 'Main Navigation',
      specializedNav: 'Specialized Operational Systems',
      switchLang: 'Switch language to Hindi / हिन्दी में बदलें',
      footerDisclaimer: 'CivicSarthi is an independent civic resolution platform and is not affiliated with or endorsed by DARPG/CPGRAMS.',
      footerDemo: 'Demonstration environment • Synthetic grievance management data • Does not submit directly to official government portals without authorization.'
    },
    hi: {
      skipToContent: 'मुख्य सामग्री पर जाएं',
      systemNotice: 'सिविकसारथी — भूमिका-आधारित नागरिक शिकायत निवारण एवं निर्णय समर्थन प्रणाली।',
      logoTagline: 'शिकायत से समाधान तक।',
      logoSub: 'सिविकसारथी — बुद्धिमान नागरिक शिकायत एवं घटना निवारण प्रणाली',
      badge: 'नागरिक निवारण प्रणाली',
      citizenOverview: 'नागरिक अवलोकन',
      submitGrievance: 'शिकायत दर्ज करें',
      myComplaints: 'मेरी शिकायतें',
      trackStatus: 'स्थिति ट्रैक करें',
      officerCockpit: 'अधिकारी कॉकपिट',
      complaintTriage: 'शिकायत छंटनी',
      analyticsReports: 'एनालिटिक्स एवं रिपोर्ट',
      spamReviewDesk: 'स्पैम समीक्षा डेस्क',
      appealsDesk: 'अपील डेस्क',
      reopeningDesk: 'पुनः खोलने का डेस्क',
      departments: 'विभाग',
      parentIncident: 'मूल घटना',
      neglectRadar: 'उपेक्षा रडार',
      statusTranslator: 'स्थिति अनुवादक',
      overview: 'अवलोकन',
      trackGrievance: 'शिकायत ट्रैक करें',
      signIn: 'साइन इन',
      registerCitizen: 'नागरिक पंजीकरण',
      logout: 'लॉगआउट',
      mainNav: 'मुख्य नेविगेशन',
      specializedNav: 'विशेष परिचालन प्रणालियां',
      switchLang: 'अंग्रेजी में बदलें / Switch language to English',
      footerDisclaimer: 'सिविकसारथी एक स्वतंत्र नागरिक समाधान मंच है और यह DARPG/CPGRAMS से संबद्ध या समर्थित नहीं है।',
      footerDemo: 'प्रदर्शन वातावरण • सिंथेटिक शिकायत प्रबंधन डेटा • प्राधिकरण के बिना आधिकारिक सरकारी पोर्टलों पर सीधे जमा नहीं करता है।'
    }
  }[lang];

  const citizenNav = [
    { name: t.citizenOverview, path: '/citizen', icon: LayoutDashboard },
    { name: t.submitGrievance, path: '/citizen/submit', icon: FilePlus },
    { name: t.myComplaints, path: '/citizen/complaints', icon: ListFilter },
    { name: t.trackStatus, path: '/citizen/track', icon: Search }
  ];

  const officerNav = [
    { name: t.officerCockpit, path: '/officer', icon: LayoutDashboard },
    { name: t.complaintTriage, path: '/officer/complaints', icon: ListFilter },
    { name: t.analyticsReports, path: '/officer/analytics', icon: BarChart3 },
    { name: t.spamReviewDesk, path: '/officer/spam-review', icon: ShieldCheck },
    { name: t.appealsDesk, path: '/officer/appeals', icon: ShieldAlert },
    { name: t.reopeningDesk, path: '/officer/reopening-requests', icon: RotateCcw },
    { name: t.departments, path: '/officer/departments', icon: Building2 }
  ];

  const flagshipNav = [
    { name: t.parentIncident, path: '/incident', icon: ShieldAlert },
    { name: t.neglectRadar, path: '/neglect-radar', icon: AlertTriangle },
    { name: t.statusTranslator, path: '/status-translator', icon: Languages }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* WCAG 2.4.1 Bypass Blocks: Keyboard Accessible Skip Link */}
      <a href="#main-content" className="skip-link">
        {t.skipToContent}
      </a>

      {/* System Transparency Banner */}
      <aside aria-label="System status notice" className="bg-slate-800 text-slate-300 font-medium px-4 py-1 text-center text-xs tracking-wide border-b border-slate-700 flex items-center justify-between">
        <div className="flex-1 text-center flex items-center justify-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true"></span>
          <span>{t.systemNotice}</span>
        </div>
        <button
          type="button"
          onClick={toggleLanguage}
          aria-label={t.switchLang}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-[11px] font-semibold text-slate-200 border border-slate-600 transition focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <Languages size={12} aria-hidden="true" />
          <span>{lang === 'en' ? 'हिन्दी' : 'English'}</span>
        </button>
      </aside>

      {/* Main GovTech Header */}
      <header className="bg-slate-900 text-white border-b-4 border-blue-600 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Logo & Tagline Semantic Link */}
          <Link
            to="/"
            className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded p-1"
            aria-label="CivicSarthi Home - From Complaint to Resolution"
          >
            <div className="w-10 h-10 rounded bg-blue-700 flex items-center justify-center font-bold text-white text-xl tracking-wider shadow group-hover:bg-blue-600 transition" aria-hidden="true">
              CS
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold tracking-tight text-white">CivicSarthi</span>
                <span className="text-xs uppercase px-2 py-0.5 rounded bg-blue-950 text-blue-300 font-semibold border border-blue-800">
                  {t.badge}
                </span>
              </div>
              <p className="text-xs text-blue-200 font-medium">
                {t.logoTagline}
              </p>
              <p className="text-[11px] text-slate-400">
                {t.logoSub}
              </p>
            </div>
          </Link>

          {/* Authenticated Identity / Session Management */}
          <div className="flex items-center gap-3 self-start md:self-auto">
            {isAuthenticated ? (
              <div className="flex items-center gap-3 bg-slate-800/90 py-1.5 px-3 rounded-lg border border-slate-700">
                <div className="text-right">
                  <div className="text-xs font-semibold text-white flex items-center gap-1.5 justify-end">
                    {isAdmin ? (
                      <Shield className="text-amber-400" size={13} aria-hidden="true" />
                    ) : isOfficer ? (
                      <ShieldCheck className="text-blue-400" size={13} aria-hidden="true" />
                    ) : (
                      <User className="text-emerald-400" size={13} aria-hidden="true" />
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
                  aria-label="Sign out of session"
                  title="Sign out of session"
                  className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <LogOut size={13} aria-hidden="true" />
                  <span className="hidden sm:inline text-[11px]">{t.logout}</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 border border-slate-700 transition focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <LogIn size={13} aria-hidden="true" />
                  {t.signIn}
                </Link>
                <Link
                  to="/register"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <UserPlus size={13} aria-hidden="true" />
                  {t.registerCitizen}
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Navigation Bar with Semantic Landmark */}
        <nav aria-label={t.mainNav} className="bg-slate-950 border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between overflow-x-auto">
            <div className="flex items-center">
              {/* Public Unauthenticated Navigation */}
              {!isAuthenticated && (
                <>
                  <NavLink
                    to="/"
                    aria-current={location.pathname === '/' ? 'page' : undefined}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${
                        isActive
                          ? 'border-blue-500 text-white bg-slate-900/60'
                          : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`
                    }
                  >
                    <Home size={14} aria-hidden="true" />
                    {t.overview}
                  </NavLink>
                  <NavLink
                    to="/citizen/track"
                    aria-current={location.pathname === '/citizen/track' ? 'page' : undefined}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${
                        isActive
                          ? 'border-blue-500 text-white bg-slate-900/60'
                          : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`
                    }
                  >
                    <Search size={14} aria-hidden="true" />
                    {t.trackGrievance}
                  </NavLink>
                </>
              )}

              {/* Citizen Navigation Links */}
              {isCitizen &&
                citizenNav.map((item) => {
                  const Icon = item.icon;
                  const isCurrent = location.pathname === item.path;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/citizen'}
                      aria-current={isCurrent ? 'page' : undefined}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${
                          isActive
                            ? 'border-blue-500 text-white bg-slate-900/60'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`
                      }
                    >
                      <Icon size={14} aria-hidden="true" />
                      {item.name}
                    </NavLink>
                  );
                })}

              {/* Officer / Admin Navigation Links */}
              {(isOfficer || isAdmin) &&
                officerNav.map((item) => {
                  const Icon = item.icon;
                  const isCurrent = location.pathname === item.path;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/officer'}
                      aria-current={isCurrent ? 'page' : undefined}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${
                          isActive
                            ? 'border-blue-500 text-white bg-slate-900/60'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`
                      }
                    >
                      <Icon size={14} aria-hidden="true" />
                      {item.name}
                    </NavLink>
                  );
                })}
            </div>

            {/* Flagship Feature Previews */}
            <div className="flex items-center pl-6 border-l border-slate-800 shrink-0" aria-label={t.specializedNav}>
              {flagshipNav.map((item) => {
                const Icon = item.icon;
                const isCurrent = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={({ isActive }) =>
                      `flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium border-b-2 whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                        isActive
                          ? 'border-indigo-400 text-indigo-300 bg-slate-900/60'
                          : 'border-transparent text-slate-500 hover:text-slate-300'
                      }`
                    }
                  >
                    <Icon size={13} aria-hidden="true" />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </nav>
      </header>

      {/* Main Body Landmark */}
      <main id="main-content" tabIndex="-1" role="main" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 focus:outline-none">
        <Outlet />
      </main>

      {/* Civic Transparency Footer */}
      <footer role="contentinfo" className="bg-slate-900 text-slate-400 border-t border-slate-800 py-6 text-center text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-2">
          <p className="font-semibold text-slate-300">
            CivicSarthi — Intelligent Civic Complaint & Incident Resolution System
          </p>
          <p className="text-[11px] text-slate-400">
            {t.footerDisclaimer}
          </p>
          <p className="text-[11px] text-slate-500">
            {t.footerDemo}
          </p>
        </div>
      </footer>
    </div>
  );
}

