import { useState, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import api from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.js'
import { ScanLine, Search, CheckCircle2, XCircle, AlertTriangle, LogOut, RotateCcw, Camera, CameraOff } from 'lucide-react'

const STATUS = { idle: 'idle', loading: 'loading', allowed: 'allowed', blocked: 'blocked', error: 'error' }

function ResultDisplay({ result, onOverride, onReset, overriding }) {
  if (!result) return null

  const isAllowed = result.ok || result.overrideOk
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
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-red-100 rounded-xl px-4 py-3">
            <p className="text-red-800 font-semibold">{result.message}</p>
          </div>

          {result.code !== 'NOT_FOUND' && result.code !== 'ALREADY_IN' && (
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
  const scannerRef = useRef(null)
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
        // Extract UUID from profile URL if scanned from profile page
        const match = decodedText.match(/\/profile\/([a-f0-9-]{36})/)
        const code = match ? match[1] : decodedText.trim()
        onScan(code)
      },
      () => {} // ignore per-frame errors
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

export default function GateTablet() {
  const { user, logout } = useAuth()
  const [mode, setMode] = useState('camera') // 'camera' | 'search'
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState(STATUS.idle)
  const [result, setResult] = useState(null)
  const [overriding, setOverriding] = useState(false)
  const [cameraActive, setCameraActive] = useState(true)
  const inputRef = useRef()

  useEffect(() => { inputRef.current?.focus() }, [status])

  async function checkIn(qrCode, override = false, note = '') {
    setStatus(STATUS.loading)
    setCameraActive(false)
    try {
      const { data } = await api.post('/attendance/checkin', { qrCode, override, note })
      setResult({ ...data, overrideOk: override })
      setStatus(STATUS.allowed)
    } catch (err) {
      const d = err.response?.data
      setResult(d || { ok: false, message: 'Server error' })
      setStatus(STATUS.blocked)
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
          <span className="text-gray-400 text-sm">{user?.name}</span>
          <button onClick={logout} className="text-gray-400 hover:text-white"><LogOut size={18} /></button>
        </div>
      </header>

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

      <TodayCount />
    </div>
  )
}

function TodayCount() {
  const [count, setCount] = useState(null)
  useEffect(() => {
    api.get('/attendance').then((r) => setCount(r.data.length)).catch(() => {})
    const t = setInterval(() => {
      api.get('/attendance').then((r) => setCount(r.data.length)).catch(() => {})
    }, 30000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="px-6 pb-6">
      <div className="bg-gray-800 rounded-xl px-5 py-3 flex items-center justify-between">
        <span className="text-gray-400 text-sm">Today's check-ins</span>
        <span className="text-white font-bold text-lg">{count ?? '…'}</span>
      </div>
    </div>
  )
}
