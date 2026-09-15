"use client";

import { useEffect, useState } from "react";
import type { AuthUser, UserSession } from "@/types/leadManager";
import { isExecutive, isManager, readSessionFromStorage } from "@/utils/authStorage";

export interface LeadManagerRoleState {
  user: AuthUser | null;
  session: UserSession | null;
  loading: boolean;
  isManager: boolean;
  isExecutive: boolean;
  roleLabel: string;
}

export function useLeadManagerRole(): LeadManagerRoleState {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = readSessionFromStorage();
    setSession(s);
    setLoading(false);
  }, []);

  const user = session?.user || null;
  const manager = isManager(user);
  const executive = isExecutive(user);

  return {
    user,
    session,
    loading,
    isManager: manager,
    isExecutive: executive,
    roleLabel: manager ? "Manager" : executive ? "Executive" : "User",
  };
}
