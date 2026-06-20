/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FiscalDocument, FiscalItem, DocumentDirection } from '../../domain/models/FiscalDocument';

export class TaxAnalyzerService {
  /**
   * Identifies the most likely reference CNPJ from a list of documents.
   * Looks for the most active corporate tax ID.
   */
  static autoDetectReferenceCNPJ(documents: FiscalDocument[]): string {
    if (documents.length === 0) return '';
    
    const counts: Record<string, number> = {};
    
    documents.forEach(doc => {
      const emitCnpj = doc.issuer.cnpj_cpf;
      const destCnpj = doc.receiver.cnpj_cpf;
      
      if (emitCnpj && emitCnpj !== 'CONSUMIDOR_FINAL') {
        counts[emitCnpj] = (counts[emitCnpj] || 0) + 1;
      }
      if (destCnpj && destCnpj !== 'CONSUMIDOR_FINAL') {
        counts[destCnpj] = (counts[destCnpj] || 0) + 1;
      }
    });
    
    let maxCnpj = '';
    let maxCount = 0;
    
    Object.entries(counts).forEach(([cnpj, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxCnpj = cnpj;
      }
    });
    
    return maxCnpj;
  }

  /**
   * Check if a CFOP code refers to a non-commercial, excluded context.
   */
  static isExcludedCfop(cfop: string): boolean {
    if (!cfop) return false;
    const clean = cfop.replace(/\D/g, '');
    if (clean.startsWith('7')) return true; // export transactions
    
    // non-commercial sequences (9xx other actions, 91x credit returns, etc.)
    const prefixes = ['59', '69', '19', '29'];
    return prefixes.some(pref => clean.startsWith(pref));
  }

  /**
   * Enriches a document setting its direction and updating item impacts.
   */
  static enrichDocument(
    doc: FiscalDocument, 
    referenceCnpj: string,
    simulationMode: boolean = true,
    ibsRate: number = 8.8,
    cbsRate: number = 9.0
  ): FiscalDocument {
    if (!referenceCnpj) {
      return { ...doc, direction: 'UNKNOWN' };
    }

    const cleanRef = referenceCnpj.replace(/\D/g, '');
    const cleanIssuer = doc.issuer.cnpj_cpf.replace(/\D/g, '');
    const cleanReceiver = doc.receiver.cnpj_cpf.replace(/\D/g, '');

    const direction: DocumentDirection = (cleanIssuer === cleanRef) 
      ? 'OUTBOUND' 
      : (cleanReceiver === cleanRef) 
        ? 'INBOUND' 
        : 'UNKNOWN';

    const enrichedItems: FiscalItem[] = doc.items.map(item => {
      const excluded = this.isExcludedCfop(item.cfop);
      let rtc_impact: 'CREDIT' | 'DEBIT' | 'NONE' = 'NONE';
      let rtc = { ...item.rtc };

      if (!excluded) {
        if (direction === 'INBOUND') {
          const hasRealRtc = (item.rtc.vIBS || 0) + (item.rtc.vCBS || 0) > 0;
          if (simulationMode && !hasRealRtc) {
            const estimatedIbs = Number((item.net_value * (ibsRate / 100)).toFixed(2));
            const estimatedCbs = Number((item.net_value * (cbsRate / 100)).toFixed(2));
            rtc = {
              ...rtc,
              cst: rtc.cst || '01',
              vBC: item.net_value,
              vIBS: estimatedIbs,
              vCBS: estimatedCbs,
            };
            rtc_impact = 'CREDIT';
          } else {
            const hasRtc = (item.rtc.vIBS || 0) + (item.rtc.vCBS || 0) > 0;
            rtc_impact = hasRtc ? 'CREDIT' : 'NONE';
          }
        } else if (direction === 'OUTBOUND') {
          rtc_impact = 'DEBIT';
          const hasRealRtc = (item.rtc.vIBS || 0) + (item.rtc.vCBS || 0) > 0;
          if (simulationMode && !hasRealRtc) {
            const estimatedIbs = Number((item.net_value * (ibsRate / 100)).toFixed(2));
            const estimatedCbs = Number((item.net_value * (cbsRate / 100)).toFixed(2));
            rtc = {
              ...rtc,
              cst: rtc.cst || '01',
              vBC: item.net_value,
              vIBS: estimatedIbs,
              vCBS: estimatedCbs,
            };
          }
        }
      }

      return {
        ...item,
        rtc,
        rtc_impact,
      };
    });

    let totals = { ...doc.totals };
    const hasRealTotals = (totals.vIBS || totals.vCBS || 0) > 0;
    if (simulationMode && !hasRealTotals) {
      let sumIBS = 0;
      let sumCBS = 0;
      let sumBC = 0;
      enrichedItems.forEach(it => {
        sumIBS += it.rtc.vIBS || 0;
        sumCBS += it.rtc.vCBS || 0;
        sumBC += it.rtc.vBC || 0;
      });
      totals.vBCIBSCBS = sumBC;
      totals.vIBS = sumIBS;
      totals.vCBS = sumCBS;
    }

    return {
      ...doc,
      direction,
      totals,
      items: enrichedItems,
    };
  }

