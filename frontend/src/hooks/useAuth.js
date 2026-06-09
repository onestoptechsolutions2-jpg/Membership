import { useState, useEffect } from 'react'
import api from '../lib/api.js'

let _user = null
let _listeners = []

function notify() { _listeners.forEach((fn) => fn(_user)) }

export function useAuth() {
  const [user, setUser] = useState(_user)
  const [loading, setLoading] = useState(!_user && !!localStorage.getItem('token'))

  useEffect(() => {
    _listeners.push(setUser)
    if (!_user && localStorage.getItem('token')) {
      api.get('/auth/me')
        .then((r) => { _user = r.data; notify() })
        .catch(() => { localStorage.removeItem('token') })
        .finally(() => setLoading(false))
    }
    return () => { _listeners = _listeners.filter((fn) => fn !== setUser) }
  }, [])

  function login(token, userData) {
    localStorage.setItem('token', token)
    _user = userData
    notify()
  }

  function logout() {
    localStorage.removeItem('token')
    _user = null
    notify()
    window.location.href = '/login'
  }

  return { user, loading, login, logout }
}
