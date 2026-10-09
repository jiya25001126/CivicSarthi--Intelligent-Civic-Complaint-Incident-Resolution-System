import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchCurrentUser, login as apiLogin, register as apiRegister, logout as apiLogout } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadUser() {
      try {
        const response = await fetchCurrentUser();
        if (isMounted && response?.data) {
          setUser(response.data);
        }
      } catch {
        // User is not logged in or session expired
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadUser();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async ({ email, password }) => {
    setError(null);
    try {
      const response = await apiLogin({ email, password });
      if (response?.data?.user) {
        setUser(response.data.user);
        return response.data.user;
      }
      throw new Error('Invalid login response format');
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const register = async ({ email, password, name }) => {
    setError(null);
    try {
      const response = await apiRegister({ email, password, name });
      if (response?.data?.user) {
        setUser(response.data.user);
        return response.data.user;
      }
      throw new Error('Invalid registration response format');
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch (err) {
      console.warn('Logout network error, clearing client state:', err.message);
    } finally {
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    isAuthenticated: Boolean(user),
    isCitizen: user?.role === 'citizen',
    isOfficer: user?.role === 'officer',
    isAdmin: user?.role === 'admin'
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
