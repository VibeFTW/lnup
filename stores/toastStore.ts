import { create } from "zustand";

type ToastType = "success" | "info" | "error";

interface ToastState {
  toast: { message: string; type: ToastType } | null;
  showToast: (message: string, type?: ToastType) => void;
  hideToast: () => void;
}

let timeoutId: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  toast: null,

  showToast: (message, type = "success") => {
    if (timeoutId) clearTimeout(timeoutId);
    set({ toast: { message, type } });
    timeoutId = setTimeout(() => {
      set({ toast: null });
      timeoutId = null;
    }, 3000);
  },

  hideToast: () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
    set({ toast: null });
  },
}));
