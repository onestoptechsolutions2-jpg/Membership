import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import TeamLeadDashboard from './pages/TeamLeadDashboard.jsx'
import GateTablet from './pages/GateTablet.jsx'
import MemberProfile from './pages/MemberProfile.jsx'
import PublicRegister from './pages/PublicRegister.jsx'
import RegistrationApproval from './pages/RegistrationApproval.jsx'
import AttendanceReport from './pages/AttendanceReport.jsx'
import AuditLog from './pages/AuditLog.jsx'
import { useAuth } from './hooks/useAuth.js'

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

function RoleHome() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'admin') return <Navigate to="/admin" replace />
  if (user.role === 'team_lead') return <Navigate to="/lead" replace />
  if (user.role === 'keeper') return <Navigate to="/gate" replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/profile/:qrCode" element={<MemberProfile />} />
      <Route path="/register" element={<PublicRegister />} />
      <Route path="/" element={<RoleHome />} />

      {/* Admin */}
      <Route path="/admin" element={<PrivateRoute roles={['admin']}><AdminDashboard /></PrivateRoute>} />
      <Route path="/admin/registrations" element={<PrivateRoute roles={['admin']}><RegistrationApproval /></PrivateRoute>} />
      <Route path="/admin/report" element={<PrivateRoute roles={['admin']}><AttendanceReport /></PrivateRoute>} />
      <Route path="/admin/audit" element={<PrivateRoute roles={['admin']}><AuditLog /></PrivateRoute>} />

      {/* Team Lead */}
      <Route path="/lead" element={<PrivateRoute roles={['team_lead']}><TeamLeadDashboard /></PrivateRoute>} />
      <Route path="/lead/registrations" element={<PrivateRoute roles={['team_lead']}><RegistrationApproval /></PrivateRoute>} />
      <Route path="/lead/report" element={<PrivateRoute roles={['team_lead']}><AttendanceReport /></PrivateRoute>} />

      {/* Gate */}
      <Route path="/gate" element={<PrivateRoute roles={['keeper', 'admin', 'team_lead']}><GateTablet /></PrivateRoute>} />
    </Routes>
  )
}
