/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TaxRegime } from './FiscalDocument';

export interface AiContext {
  period: string; // e.g., "Jan/26 – Mai/26"
  totalDocs: number;
  volumes: {
    inbound: number;
    outbound: number;
    total: number;
  };
  ibscbs: {
    credito: number;
    debito: number;
    saldo: number;
    creditRate: number;
    debitRate: number;
    balanceRate: number;
  };
  byDocType: Array<{
    tipo: string;
    count: number;
    credito: number;
    debito: number;
  }>;
  byRegime: {
    rpa: number;
    simples: number;
    mei: number;
  };
  inconformes: number;
  topCfops: Array<{
    cfop: string;
    credito: number;
    debito: number;
  }>;
  temporal: Array<{
    label: string;
    credito: number;
    debito: number;
    saldo: number;
  }>;
  companyRegime: TaxRegime;
  purchaseProfile: {
    withCredits: number;
    neutral: number;
    creditCoverageRate: number;
  };
  salesProfile: {
    b2b: number;
    b2c: number;
    b2bRate: number;
  };
}

export interface AiHistoryEntry {
  id: string;
  timestamp: string;
  conclusions: string;
  period: string;
  volumes: {
    total: number;
  };
}
