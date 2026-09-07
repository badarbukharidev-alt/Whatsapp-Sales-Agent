import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import axios from "axios";
import { User } from "../types";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: { name: string; email: string; password: string; company?: string; phone?: string; plan?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: { name?: string; company?: string; phone?: string; password?: string }) => Promise<{ success: boolean; error?: string }>;
  quickDemoLogin: (role: "admin" | "user") => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("salesagent_token"));
  const [loading, setLoading] = useState<boolean>(true);

  // Set default axios Authorization header whenever token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      localStorage.setItem("salesagent_token", token);
    } else {
      delete axios.defaults.headers.common["Authorization"];
      localStorage.removeItem("salesagent_token");
    }
  }, [token]);

  // Check current user session on load
  useEffect(() => {
    const checkSession = async () => {
      const savedToken = localStorage.getItem("salesagent_token");
      if (!savedToken) {
        setLoading(false);
        return;
      }

      try {
        axios.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
        const res = await axios.get("/api/auth/me");
        if (res.data?.user) {
          setUser(res.data.user);
          setToken(savedToken);
        } else {
          setUser(null);
          setToken(null);
        }
      } catch (err) {
        console.warn("[Auth] Stale token or expired session, clearing:", err);
        localStorage.removeItem("salesagent_token");
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await axios.post("/api/auth/login", { email, password });
      if (res.data?.token && res.data?.user) {
        setToken(res.data.token);
        setUser(res.data.user);
        return { success: true };
      }
      return { success: false, error: "Invalid response from server" };
    } catch (err: any) {
      return { success: false, error: err?.response?.data?.error || "Login failed. Check your credentials." };
    }
  };

  const register = async (data: { name: string; email: string; password: string; company?: string; phone?: string; plan?: string }) => {
    try {
      const res = await axios.post("/api/auth/register", data);
      if (res.data?.token && res.data?.user) {
        setToken(res.data.token);
        setUser(res.data.user);
        return { success: true };
      }
      return { success: false, error: "Registration failed." };
    } catch (err: any) {
      return { success: false, error: err?.response?.data?.error || "Registration failed." };
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await axios.post("/api/auth/logout");
      }
    } catch (err) {
      console.warn("Logout error:", err);
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem("salesagent_token");
      delete axios.defaults.headers.common["Authorization"];
    }
  };

  const updateProfile = async (data: { name?: string; company?: string; phone?: string; password?: string }) => {
    try {
      const res = await axios.put("/api/auth/profile", data);
      if (res.data?.user) {
        setUser(res.data.user);
        return { success: true };
      }
      return { success: false, error: "Failed to update profile." };
    } catch (err: any) {
      return { success: false, error: err?.response?.data?.error || "Update profile failed." };
    }
  };

  const quickDemoLogin = async (role: "admin" | "user") => {
    if (role === "admin") {
      await login("baddarbukhari@gmail.com", "B@dar85299211");
    } else {
      await login("user@salesagent.ai", "user123");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isAdmin: user?.role === "admin",
        loading,
        login,
        register,
        logout,
        updateProfile,
        quickDemoLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
