/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import JSZip from 'jszip';
import { FiscalDocument } from '../../domain/models/FiscalDocument';
import { DocumentDetector } from '../../infrastructure/parsers/DocumentDetector';
import { ParserFactory } from '../../infrastructure/parsers/ParserFactory';
import { TaxAnalyzerService } from '../services/TaxAnalyzerService';

interface FiscalStoreState {
  documents: FiscalDocument[];
  referenceCnpj: string;
  isLoading: boolean;
  errors: string[];
  simulationMode: boolean;
  simulationIbsRate: number;
  simulationCbsRate: number;
  setReferenceCnpj: (cnpj: string) => void;
  setSimulationMode: (mode: boolean) => void;
  setSimulationIbsRate: (rate: number) => void;
  setSimulationCbsRate: (rate: number) => void;
  clearDocuments: () => void;
  processFiles: (files: File[]) => Promise<void>;
}

export const useFiscalStore = create<FiscalStoreState>((set, get) => ({
  documents: [],
  referenceCnpj: '',
  isLoading: false,
  errors: [],
  simulationMode: true,
  simulationIbsRate: 8.8,
  simulationCbsRate: 9.0,

  setReferenceCnpj: (cnpj: string) => {
    set({ referenceCnpj: cnpj });
  },

  setSimulationMode: (mode: boolean) => {
    set({ simulationMode: mode });
  },

  setSimulationIbsRate: (rate: number) => {
    set({ simulationIbsRate: rate });
  },

  setSimulationCbsRate: (rate: number) => {
    set({ simulationCbsRate: rate });
  },

  clearDocuments: () => {
    set({ documents: [], referenceCnpj: '', errors: [] });
  },

  processFiles: async (files: File[]) => {
    set({ isLoading: true, errors: [] });
    const loadedDocs: FiscalDocument[] = [];
    const newErrors: string[] = [];

    const xmlParserFactory = async (xmlContent: string, name: string) => {
      try {
        const detectedType = DocumentDetector.detect(xmlContent);
        if (detectedType === 'UNKNOWN') {
          newErrors.push(`[${name}] Não identificado como formato fiscal suportado.`);
          return;
        }

        const parserInstance = ParserFactory.getParser(detectedType);
        const doc = parserInstance.parse(xmlContent, name);
        loadedDocs.push(doc);
      } catch (err: any) {
        newErrors.push(`[${name}] Erro no processamento: ${err.message || err}`);
      }
    };

    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith('.xml')) {
        try {
          const text = await file.text();
          await xmlParserFactory(text, file.name);
        } catch (e: any) {
          newErrors.push(`Erro ao ler arquivo ${file.name}: ${e.message || e}`);
        }
      } else if (lowerName.endsWith('.zip')) {
        try {
          const zip = await JSZip.loadAsync(file);
          const xmlFiles = Object.keys(zip.files).filter(k => k.toLowerCase().endsWith('.xml'));

          for (const xmlPath of xmlFiles) {
            const xmlContent = await zip.files[xmlPath].async('string');
            const splitPath = xmlPath.split('/');
            const cleanName = splitPath[splitPath.length - 1];
            await xmlParserFactory(xmlContent, cleanName);
          }
        } catch (e: any) {
          newErrors.push(`Erro ao carregar pacote ZIP ${file.name}: ${e.message || e}`);
        }
      } else {
        newErrors.push(`[${file.name}] Ignorado — tipo de arquivo não suportado.`);
      }
    }

    set((state) => {
      const mergedDocs = [...state.documents, ...loadedDocs];
      // Auto detect CNPJ if not already defined
      const referenceCnpj = state.referenceCnpj || TaxAnalyzerService.autoDetectReferenceCNPJ(mergedDocs);

      return {
        documents: mergedDocs,
        referenceCnpj,
        isLoading: false,
        errors: [...state.errors, ...newErrors],
      };
    });
  },
}));
