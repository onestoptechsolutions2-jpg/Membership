import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import TeamLeadDashboard from './pages/TeamLeadDashboard.jsx'
import GateTablet from './pages/GateTablet.jsx'
import MemberProfile from './pages/MemberProfile.jsx'
import { useAuth } from './hooks/useAuth.js'

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen">Loading…</div>
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
      <Route path="/login" element={<Login />} />
      <Route path="/profile/:qrCode" element={<MemberProfile />} />
      <Route path="/" element={<RoleHome />} />
      <Route
        path="/admin/*"
        element={
          <PrivateRoute roles={['admin']}>
            <AdminDashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/lead/*"
        element={
          <PrivateRoute roles={['team_lead']}>
            <TeamLeadDashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/gate"
        element={
          <PrivateRoute roles={['keeper', 'admin']}>
            <GateTablet />
          </PrivateRoute>
        }
      />
    </Routes>
  )
}
