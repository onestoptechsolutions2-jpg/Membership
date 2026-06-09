import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { QRCodeSVG } from 'qrcode.react'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'

function SubBadge({ status, expiresAt }) {
  const expiryStr = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''

  if (status === 'active') {
    return (
      <div className="flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-full">
        <CheckCircle2 size={16} />
        <span className="text-sm font-medium">Active · expires {expiryStr}</span>
      </div>
    )
  }
  if (status === 'grace_period') {
    return (
      <div className="flex items-center gap-2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full">
        <Clock size={16} />
        <span className="text-sm font-medium">Grace period · expired {expiryStr}</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 bg-red-100 text-red-800 px-4 py-2 rounded-full">
      <XCircle size={16} />
      <span className="text-sm font-medium">Subscription suspended</span>
    </div>
  )
}

export default function MemberProfile() {
  const { qrCode } = useParams()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    axios.get(`/api/profile/${qrCode}`)
      .then((r) => setProfile(r.data))
      .catch(() => setError('Member not found'))
  }, [qrCode])

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href)
    setCopying(true)
    setTimeout(() => setCopying(false), 2000)
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <XCircle size={48} className="text-red-400 mx-auto mb-3" />
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header band */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 pt-8 pb-6 text-center text-white">
          {profile.photoUrl ? (
            <img
              src={profile.photoUrl}
              alt={profile.fullName}
              className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-white shadow-lg mb-3"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-white/20 mx-auto flex items-center justify-center text-4xl font-bold border-4 border-white mb-3">
              {profile.fullName[0]}
            </div>
          )}
          <h1 className="text-2xl font-bold">{profile.fullName}</h1>
          <p className="text-blue-200 text-sm mt-0.5">{profile.team?.name}</p>
        </div>

        {/* Body */}
        <div className="px-6 py-6 flex flex-col items-center gap-5">

          {/* Subscription status */}
          <SubBadge status={profile.team?.subscriptionStatus} expiresAt={profile.team?.subscriptionExpiresAt} />

          {/* QR Code */}
          <div className="bg-white border-2 border-gray-100 rounded-2xl p-4 shadow-inner">
            <QRCodeSVG
              value={profile.profileUrl || window.location.href}
              size={200}
              level="M"
              includeMargin={false}
            />
          </div>

          <p className="text-xs text-gray-400 text-center">
            Show this QR at the gate to check in
          </p>

          {/* Share link */}
          <button
            onClick={copyLink}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition"
          >
            {copying ? '✓ Link copied!' : 'Copy Profile Link'}
          </button>

          {!profile.active && (
            <div className="w-full bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
              <p className="text-red-700 text-sm font-medium">This membership is deactivated. Contact your team lead.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 text-center">
          <p className="text-xs text-gray-400">Membership · {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  )
}
