import { createContext, useContext } from 'react'
import type { User } from '../types'

export interface AuthCtx {
  user: User | null
  setUser: (u: User | null) => void
}

export const AuthContext = createContext<AuthCtx>({ user: null, setUser: () => {} })

export const useAuth = () => useContext(AuthContext)
