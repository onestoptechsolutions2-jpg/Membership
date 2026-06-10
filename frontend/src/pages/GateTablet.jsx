import { useState, useEffect, useRef, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import api from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.js'
import { ScanLine, Search, CheckCircle2, XCircle, AlertTriangle, LogOut, RotateCcw, Camera, Wifi, WifiOff } from 'lucide-react'

const STATUS = { idle: 'idle', loading: 'loading', allowed: 'allowed', blocked: 'blocked', error: 'error' }
const CACHE_KEY = 'gate_members_cache'
const CACHE_DATE_KEY = 'gate_members_cache_date'
const OFFLINE_QUEUE_KEY = 'gate_offline_queue'

// ── Offline helpers ──────────────────────────────────────────────────────────

function cacheMembersLocally(members) {
  const today = new Date().toISOString().slice(0, 10)
  const map = {}
  members.forEach(m => { if (m.qrCode) map[m.qrCode] = m })
  localStorage.setItem(CACHE_KEY, JSON.stringify(map))
  localStorage.setItem(CACHE_DATE_KEY, today)
}

function getOfflineMember(qrCode) {
  const today = new Date().toISOString().slice(0, 10)
  if (localStorage.getItem(CACHE_DATE_KEY) !== today) return null
  try {
    const map = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    return map[qrCode] || null
  } catch { return null }
}

function enqueueOfflineCheckin(qrCode) {
  try {
    const q = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]')
    if (!q.find(e => e.qrCode === qrCode)) {
      q.push({ qrCode, timestamp: new Date().toISOString() })
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q))
    }
  } catch {}
}

function getOfflineQueue() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]') } catch { return [] }
}

