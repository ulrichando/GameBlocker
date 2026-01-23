import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

interface AuthStatus {
  isConfigured: boolean;
  isAuthenticated: boolean;
}

interface SetupResult {
  success: boolean;
  master_password: string | null;
  error: string | null;
}

interface AuthStore {
  isConfigured: boolean;
  isAuthenticated: boolean;
  masterPassword: string | null;
  isLoading: boolean;
  error: string | null;

  checkAuthStatus: () => Promise<void>;
  setupPassword: (password: string) => Promise<SetupResult>;
  completeSetup: () => void;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  resetWithMaster: (masterPassword: string, newPassword: string) => Promise<boolean>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  isConfigured: false,
  isAuthenticated: false,
  masterPassword: null,
  isLoading: true,
  error: null,

  checkAuthStatus: async () => {
    try {
      set({ isLoading: true, error: null });
      const status = await invoke<AuthStatus>("get_auth_status");
      set({
        isConfigured: status.isConfigured,
        isLoading: false,
      });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  setupPassword: async (password: string) => {
    try {
      set({ isLoading: true, error: null });
      const result = await invoke<SetupResult>("setup_password", { password });
      if (result.success) {
        set({
          masterPassword: result.master_password,
          isConfigured: true,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ error: result.error, isLoading: false });
      }
      return result;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      return { success: false, master_password: null, error: String(error) };
    }
  },

  completeSetup: () => {
    set({ isConfigured: true, isAuthenticated: true, masterPassword: null });
  },

  login: async (password: string) => {
    try {
      set({ isLoading: true, error: null });
      const isValid = await invoke<boolean>("verify_password", { password });
      if (isValid) {
        set({ isAuthenticated: true, isLoading: false });
      } else {
        set({ error: "Invalid password", isLoading: false });
      }
      return isValid;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      return false;
    }
  },

  logout: () => {
    set({ isAuthenticated: false });
  },

  changePassword: async (oldPassword: string, newPassword: string) => {
    try {
      set({ isLoading: true, error: null });
      const success = await invoke<boolean>("change_password", {
        oldPassword,
        newPassword,
      });
      set({ isLoading: false });
      return success;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      return false;
    }
  },

  resetWithMaster: async (masterPassword: string, newPassword: string) => {
    try {
      set({ isLoading: true, error: null });
      const success = await invoke<boolean>("reset_with_master", {
        masterPassword,
        newPassword,
      });
      if (success) {
        set({ isAuthenticated: true, isLoading: false });
      }
      return success;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      return false;
    }
  },
}));
