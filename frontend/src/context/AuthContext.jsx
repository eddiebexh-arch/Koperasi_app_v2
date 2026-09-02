import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = not logged in, object = logged in
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(true);

  // Check initial admin existence & current session
  const checkSession = async () => {
    try {
      // 1. Check if system has any admin initialized
      const initRes = await axios.get(`${API}/auth/check-init`);
      setIsInitialized(initRes.data.initialized);

      // 2. Check current session
      const res = await axios.get(`${API}/auth/me`, { withCredentials: true });
      if (res.data && res.data.id) {
        setUser(res.data);
      } else {
        setUser(false);
      }
    } catch (e) {
      setUser(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password }, { withCredentials: true });
    if (res.data && res.data.user) {
      setUser(res.data.user);
      return res.data.user;
    }
  };

  const setupAdmin = async (name, email, password) => {
    const res = await axios.post(`${API}/auth/setup-admin`, { name, email, password, role: 'admin' }, { withCredentials: true });
    if (res.data && res.data.user) {
      setUser(res.data.user);
      setIsInitialized(true);
      return res.data.user;
    }
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch (e) {
      console.error(e);
    }
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isInitialized, login, setupAdmin, logout, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
