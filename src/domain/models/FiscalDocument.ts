/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DocumentType = 'NFE' | 'NFCE' | 'CTE' | 'NFSE' | 'UNKNOWN';
export type TaxRegime = 'SIMPLES_NACIONAL' | 'MEI' | 'RPA' | 'UNKNOWN';
export type DocumentDirection = 'INBOUND' | 'OUTBOUND' | 'UNKNOWN';

export interface FiscalItem {
  item_number: number;
  description: string;
  cfop: string;
  ncm: string;
  gross_value: number;
  discount_value: number;
  net_value: number;
  rtc: {
    cst?: string;
    c_class_trib?: string;
    vBC?: number;
    pIBSUF?: number;
    vIBSUF?: number;
    pIBSMun?: number;
    vIBSMun?: number;
    vIBS?: number;
    pCBS?: number;
    vCBS?: number;
  };
  rtc_impact: 'CREDIT' | 'DEBIT' | 'NONE';
  taxes_current: {
    icms_cst?: string;
    icms_base?: number;
    icms_rate?: number;
    icms_value?: number;
    pis_cst?: string;
    pis_base?: number;
    pis_rate?: number;
    pis_value?: number;
    cofins_cst?: string;
    cofins_base?: number;
    cofins_rate?: number;
    cofins_value?: number;
    ipi_cst?: string;
    ipi_base?: number;
    ipi_rate?: number;
    ipi_value?: number;
    iss_base?: number;
    iss_rate?: number;
    iss_value?: number;
    iss_retained?: boolean;
    ir_value?: number;
    csll_value?: number;
    inss_value?: number;
  };
}

export interface FiscalDocument {
  access_key: string;
  document_type: DocumentType;
  version: string;
  issue_date: string;
  purpose: 'NORMAL' | 'COMPLEMENTAR' | 'AJUSTE' | 'DEVOLUCAO' | 'UNKNOWN';
  tax_regime: TaxRegime;
  direction: DocumentDirection;
  issuer: {
    cnpj_cpf: string;
    name: string;
    uf?: string;
    ie?: string;
  };
  receiver: {
    cnpj_cpf: string;
    name: string;
    uf?: string;
  };
  total_value: number;
  totals: {
    vProd?: number;
    vDesc?: number;
    vFrete?: number;
    vTotTrib?: number;
    vICMS?: number;
    vPIS?: number;
    vCOFINS?: number;
    vBCIBSCBS?: number;
    vIBS?: number;
    vCBS?: number;
    vISS?: number;
    vISSRet?: number;
  };
  items: FiscalItem[];
  status: 'VALID' | 'CANCELLED' | 'DENIED';
  source_filename: string;
  raw_xml?: string;
  municipality_code?: string;
  referenced_keys?: string[];
}