  /**
   * Computes full tax balance metrics.
   */
  static calculateApuracao(
    documents: FiscalDocument[], 
    referenceCnpj: string,
    simulationMode: boolean = true,
    ibsRate: number = 8.8,
    cbsRate: number = 9.0
  ) {
    let creditTotal = 0;
    let debitTotal = 0;
    let purchaseTotal = 0;
    let salesTotal = 0;

    const enrichedDocs = documents.map(d => this.enrichDocument(d, referenceCnpj, simulationMode, ibsRate, cbsRate));

    enrichedDocs.forEach(doc => {
      if (doc.direction === 'INBOUND') {
        purchaseTotal += doc.total_value;
        doc.items.forEach(item => {
          if (item.rtc_impact === 'CREDIT') {
            creditTotal += (item.rtc.vIBS || 0) + (item.rtc.vCBS || 0);
          }
        });
      } else if (doc.direction === 'OUTBOUND') {
        salesTotal += doc.total_value;
        doc.items.forEach(item => {
          if (item.rtc_impact === 'DEBIT') {
            debitTotal += (item.rtc.vIBS || 0) + (item.rtc.vCBS || 0);
          }
        });
      }
    });

    const saldo = creditTotal - debitTotal;
    
    const creditRate = purchaseTotal > 0 ? (creditTotal / purchaseTotal) * 100 : 0;
    const debitRate = salesTotal > 0 ? (debitTotal / salesTotal) * 100 : 0;
    const balanceRate = salesTotal > 0 ? (Math.abs(saldo) / salesTotal) * 100 : 0;

    return {
      credits: creditTotal,
      debits: debitTotal,
      saldo,
      purchaseTotal,
      salesTotal,
      creditRate,
      debitRate,
      balanceRate,
    };
  }

  /**
   * Identifies compliance errors (supplier omission of IBS/CBS)
   */
  static getInconformes(
    documents: FiscalDocument[], 
    referenceCnpj: string,
    simulationMode: boolean = true
  ) {
    const inconformes: Array<{
      key: string;
      filename: string;
      date: string;
      sender: string;
      emitterRegime: string;
      value: number;
      cfop: string;
      desc: string;
    }> = [];

    // Para conformidade, analisamos os documentos originais, mas se simulationMode for true, 
    // ignoramos o corte temporal de 2026 para expor quais fornecedores RPA deixaram de destacar tags Reforma.
    const enrichedDocs = documents.map(d => this.enrichDocument(d, referenceCnpj, false)); // false para manter original sem taxação simulável nos itens

    enrichedDocs.forEach(doc => {
      if (doc.direction !== 'INBOUND') return;
      
      const cleanDate = doc.issue_date.substring(0, 10);
      if (!simulationMode && cleanDate < '2026-01-01') return;

      if (doc.tax_regime === 'SIMPLES_NACIONAL' || doc.tax_regime === 'MEI') return;

      doc.items.forEach(item => {
        if (this.isExcludedCfop(item.cfop)) return;

        const totalRtc = (item.rtc.vIBS || 0) + (item.rtc.vCBS || 0);
        if (totalRtc === 0) {
          inconformes.push({
            key: doc.access_key,
            filename: doc.source_filename,
            date: doc.issue_date,
            sender: doc.issuer.name,
            emitterRegime: doc.tax_regime,
            value: item.net_value,
            cfop: item.cfop,
            desc: item.description,
          });
        }
      });
    });

    return inconformes;
  }