function clearOfflineQueue() {
  localStorage.removeItem(OFFLINE_QUEUE_KEY)
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ResultDisplay({ result, onOverride, onReset, overriding, offline }) {
  if (!result) return null

  const isAllowed = result.ok || result.overrideOk || result.offlineAllowed
  const member = result.member || result.attendance?.member

  return (
    <div className={`rounded-2xl p-6 text-center space-y-4 ${isAllowed ? 'bg-green-50 border-2 border-green-400' : 'bg-red-50 border-2 border-red-400'}`}>
      {member?.photoUrl ? (
        <img src={member.photoUrl} alt={member.fullName} className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-white shadow" />
      ) : (
        <div className="w-24 h-24 rounded-full bg-gray-200 mx-auto flex items-center justify-center text-3xl font-bold text-gray-400">
          {member?.fullName?.[0] || '?'}
        </div>
      )}

      {isAllowed
        ? <CheckCircle2 size={48} className="text-green-600 mx-auto" />
        : <XCircle size={48} className="text-red-600 mx-auto" />
      }

      <div>
        <p className="text-2xl font-bold text-gray-900">{member?.fullName || 'Unknown'}</p>
        <p className="text-gray-600">{member?.team?.name}</p>
      </div>

      {isAllowed ? (
        <div className="bg-green-100 rounded-xl px-4 py-3">
          <p className="text-green-800 font-semibold text-lg">✓ CHECK IN ALLOWED</p>
          <p className="text-green-700 text-sm">
            {new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
            {result.offlineAllowed && ' · Queued for sync'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-red-100 rounded-xl px-4 py-3">
            <p className="text-red-800 font-semibold">{result.message}</p>
          </div>

          {result.code !== 'NOT_FOUND' && result.code !== 'ALREADY_IN' && !offline && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500 flex items-center justify-center gap-1">
                <AlertTriangle size={14} /> Override requires admin or team lead
              </p>
              <div>
                <input
                  id="override-note"
                  type="text"
                  placeholder="Reason for override (optional)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900"
                />
                <button
                  onClick={() => onOverride(document.getElementById('override-note').value)}
                  disabled={overriding}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
                >
                  {overriding ? 'Processing…' : 'Override & Allow Entry'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        onClick={onReset}
        className="w-full flex items-center justify-center gap-2 border border-gray-300 py-3 rounded-xl hover:bg-gray-50 text-gray-600 font-medium"
      >
        <RotateCcw size={16} /> Next Member
      </button>
    </div>
  )
}

function CameraScanner({ onScan, active }) {
  const html5QrRef = useRef(null)
  const scannedRef = useRef(false)

  useEffect(() => {
    if (!active) return

    scannedRef.current = false
    const scanner = new Html5Qrcode('qr-reader')
    html5QrRef.current = scanner

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        if (scannedRef.current) return
        scannedRef.current = true
        const match = decodedText.match(/\/profile\/([a-f0-9-]{36})/)
        const code = match ? match[1] : decodedText.trim()
        onScan(code)
      },
      () => {}
    ).catch((err) => {
      console.error('Camera start error:', err)
    })

    return () => {
      scanner.stop().catch(() => {})
    }
  }, [active])

  return (
    <div className="bg-gray-800 rounded-2xl overflow-hidden">
      <div id="qr-reader" className="w-full" />
      {!active && (
        <div className="p-10 text-center">
          <Camera size={48} className="mx-auto text-gray-500 mb-2" />
          <p className="text-gray-400">Camera stopped</p>
        </div>
      )}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function GateTablet() {
  const { user, logout } = useAuth()
  const [mode, setMode] = useState('camera') // 'camera' | 'search'
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState(STATUS.idle)
  const [result, setResult] = useState(null)
  const [overriding, setOverriding] = useState(false)
  const [cameraActive, setCameraActive] = useState(true)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [queuedCount, setQueuedCount] = useState(getOfflineQueue().length)
  const [syncing, setSyncing] = useState(false)
  const inputRef = useRef()

  // Seed member cache on mount
  useEffect(() => {
    async function seedCache() {
      try {
        const { data } = await api.get('/members?active=true')
        cacheMembersLocally(data)
      } catch {}
    }
    seedCache()
  }, [])

  // Online/offline detection
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
      syncQueue()
    }
    function handleOffline() { setIsOnline(false) }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => { inputRef.current?.focus() }, [status])

  // Sync queued offline check-ins when back online
  const syncQueue = useCallback(async () => {
    const q = getOfflineQueue()
    if (!q.length) return
    setSyncing(true)
    try {
      for (const entry of q) {
        try {
          await api.post('/attendance/checkin', { qrCode: entry.qrCode, note: 'Offline sync' })
        } catch {}
      }
      clearOfflineQueue()
      setQueuedCount(0)
    } finally { setSyncing(false) }
  }, [])

  async function checkIn(qrCode, override = false, note = '') {
    setStatus(STATUS.loading)
    setCameraActive(false)

    if (!isOnline) {
      // Offline path: validate from cache
      const cached = getOfflineMember(qrCode)
      if (cached && cached.active && !cached.suspendedAt && cached.registrationStatus === 'approved') {
        enqueueOfflineCheckin(qrCode)
        setQueuedCount(getOfflineQueue().length)
        setResult({ ok: true, offlineAllowed: true, member: cached })
        setStatus(STATUS.allowed)
      } else {
        setResult({ ok: false, message: cached ? 'Member not eligible (offline)' : 'QR not found in offline cache', code: 'OFFLINE_BLOCKED' })
        setStatus(STATUS.blocked)
      }
      return
    }

    try {
      const { data } = await api.post('/attendance/checkin', { qrCode, override, note })
      setResult({ ...data, overrideOk: override })
      setStatus(STATUS.allowed)
    } catch (err) {
      const isNetworkError = !err.response
      if (isNetworkError) {
        // Connectivity dropped mid-session — fall back to cache
        setIsOnline(false)
        const cached = getOfflineMember(qrCode)
        if (cached && cached.active && !cached.suspendedAt && cached.registrationStatus === 'approved') {
          enqueueOfflineCheckin(qrCode)
          setQueuedCount(getOfflineQueue().length)
          setResult({ ok: true, offlineAllowed: true, member: cached })
          setStatus(STATUS.allowed)
        } else {
          setResult({ ok: false, message: 'Network lost. QR not in offline cache.', code: 'OFFLINE_BLOCKED' })
          setStatus(STATUS.blocked)
        }
      } else {
        const d = err.response?.data
        setResult(d || { ok: false, message: 'Server error' })
        setStatus(STATUS.blocked)
      }
    }
  }

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    await checkIn(query.trim())
    setQuery('')
  }

  function reset() {
    setResult(null)
    setStatus(STATUS.idle)
    setQuery('')
    if (mode === 'camera') setCameraActive(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function switchMode(m) {
    setMode(m)
    setResult(null)
    setStatus(STATUS.idle)
    setQuery('')
    setCameraActive(m === 'camera')
  }

  const showResult = status === STATUS.allowed || status === STATUS.blocked

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-gray-800">
        <div className="flex items-center gap-2">
          <ScanLine size={22} className="text-blue-400" />
          <span className="font-bold text-lg">Gate Check-In</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Connectivity badge */}
          {isOnline ? (
            <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
              <Wifi size={14} /> Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-yellow-400 text-xs font-medium animate-pulse">
              <WifiOff size={14} /> Offline{queuedCount > 0 ? ` · ${queuedCount} queued` : ''}
            </span>
          )}
          {syncing && <span className="text-blue-400 text-xs animate-pulse">Syncing…</span>}
          <span className="text-gray-400 text-sm">{user?.name}</span>
          <button onClick={logout} className="text-gray-400 hover:text-white"><LogOut size={18} /></button>
        </div>
      </header>

      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-yellow-500/20 border-b border-yellow-500/30 px-6 py-2 text-yellow-300 text-sm text-center">
          Working offline — using cached member list. Check-ins will sync when connection is restored.
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex mx-6 mt-5 bg-gray-800 rounded-xl p-1">
        {[
          { key: 'camera', label: 'Camera Scan', icon: Camera },
          { key: 'search', label: 'Search / Type', icon: Search }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => switchMode(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition ${mode === key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Icon size={18} /> {label}
          </button>
        ))}
      </div>

      {/* Main area */}
      <div className="flex-1 px-6 py-5 space-y-5">
        {showResult ? (
          <ResultDisplay
            result={result}
            overriding={overriding}
            offline={!isOnline}
            onReset={reset}
            onOverride={async (note) => {
              setOverriding(true)
              await checkIn(result.member?.qrCode || query, true, note)
              setOverriding(false)
            }}
          />
        ) : (
          <>
            {mode === 'camera' ? (
              <div className="space-y-3">
                <CameraScanner active={cameraActive} onScan={(code) => checkIn(code)} />
                {status === STATUS.loading && (
                  <p className="text-blue-400 animate-pulse text-center">Checking member…</p>
                )}
                <p className="text-gray-500 text-sm text-center">Point camera at member's QR code</p>
              </div>
            ) : (
              <form onSubmit={handleSearch} className="space-y-3">
                <div className="relative">
                  <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Type member name or paste QR code…"
                    className="w-full bg-gray-800 border border-gray-600 text-white rounded-xl pl-11 pr-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={!query.trim() || status === STATUS.loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl text-lg disabled:opacity-50"
                >
                  {status === STATUS.loading ? 'Checking…' : 'Check In'}
                </button>
              </form>
            )}
          </>
        )}
      </div>

      <TodayCount offline={!isOnline} />
    </div>
  )
}

function TodayCount({ offline }) {
  const [count, setCount] = useState(null)
  useEffect(() => {
    if (offline) return
    api.get('/attendance').then((r) => setCount(r.data.length)).catch(() => {})
    const t = setInterval(() => {
      api.get('/attendance').then((r) => setCount(r.data.length)).catch(() => {})
    }, 30000)
    return () => clearInterval(t)
  }, [offline])

  return (
    <div className="px-6 pb-6">
      <div className="bg-gray-800 rounded-xl px-5 py-3 flex items-center justify-between">
        <span className="text-gray-400 text-sm">Today's check-ins</span>
        <span className="text-white font-bold text-lg">{offline ? '—' : (count ?? '…')}</span>
      </div>
    </div>
  )
}
