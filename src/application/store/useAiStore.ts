/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AiHistoryEntry } from '../../domain/models/AiTypes';

interface AiStoreState {
  selectedModel: string;
  preparedBy: string;
  logoBase64: string | null;
  history: AiHistoryEntry[];
  setSelectedModel: (model: string) => void;
  setPreparedBy: (name: string) => void;
  setLogoBase64: (logo: string | null) => void;
  addHistoryEntry: (entry: AiHistoryEntry) => void;
  clearHistory: () => void;
}

export const useAiStore = create<AiStoreState>()(
  persist(
    (set, get) => ({
      selectedModel: 'gemini-3.5-flash',
      preparedBy: 'Simples Consultoria Rápida',
      logoBase64: null,
      history: [],

      setSelectedModel: (model: string) => {
        set({ selectedModel: model });
      },

      setPreparedBy: (name: string) => {
        set({ preparedBy: name });
      },

      setLogoBase64: (logo: string | null) => {
        set({ logoBase64: logo });
      },

      addHistoryEntry: (entry: AiHistoryEntry) => {
        set((state) => ({
          history: [entry, ...state.history].slice(0, 10), // Limit to 10 entries for safety
        }));
      },

      clearHistory: () => {
        set({ history: [] });
      },
    }),
    {
      name: 'simples-apuracao-ai-settings',
    }
  )
);
