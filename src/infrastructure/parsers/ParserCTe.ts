/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { XMLParser } from 'fast-xml-parser';
import { FiscalDocument, FiscalItem } from '../../domain/models/FiscalDocument';
import { IXmlParser } from './IXmlParser';

export class ParserCTe implements IXmlParser {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: true,
      isArray: (name) => name === 'Comp' || name === 'infNFe',
    });
  }

  parse(xmlContent: string, filename: string): FiscalDocument {
    const rawObj = this.parser.parse(xmlContent);
    const cteProc = rawObj.cteProc || rawObj;
    const cte = cteProc.CTe || cteProc;
    const infCte = cte.infCte;

    if (!infCte) {
      throw new Error(`Invalid XML structure for CTe: missing 'infCte' in ${filename}`);
    }

    const accessKey = (infCte['@_Id'] || '').replace('CTe', '');
    const version = infCte['@_versao'] || '3.00';

    const ide = infCte.ide || {};
    const issueDate = ide.dhEmi || new Date().toISOString();
    const billingCfop = String(ide.CFOP || '');
    
    let purpose: 'NORMAL' | 'COMPLEMENTAR' | 'AJUSTE' | 'DEVOLUCAO' | 'UNKNOWN' = 'NORMAL';
    const finCTe = Number(ide.finCTe);
    if (finCTe === 0) purpose = 'NORMAL';
    else if (finCTe === 1) purpose = 'COMPLEMENTAR';
    else if (finCTe === 2) purpose = 'UNKNOWN'; // substitution/anulation

    const emit = infCte.emit || {};
    const issuerCnpjCpf = String(emit.CNPJ || '');
    const issuerName = String(emit.xNome || 'Transportadora Desconhecida');
    
    const crt = Number(emit.CRT);
    const taxRegime = (crt === 1 || crt === 2) ? 'SIMPLES_NACIONAL' : crt === 3 ? 'RPA' : 'UNKNOWN';

    // Destinations & receivers
    const dest = infCte.dest || {};
    const receiverCnpjCpf = String(dest.CNPJ || dest.CPF || 'CONSIGNATARIO');
    const receiverName = String(dest.xNome || 'Destinatário Desconhecido');
    const receiverUf = dest.enderDest?.UF || undefined;

    const vPrest = infCte.vPrest || {};
    const totalValue = Number(vPrest.vTPrest || 0);

    // Document level IBS/CBS
    const imp = infCte.imp || {};
    const ibscbs = imp.IBSCBS || {};
    const gIBSCBS = ibscbs.gIBSCBS || {};
    const gCBS = gIBSCBS.gCBS || {};

    const vBCIBSCBS = Number(gIBSCBS.vBC || ibscbs.vBC || 0);
    const vIBS = Number(gIBSCBS.vIBS || undefined);
    const vCBS = Number(gCBS.vCBS || undefined);

    // Parsing components as items
    const rawComps = Array.isArray(vPrest.Comp) ? vPrest.Comp : vPrest.Comp ? [vPrest.Comp] : [];
    
    // Referenced keys
    const infNFeRefs = infCte.infCTeNorm?.infDoc?.infNFe;
    const referenced_keys: string[] = [];
    if (Array.isArray(infNFeRefs)) {
      infNFeRefs.forEach((r: any) => {
        if (r.chave) referenced_keys.push(String(r.chave));
      });
    } else if (infNFeRefs && infNFeRefs.chave) {
      referenced_keys.push(String(infNFeRefs.chave));
    }

    const items: FiscalItem[] = rawComps.map((comp: any, index: number) => {
      const grossVal = Number(comp.vComp || 0);
      const description = String(comp.xNome || 'Frete');

      // Map document-level taxes to the first item for compliance with types, as requested by SPEC
      const isFirst = index === 0;

      return {
        item_number: index + 1,
        description,
        cfop: billingCfop,
        ncm: 'N/A', // freight services do not have NCM
        gross_value: grossVal,
        discount_value: 0,
        net_value: grossVal,
        rtc_impact: 'NONE',
        rtc: {
          cst: isFirst ? String(ibscbs.CST || gIBSCBS.CST || '') : undefined,
          vBC: isFirst && vBCIBSCBS ? vBCIBSCBS : undefined,
          vIBS: isFirst ? vIBS : undefined,
          vCBS: isFirst ? vCBS : undefined,
        },
        taxes_current: {},
      };
    });

    if (items.length === 0) {
      // Fallback if there are no components
      items.push({
        item_number: 1,
        description: 'Serviço de Transporte',
        cfop: billingCfop,
        ncm: 'N/A',
        gross_value: totalValue,
        discount_value: 0,
        net_value: totalValue,
        rtc_impact: 'NONE',
        rtc: {
          cst: String(ibscbs.CST || gIBSCBS.CST || ''),
          vBC: vBCIBSCBS || undefined,
          vIBS,
          vCBS,
        },
        taxes_current: {},
      });
    }

    return {
      access_key: accessKey,
      document_type: 'CTE',
      version,
      issue_date: issueDate,
      purpose,
      tax_regime: taxRegime,
      direction: 'UNKNOWN',
      issuer: {
        cnpj_cpf: issuerCnpjCpf,
        name: issuerName,
        uf: emit.enderEmit?.UF,
      },
      receiver: {
        cnpj_cpf: receiverCnpjCpf,
        name: receiverName,
        uf: receiverUf,
      },
      total_value: totalValue,
      totals: {
        vTotTrib: Number(imp.vTotTrib ?? undefined),
        vBCIBSCBS: vBCIBSCBS || undefined,
        vIBS,
        vCBS,
      },
      items,
      status: 'VALID',
      source_filename: filename,
      referenced_keys,
    };
  }
}
