import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import CitizenDashboard from './pages/CitizenDashboard';
import OfficerDashboard from './pages/OfficerDashboard';
import ComplaintDetail from './pages/ComplaintDetail';
import IncidentPage from './pages/IncidentPage';
import NeglectRadarPage from './pages/NeglectRadarPage';
import StatusTranslatorPage from './pages/StatusTranslatorPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<CitizenDashboard />} />
          <Route path="officer" element={<OfficerDashboard />} />
          <Route path="complaints/:id" element={<ComplaintDetail />} />
          <Route path="incident" element={<IncidentPage />} />
          <Route path="neglect-radar" element={<NeglectRadarPage />} />
          <Route path="status-translator" element={<StatusTranslatorPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
