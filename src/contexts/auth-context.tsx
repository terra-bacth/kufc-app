"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import type { User, UserRole } from "@/lib/types";
import { onAuthChange } from "@/lib/firebase/auth";
import { watchDocument } from "@/lib/firebase/firestore";

interface AuthState {
  user: FirebaseUser | null;
  userData: User | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  isCoach: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  userData: null,
  role: null,
  loading: true,
  error: null,
  isAdmin: false,
  isCoach: false,
  isStudent: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopProfile = () => {};
    let generation = 0;
    const stopAuth = onAuthChange((u) => {
      stopProfile();
      const current = ++generation;
      setUser(u);
      setUserData(null);
      setError(null);
      setLoading(!!u);
      if (u) {
        stopProfile = watchDocument<User>("users", u.uid, (profile) => {
          if (current !== generation) return;
          setUserData(profile);
          setLoading(false);
        }, () => {
          if (current !== generation) return;
          setError("Could not load your academy profile. Reload to retry.");
          setLoading(false);
        });
      }
    });
    return () => { generation++; stopProfile(); stopAuth(); };
  }, []);

  const role = userData?.role ?? null;
  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        role,
        loading,
        error,
        isAdmin: role === "admin",
        isCoach: role === "coach",
        isStudent: role === "student",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
