/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { XMLParser } from 'fast-xml-parser';
import { FiscalDocument, FiscalItem } from '../../domain/models/FiscalDocument';
import { IXmlParser } from './IXmlParser';

export class ParserNFe implements IXmlParser {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: true,
      isArray: (name) => name === 'det',
    });
  }

  parse(xmlContent: string, filename: string): FiscalDocument {
    const rawObj = this.parser.parse(xmlContent);
    const nfeProc = rawObj.nfeProc || rawObj;
    const nfe = nfeProc.NFe || nfeProc;
    const infNFe = nfe.infNFe;

    if (!infNFe) {
      throw new Error(`Invalid XML structure for NFe: missing 'infNFe' in ${filename}`);
    }

    const accessKey = (infNFe['@_Id'] || '').replace('NFe', '');
    const version = infNFe['@_versao'] || '4.00';

    const ide = infNFe.ide || {};
    const mod = String(ide.mod || '55');
    const docType = mod === '65' ? 'NFCE' : 'NFE';

    const issueDate = ide.dhEmi || ide.dEmi || new Date().toISOString();
    
    // map purpose
    let purpose: 'NORMAL' | 'COMPLEMENTAR' | 'AJUSTE' | 'DEVOLUCAO' | 'UNKNOWN' = 'NORMAL';
    const finNFe = Number(ide.finNFe);
    if (finNFe === 1) purpose = 'NORMAL';
    else if (finNFe === 2) purpose = 'COMPLEMENTAR';
    else if (finNFe === 3) purpose = 'AJUSTE';
    else if (finNFe === 4) purpose = 'DEVOLUCAO';

    const emit = infNFe.emit || {};
    const issuerCnpjCpf = String(emit.CNPJ || emit.CPF || '');
    const issuerName = String(emit.xNome || 'Emitente Desconhecido');
    const issuerUf = emit.enderEmit?.UF || undefined;
    
    // Tax regime (CRT): 1/2 = SIMPLES_NACIONAL, 3 = RPA
    const crt = Number(emit.CRT);
    const taxRegime = (crt === 1 || crt === 2) ? 'SIMPLES_NACIONAL' : crt === 3 ? 'RPA' : 'UNKNOWN';

    const dest = infNFe.dest;
    let receiverCnpjCpf = 'CONSUMIDOR_FINAL';
    let receiverName = 'CONSUMIDOR FINAL';
    let receiverUf = undefined;

    if (dest) {
      receiverCnpjCpf = String(dest.CNPJ || dest.CPF || 'CONSUMIDOR_FINAL');
      receiverName = String(dest.xNome || 'CONSUMIDOR FINAL');
      receiverUf = dest.enderDest?.UF || undefined;
    }

    // Parsing items
    const rawItems = Array.isArray(infNFe.det) ? infNFe.det : infNFe.det ? [infNFe.det] : [];
    const items: FiscalItem[] = rawItems.map((det: any, index: number) => {
      const prod = det.prod || {};
      const imposto = det.imposto || {};
      
      const itemNum = Number(det['@_nItem'] || index + 1);
      const desc = String(prod.xProd || 'Produto sem descrição');
      const cfop = String(prod.CFOP || '');
      const ncm = String(prod.NCM || '');
      const grossVal = Number(prod.vProd || 0);
      const descVal = Number(prod.vDesc || 0);
      const netVal = grossVal - descVal;

      // Legacy taxes
      const icmsParent = imposto.ICMS || {};
      const icmsGroup = Object.values(icmsParent)[0] as any || {};
      const pisParent = imposto.PIS || {};
      const pisGroup = Object.values(pisParent)[0] as any || {};
      const cofinsParent = imposto.COFINS || {};
      const cofinsGroup = Object.values(cofinsParent)[0] as any || {};
      const ipiParent = imposto.IPI || {};
      const ipiGroup = ipiParent.IPITrib || {};

      // IBS/CBS fields
      const ibscbs = imposto.IBSCBS || {};
      const gIBSCBS = ibscbs.gIBSCBS || {};
      const gIBSUF = gIBSCBS.gIBSUF || {};
      const gIBSMun = gIBSCBS.gIBSMun || {};
      const gCBS = gIBSCBS.gCBS || {};

      const cst = String(ibscbs.CST || gIBSCBS.CST || '');
      const c_class_trib = String(ibscbs.cClassTrib || gIBSCBS.cClassTrib || '');
      
      const vBC = Number(gIBSCBS.vBC ?? ibscbs.vBC ?? 0);
      const pIBSUF = Number(gIBSUF.pIBSUF ?? undefined);
      const vIBSUF = Number(gIBSUF.vIBSUF ?? undefined);
      const pIBSMun = Number(gIBSMun.pIBSMun ?? undefined);
      const vIBSMun = Number(gIBSMun.vIBSMun ?? undefined);
      
      // Total IBS
      const vIBS = Number(gIBSCBS.vIBS ?? (vIBSUF + vIBSMun) ?? undefined);
      const pCBS = Number(gCBS.pCBS ?? undefined);
      const vCBS = Number(gCBS.vCBS ?? undefined);

      return {
        item_number: itemNum,
        description: desc,
        cfop,
        ncm,
        gross_value: grossVal,
        discount_value: descVal,
        net_value: netVal,
        rtc: {
          cst,
          c_class_trib,
          vBC: vBC || undefined,
          pIBSUF,
          vIBSUF,
          pIBSMun,
          vIBSMun,
          vIBS: vIBS || undefined,
          pCBS,
          vCBS,
        },
        rtc_impact: 'NONE', // will be loaded dynamically by TaxAnalyzerService
        taxes_current: {
          icms_cst: String(icmsGroup.CST || icmsGroup.CSOSN || ''),
          icms_base: Number(icmsGroup.vBC ?? undefined),
          icms_rate: Number(icmsGroup.pICMS ?? undefined),
          icms_value: Number(icmsGroup.vICMS ?? undefined),
          pis_cst: String(pisGroup.CST || ''),
          pis_base: Number(pisGroup.vBC ?? undefined),
          pis_rate: Number(pisGroup.pPIS ?? undefined),
          pis_value: Number(pisGroup.vPIS ?? undefined),
          cofins_cst: String(cofinsGroup.CST || ''),
          cofins_base: Number(cofinsGroup.vBC ?? undefined),
          cofins_rate: Number(cofinsGroup.pCOFINS ?? undefined),
          cofins_value: Number(cofinsGroup.vCOFINS ?? undefined),
          ipi_cst: String(ipiGroup.CST || ''),
          ipi_base: Number(ipiGroup.vBC ?? undefined),
          ipi_rate: Number(ipiGroup.pIPI ?? undefined),
          ipi_value: Number(ipiGroup.vIPI ?? undefined),
        },
      };
    });

    // Parse aggregate totals
    const total = infNFe.total || {};
    const icmsTot = total.ICMSTot || {};
    const ibscbsTot = total.IBSCBSTot || {};
    const totalVal = Number(icmsTot.vNF || 0);

    return {
      access_key: accessKey,
      document_type: docType,
      version,
      issue_date: issueDate,
      purpose,
      tax_regime: taxRegime,
      direction: 'UNKNOWN', // loaded by Service
      issuer: {
        cnpj_cpf: issuerCnpjCpf,
        name: issuerName,
        uf: issuerUf,
      },
      receiver: {
        cnpj_cpf: receiverCnpjCpf,
        name: receiverName,
        uf: receiverUf,
      },
      total_value: totalVal,
      totals: {
        vProd: Number(icmsTot.vProd ?? undefined),
        vDesc: Number(icmsTot.vDesc ?? undefined),
        vFrete: Number(icmsTot.vFrete ?? undefined),
        vTotTrib: Number(icmsTot.vTotTrib ?? undefined),
        vICMS: Number(icmsTot.vICMS ?? undefined),
        vPIS: Number(icmsTot.vPIS ?? undefined),
        vCOFINS: Number(icmsTot.vCOFINS ?? undefined),
        vBCIBSCBS: Number(ibscbsTot.vBCIBSCBS ?? undefined),
        vIBS: Number(ibscbsTot.gIBS?.vIBS ?? undefined),
        vCBS: Number(ibscbsTot.gCBS?.vCBS ?? undefined),
      },
      items,
      status: 'VALID',
      source_filename: filename,
      raw_xml: xmlContent,
    };
  }
}
