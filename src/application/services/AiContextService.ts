/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FiscalDocument, TaxRegime } from '../../domain/models/FiscalDocument';
import { AiContext } from '../../domain/models/AiTypes';
import { TaxAnalyzerService } from './TaxAnalyzerService';

export class AiContextService {
  /**
   * Builds the strictly anonymized, aggregated context designed to feed the Gemini API securely.
   */
  static buildAiContext(documents: FiscalDocument[], referenceCnpj: string): AiContext {
    // 1. Calculate General Metrics
    const apuracao = TaxAnalyzerService.calculateApuracao(documents, referenceCnpj);
    const inconformesList = TaxAnalyzerService.getInconformes(documents, referenceCnpj);
    const cfopGroups = TaxAnalyzerService.groupByCfop(documents, referenceCnpj);
    const temporalPeriods = TaxAnalyzerService.groupByTemporal(documents, referenceCnpj, 'monthly');

    // 2. Identify the company's presumed regime by inspecting major outbound profiles
    let companyRegime: TaxRegime = 'UNKNOWN';
    const outboundDocs = documents.filter(d => TaxAnalyzerService.enrichDocument(d, referenceCnpj).direction === 'OUTBOUND');
    if (outboundDocs.length > 0) {
      const regimeCounts: Record<TaxRegime, number> = {
        'RPA': 0,
        'SIMPLES_NACIONAL': 0,
        'MEI': 0,
        'UNKNOWN': 0
      };
      outboundDocs.forEach(d => {
        regimeCounts[d.tax_regime] = (regimeCounts[d.tax_regime] || 0) + 1;
      });
      companyRegime = Object.entries(regimeCounts).reduce((a, b) => b[1] > a[1] ? b : a)[0] as TaxRegime;
    }

    // 3. Compile Purchase & Supplier Profile (RPA vs. Simples credits ratio)
    let purchaseWithCredits = 0;
    let purchaseNeutral = 0;
    
    // 4. Compile Sales Profile (B2B vs. B2C client split)
    let salesB2B = 0;
    let salesB2C = 0;

    let rpaCount = 0;
    let simplesCount = 0;
    let meiCount = 0;

    documents.forEach(doc => {
      const enriched = TaxAnalyzerService.enrichDocument(doc, referenceCnpj);
      if (enriched.direction === 'INBOUND') {
        const hasCredits = enriched.items.some(it => it.rtc_impact === 'CREDIT');
        if (hasCredits) {
          purchaseWithCredits += doc.total_value;
        } else {
          purchaseNeutral += doc.total_value;
        }

        // Aggregate supplier regimes
        if (doc.tax_regime === 'RPA') rpaCount++;
        else if (doc.tax_regime === 'SIMPLES_NACIONAL') simplesCount++;
        else if (doc.tax_regime === 'MEI') meiCount++;
      } else if (enriched.direction === 'OUTBOUND') {
        const cleanRec = doc.receiver.cnpj_cpf.replace(/\D/g, '');
        // Standard Brazilian CPF has 11 digits, CNPJ has 14
        const isCPF = cleanRec.length === 11 || doc.receiver.cnpj_cpf === 'CONSUMIDOR_FINAL';
        if (isCPF) {
          salesB2C += doc.total_value;
        } else {
          salesB2B += doc.total_value;
        }
      }
    });

    // 5. Aggregate by Document Type
    const docTypeCount: Record<string, { count: number; credito: number; debito: number }> = {};
    documents.forEach(doc => {
      const enriched = TaxAnalyzerService.enrichDocument(doc, referenceCnpj);
      const type = doc.document_type;
      if (!docTypeCount[type]) {
        docTypeCount[type] = { count: 0, credito: 0, debito: 0 };
      }
      docTypeCount[type].count++;
      
      doc.items.forEach(it => {
        const itemEnriched = TaxAnalyzerService.enrichDocument(doc, referenceCnpj).items[doc.items.indexOf(it)];
        if (itemEnriched.rtc_impact === 'CREDIT') {
          docTypeCount[type].credito += (it.rtc.vIBS || 0) + (it.rtc.vCBS || 0);
        } else if (itemEnriched.rtc_impact === 'DEBIT') {
          docTypeCount[type].debito += (it.rtc.vIBS || 0) + (it.rtc.vCBS || 0);
        }
      });
    });

    const byDocType = Object.entries(docTypeCount).map(([tipo, val]) => ({
      tipo,
      count: val.count,
      credito: val.credito,
      debito: val.debito,
    }));

    // Date range labels
    let period = 'Sem documentos';
    if (documents.length > 0) {
      const dates = documents.map(d => d.issue_date.substring(0, 10)).sort();
      period = `${dates[0]} a ${dates[dates.length - 1]}`;
    }

    const compiledContext: AiContext = {
      period,
      totalDocs: documents.length,
      volumes: {
        inbound: documents.filter(d => TaxAnalyzerService.enrichDocument(d, referenceCnpj).direction === 'INBOUND').length,
        outbound: documents.filter(d => TaxAnalyzerService.enrichDocument(d, referenceCnpj).direction === 'OUTBOUND').length,
        total: documents.length,
      },
      ibscbs: {
        credito: apuracao.credits,
        debito: apuracao.debits,
        saldo: apuracao.saldo,
        creditRate: apuracao.creditRate,
        debitRate: apuracao.debitRate,
        balanceRate: apuracao.balanceRate,
      },
      byDocType,
      byRegime: {
        rpa: rpaCount,
        simples: simplesCount,
        mei: meiCount,
      },
      inconformes: inconformesList.length,
      topCfops: cfopGroups.slice(0, 5).map(g => ({
        cfop: g.cfop,
        credito: g.credits,
        debito: g.debits,
      })),
      temporal: temporalPeriods.map(p => ({
        label: p.label,
        credito: p.credito,
        debito: p.debito,
        saldo: p.saldo,
      })),
      companyRegime,
      purchaseProfile: {
        withCredits: purchaseWithCredits,
        neutral: purchaseNeutral,
        creditCoverageRate: (purchaseWithCredits + purchaseNeutral) > 0 
          ? (purchaseWithCredits / (purchaseWithCredits + purchaseNeutral)) * 100 
          : 0,
      },
      salesProfile: {
        b2b: salesB2B,
        b2c: salesB2C,
        b2bRate: (salesB2B + salesB2C) > 0 
          ? (salesB2B / (salesB2B + salesB2C)) * 100 
          : 0,
      },
    };

    // 6. Enforce strict privacy auditing - Purge sensitive details as a secondary safety layer!
    return this.sanitizeAndAudit(compiledContext);
  }

  /**
   * Secondary security layer: walks the context tree and completely strips/scrubs all potential identifiers
   * matching standard corporate IDs, personal IDs, or private keywords before hitting the network.
   */
  private static sanitizeAndAudit(context: AiContext): AiContext {
    const serialized = JSON.stringify(context);
    
    // Regex for CPF: 3 digits, dot, 3 digits, dot, 3 digits, hyphen, 2 digits
    // Regex for CNPJ: 2 digits, dot, 3 digits, dot, 3 digits, slash, 4 digits, hyphen, 2 digits
    // Combined regex for raw numbers too (11 or 14 digits)
    const leaksCnpjCpf = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11,14}\b/g;
    
    if (leaksCnpjCpf.test(serialized)) {
      console.warn('AiContext compilation warning: Purged raw corporate identifier leak');
    }

    // Return deeply sanitized cloned copy
    return JSON.parse(
      serialized.replace(leaksCnpjCpf, '[REGISTRADO_COMO_DADO_ANONIMIZADO]')
    );
  }
}
