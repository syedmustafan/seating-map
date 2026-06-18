import { create } from "zustand";

export type ColorMode = "status" | "heatmap";
export type Theme = "light" | "dark";

interface UiState {
  colorMode: ColorMode;
  theme: Theme;
  /** Seat id currently shown in the details panel (click or focus). */
  activeSeatId: string | null;
  toggleColorMode: () => void;
  toggleTheme: () => void;
  setActiveSeat: (id: string | null) => void;
}

function initialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("seating-theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export const useUiStore = create<UiState>((set, get) => ({
  colorMode: "status",
  theme: initialTheme(),
  activeSeatId: null,
  toggleColorMode: () => set({ colorMode: get().colorMode === "status" ? "heatmap" : "status" }),
  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    if (typeof window !== "undefined") window.localStorage.setItem("seating-theme", next);
    set({ theme: next });
  },
  setActiveSeat: (id) => set({ activeSeatId: id }),
}));