  /**
   * Compile CFOP reports.
   */
  static groupByCfop(
    documents: FiscalDocument[], 
    referenceCnpj: string,
    simulationMode: boolean = true,
    ibsRate: number = 8.8,
    cbsRate: number = 9.0
  ) {
    const cfopMap: Record<string, { cfop: string; credits: number; debits: number; volume: number }> = {};
    const enriched = documents.map(d => this.enrichDocument(d, referenceCnpj, simulationMode, ibsRate, cbsRate));

    enriched.forEach(doc => {
      doc.items.forEach(item => {
        const cfop = item.cfop || 'Desconhecido';
        if (!cfopMap[cfop]) {
          cfopMap[cfop] = { cfop, credits: 0, debits: 0, volume: 0 };
        }
        
        cfopMap[cfop].volume += item.net_value;
        if (item.rtc_impact === 'CREDIT') {
          cfopMap[cfop].credits += (item.rtc.vIBS || 0) + (item.rtc.vCBS || 0);
        } else if (item.rtc_impact === 'DEBIT') {
          cfopMap[cfop].debits += (item.rtc.vIBS || 0) + (item.rtc.vCBS || 0);
        }
      });
    });

    return Object.values(cfopMap).sort((a, b) => b.volume - a.volume);
  }

  /**
   * Compile temporal analysis.
   */
  static groupByTemporal(
    documents: FiscalDocument[], 
    referenceCnpj: string, 
    mode: 'monthly' | 'quarterly',
    simulationMode: boolean = true,
    ibsRate: number = 8.8,
    cbsRate: number = 9.0
  ) {
    const periodMap: Record<string, { label: string; credito: number; debito: number; volumeInbound: number; volumeOutbound: number }> = {};
    const enriched = documents.map(d => this.enrichDocument(d, referenceCnpj, simulationMode, ibsRate, cbsRate));

    enriched.forEach(doc => {
      if (doc.direction === 'UNKNOWN') return;
      
      const date = new Date(doc.issue_date);
      if (isNaN(date.getTime())) return;

      const year = date.getFullYear();
      let label = '';
      
      if (mode === 'monthly') {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        label = `${year}-${month}`;
      } else {
        const q = Math.floor(date.getMonth() / 3) + 1;
        label = `${year}-Q${q}`;
      }

      if (!periodMap[label]) {
        periodMap[label] = { label, credito: 0, debito: 0, volumeInbound: 0, volumeOutbound: 0 };
      }

      if (doc.direction === 'INBOUND') {
        periodMap[label].volumeInbound += doc.total_value;
        doc.items.forEach(item => {
          if (item.rtc_impact === 'CREDIT') {
            periodMap[label].credito += (item.rtc.vIBS || 0) + (item.rtc.vCBS || 0);
          }
        });
      } else if (doc.direction === 'OUTBOUND') {
        periodMap[label].volumeOutbound += doc.total_value;
        doc.items.forEach(item => {
          if (item.rtc_impact === 'DEBIT') {
            periodMap[label].debito += (item.rtc.vIBS || 0) + (item.rtc.vCBS || 0);
          }
        });
      }
    });

    // Sort chronologically
    const sorted = Object.values(periodMap).sort((a, b) => a.label.localeCompare(b.label));

    // Compile cumulative progress
    let cumulative = 0;
    return sorted.map(period => {
      const saldo = period.credito - period.debito;
      cumulative += saldo;
      return {
        ...period,
        saldo,
        saldoAcumulado: cumulative,
      };
    });
  }

  /**
   * Highlight analysis metrics.
   */
  static getTemporalHighlights(temporalPeriods: any[]) {
    if (temporalPeriods.length === 0) {
      return { best: null, worst: null, trend: 'NEUTRAL' };
    }

    let best = temporalPeriods[0];
    let worst = temporalPeriods[0];
    
    temporalPeriods.forEach(p => {
      if (p.saldo > best.saldo) best = p;
      if (p.saldo < worst.saldo) worst = p;
    });

    let trend: 'STABLE' | 'UPWARD' | 'DOWNWARD' | 'NEUTRAL' = 'NEUTRAL';
    if (temporalPeriods.length >= 2) {
      const firstHalf = temporalPeriods.slice(0, Math.floor(temporalPeriods.length / 2));
      const secondHalf = temporalPeriods.slice(Math.floor(temporalPeriods.length / 2));
      
      const balance1 = firstHalf.reduce((acc, curr) => acc + curr.saldo, 0);
      const balance2 = secondHalf.reduce((acc, curr) => acc + curr.saldo, 0);
      
      if (balance2 > balance1 + 1000) trend = 'UPWARD';
      else if (balance2 < balance1 - 1000) trend = 'DOWNWARD';
      else trend = 'STABLE';
    }

    return {
      best,
      worst,
      trend,
    };
  }
}
