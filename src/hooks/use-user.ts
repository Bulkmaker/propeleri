"use client";

import { useAuth } from "@/components/providers/AuthProvider";

export function useUser() {
  return useAuth();
}
