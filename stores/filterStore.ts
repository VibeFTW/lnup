import { create } from "zustand";
import type { EventCategory, DateFilter, SortOption } from "@/types";

interface FilterState {
  dateFilter: DateFilter;
  categoryFilter: EventCategory | null;
  searchQuery: string;
  city: string;
  sortBy: SortOption;
  setDateFilter: (filter: DateFilter) => void;
  setCategoryFilter: (category: EventCategory | null) => void;
  setSearchQuery: (query: string) => void;
  setCity: (city: string) => void;
  setSortBy: (sort: SortOption) => void;
  resetFilters: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  dateFilter: "alle",
  categoryFilter: null,
  searchQuery: "",
  city: "",
  sortBy: "date",

  setDateFilter: (dateFilter) => set({ dateFilter }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setCity: (city) => set({ city }),
  setSortBy: (sortBy) => set({ sortBy }),
  resetFilters: () =>
    set({ dateFilter: "alle", categoryFilter: null, searchQuery: "", city: "", sortBy: "date" }),
}));
