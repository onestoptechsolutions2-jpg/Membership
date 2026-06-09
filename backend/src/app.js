import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import teamsRoutes from './routes/teams.js'
import membersRoutes from './routes/members.js'
import attendanceRoutes from './routes/attendance.js'
import paymentsRoutes from './routes/payments.js'
import profileRoutes from './routes/profile.js'
import { startCronJobs } from './jobs/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: process.env.APP_URL || '*' }))
app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/teams', teamsRoutes)
app.use('/api/members', membersRoutes)
app.use('/api/attendance', attendanceRoutes)
app.use('/api/payments', paymentsRoutes)
app.use('/api/profile', profileRoutes)   // public — no auth

// Health check
app.get('/health', (_, res) => res.json({ ok: true }))

// 404
app.use((_, res) => res.status(404).json({ error: 'Not found' }))

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: err.message || 'Server error' })
})

app.listen(PORT, () => {
  console.log(`Server running on :${PORT}`)
  startCronJobs()
})
