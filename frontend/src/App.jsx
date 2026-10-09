import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import CitizenDashboard from './pages/CitizenDashboard';
import SubmitComplaintPage from './pages/SubmitComplaintPage';
import MyComplaintsPage from './pages/MyComplaintsPage';
import TrackComplaintPage from './pages/TrackComplaintPage';
import ComplaintDetailPage from './pages/ComplaintDetailPage';
import OfficerDashboard from './pages/OfficerDashboard';
import OfficerComplaintManagement from './pages/OfficerComplaintManagement';
import DepartmentManagementPage from './pages/DepartmentManagementPage';
import IncidentPage from './pages/IncidentPage';
import NeglectRadarPage from './pages/NeglectRadarPage';
import StatusTranslatorPage from './pages/StatusTranslatorPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* Public Landing View */}
          <Route index element={<LandingPage />} />

          {/* Citizen Portal Routes */}
          <Route path="citizen" element={<CitizenDashboard />} />
          <Route path="citizen/submit" element={<SubmitComplaintPage />} />
          <Route path="citizen/complaints" element={<MyComplaintsPage />} />
          <Route path="citizen/complaints/:id" element={<ComplaintDetailPage />} />
          <Route path="citizen/track" element={<TrackComplaintPage />} />
          <Route path="citizen/track/:id" element={<TrackComplaintPage />} />

          {/* Officer Portal Routes */}
          <Route path="officer" element={<OfficerDashboard />} />
          <Route path="officer/complaints" element={<OfficerComplaintManagement />} />
          <Route path="officer/complaints/:id" element={<ComplaintDetailPage />} />
          <Route path="officer/departments" element={<DepartmentManagementPage />} />

          {/* Backward compatibility route for Phase 0 */}
          <Route path="complaints/:id" element={<ComplaintDetailPage />} />

          {/* Flagship Feature Previews */}
          <Route path="incident" element={<IncidentPage />} />
          <Route path="neglect-radar" element={<NeglectRadarPage />} />
          <Route path="status-translator" element={<StatusTranslatorPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
