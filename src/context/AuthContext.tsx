import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { User } from '../types/crm';

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  company: string;
  seedSample?: boolean;
}

interface LoginPayload {
  email: string;
  password: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  loginDemo: () => Promise<void>;
  logout: () => Promise<void>;
  apiFetch: <T>(url: string, init?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function readJsonResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('json')) {
    throw new Error(
      'The API returned a non-JSON response. Run `npm run preview` to start the built app with its API server.'
    );
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new Error('The API returned an empty or invalid JSON response.');
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const res = await fetch('/api/auth/session', {
          credentials: 'same-origin',
        });
        if (!res.ok) {
          if (active) {
            setUser(null);
            setToken(null);
          }
          return;
        }
        const data = await readJsonResponse<{
          authenticated?: boolean;
          user: User | null;
          token: string | null;
        }>(res);
        if (active) {
          if (data.authenticated && data.user && data.token) {
            setUser(data.user);
            setToken(data.token);
          } else {
            setUser(null);
            setToken(null);
          }
        }
      } catch {
        if (active) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
    const data = await readJsonResponse<{
      user: User;
      token: string;
      error?: string;
    }>(res);
    if (!res.ok) {
      throw new Error(data.error || 'Unable to sign in.');
    }
    setUser(data.user);
    setToken(data.token);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
    const data = await readJsonResponse<{
      user: User;
      token: string;
      error?: string;
    }>(res);
    if (!res.ok) {
      throw new Error(data.error || 'Unable to create account.');
    }
    setUser(data.user);
    setToken(data.token);
  }, []);

  const loginDemo = useCallback(async () => {
    const res = await fetch('/api/auth/demo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'same-origin',
    });
    const data = await readJsonResponse<{
      user: User;
      token: string;
      error?: string;
    }>(res);
    if (!res.ok) {
      throw new Error(data.error || 'Unable to open demo workspace.');
    }
    setUser(data.user);
    setToken(data.token);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
      });
    } finally {
      setUser(null);
      setToken(null);
    }
  }, []);

  const apiFetch = useCallback(
    async <T,>(url: string, init: RequestInit = {}): Promise<T> => {
      const headers = new Headers(init.headers);
      if (!headers.has('Content-Type') && init.body) {
        headers.set('Content-Type', 'application/json');
      }
      headers.set('X-Requested-With', 'XMLHttpRequest');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const res = await fetch(url, {
        ...init,
        headers,
        credentials: 'same-origin',
      });

      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setUser(null);
        setToken(null);
        throw new Error(data.error || 'Session expired. Please sign in again.');
      }
      if (!res.ok) {
        throw new Error(data.error || 'Request failed.');
      }
      return data as T;
    },
    [token]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        loginDemo,
        logout,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
