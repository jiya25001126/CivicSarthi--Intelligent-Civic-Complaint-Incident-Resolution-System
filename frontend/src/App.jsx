import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
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
import AppealManagementPage from './pages/AppealManagementPage';
import ReopeningManagementPage from './pages/ReopeningManagementPage';
import SpamReviewPage from './pages/SpamReviewPage';
import AnalyticsDashboardPage from './pages/AnalyticsDashboardPage';

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <Routes>
          <Route path="/" element={<Layout />}>
            {/* Public Landing & Authentication Views */}
            <Route index element={<LandingPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />

            {/* Public Tracking Endpoint (Accessible without authentication) */}
            <Route path="citizen/track" element={<TrackComplaintPage />} />
            <Route path="citizen/track/:id" element={<TrackComplaintPage />} />

            {/* Citizen Portal Protected Routes */}
            <Route
              path="citizen"
              element={
                <ProtectedRoute allowedRoles={['citizen']}>
                  <CitizenDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="citizen/submit"
              element={
                <ProtectedRoute allowedRoles={['citizen']}>
                  <SubmitComplaintPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="citizen/complaints"
              element={
                <ProtectedRoute allowedRoles={['citizen']}>
                  <MyComplaintsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="citizen/complaints/:id"
              element={
                <ProtectedRoute allowedRoles={['citizen']}>
                  <ComplaintDetailPage />
                </ProtectedRoute>
              }
            />

            {/* Officer Portal Protected Routes (Officer & Admin) */}
            <Route
              path="officer"
              element={
                <ProtectedRoute allowedRoles={['officer', 'admin']}>
                  <OfficerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="officer/complaints"
              element={
                <ProtectedRoute allowedRoles={['officer', 'admin']}>
                  <OfficerComplaintManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="officer/complaints/:id"
              element={
                <ProtectedRoute allowedRoles={['officer', 'admin']}>
                  <ComplaintDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="officer/departments"
              element={
                <ProtectedRoute allowedRoles={['officer', 'admin']}>
                  <DepartmentManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="officer/appeals"
              element={
                <ProtectedRoute allowedRoles={['officer', 'admin']}>
                  <AppealManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="officer/reopening-requests"
              element={
                <ProtectedRoute allowedRoles={['officer', 'admin']}>
                  <ReopeningManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="officer/spam-review"
              element={
                <ProtectedRoute allowedRoles={['officer', 'admin']}>
                  <SpamReviewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="officer/analytics"
              element={
                <ProtectedRoute allowedRoles={['officer', 'admin']}>
                  <AnalyticsDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="analytics"
              element={
                <ProtectedRoute allowedRoles={['officer', 'admin']}>
                  <AnalyticsDashboardPage />
                </ProtectedRoute>
              }
            />

            {/* General detail fallback route */}
            <Route
              path="complaints/:id"
              element={
                <ProtectedRoute>
                  <ComplaintDetailPage />
                </ProtectedRoute>
              }
            />

            {/* Flagship Feature Previews */}
            <Route path="incident" element={<IncidentPage />} />
            <Route path="neglect-radar" element={<NeglectRadarPage />} />
            <Route path="status-translator" element={<StatusTranslatorPage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </LanguageProvider>
  </BrowserRouter>
);
}
