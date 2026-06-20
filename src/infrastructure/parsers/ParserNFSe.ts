/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { XMLParser } from 'fast-xml-parser';
import { FiscalDocument, FiscalItem, TaxRegime } from '../../domain/models/FiscalDocument';
import { IXmlParser } from './IXmlParser';

export class ParserNFSe implements IXmlParser {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: true,
      removeNSPrefix: true, // removes "nfse:" or municipal namespaces unifiying results!
      isArray: (name) => false,
    });
  }

  parse(xmlContent: string, filename: string): FiscalDocument {
    const rawObj = this.parser.parse(xmlContent);
    const nfse = rawObj.NFSe || rawObj;
    const infNFSe = nfse.infNFSe;

    if (!infNFSe) {
      throw new Error(`Invalid XML structure for NFS-e Nacional: missing 'infNFSe' in ${filename}`);
    }

    const accessKey = (infNFSe['@_Id'] || '').replace('NFSe', '');
    const version = String(infNFSe['@_versao'] || '1.00');
    const numberNFSe = String(infNFSe.nNFSe || '');
    const issueDate = infNFSe.dhEmi || new Date().toISOString();

    const dps = infNFSe.DPS || {};
    const infDPS = dps.infDPS || {};
    
    // Prestador
    const prest = infDPS.prest || {};
    const issuerCnpjCpf = String(prest.CNPJ || prest.CPF || '');
    const issuerName = String(prest.xNome || 'Prestador Desconhecido');
    const issuerIm = String(prest.IM || '');

    // Tax regime
    const opSimpNac = prest.regTrib?.opSimpNac;
    let taxRegime: TaxRegime = 'UNKNOWN';
    if (opSimpNac === 0) taxRegime = 'RPA';
    else if (opSimpNac === 1) taxRegime = 'MEI';
    else if (opSimpNac === 2 || opSimpNac === 3) taxRegime = 'SIMPLES_NACIONAL';

    // Tomador
    const toma = infDPS.toma || {};
    const receiverCnpjCpf = String(toma.CNPJ || toma.CPF || 'TOMADOR_NAO_IDENTIFICADO');
    const receiverName = String(toma.xNome || 'Tomador Desconhecido');

    // Servico
    const serv = infDPS.serv || {};
    const serviceDesc = String(serv.xDescServ || 'Prestação de Serviço de NFS-e');
    const nbsCode = String(serv.cServ?.cTribNac || '');
    const munCode = String(serv.cServ?.cTribMun || '');
    const municipalityCode = String(serv.locPrest?.cLocPrestacao || infNFSe.cLocEmi || '');

    // Valores & Tributos
    const valores = infDPS.valores || {};
    const vServPrest = valores.vServPrest || {};
    const totalValue = Number(vServPrest.vServ || 0);

    const vDescCondIncond = valores.vDescCondIncond || {};
    const discountVal = Number(vDescCondIncond.vDescIncond || 0);
    const netVal = totalValue - discountVal;

    const trib = valores.trib || {};
    const tribMun = trib.tribMun || {};
    const tribISSQN = tribMun.tribISSQN || {};
    
    const tribFed = trib.tribFed || {};
    const ibscbs = tribFed.IBSCBS || {};
    const retTrib = tribFed.retTrib || {};
    const totTrib = trib.totTrib || {};

    const issBase = Number(tribISSQN.vBC || 0);
    const issRate = Number(tribISSQN.pAliq || 0);
    const issValue = issBase * (issRate / 100);
    const issRetained = Number(tribISSQN.tpRetISSQN) === 2;

    const cst = String(ibscbs.CST || '');
    const vBC = Number(ibscbs.vBC || 0);
    const vIBS = Number(ibscbs.vIBS || undefined);
    const pCBS = Number(ibscbs.pCBS || undefined);
    const vCBS = Number(ibscbs.vCBS || undefined);

    const items: FiscalItem[] = [
      {
        item_number: 1,
        description: serviceDesc,
        cfop: nbsCode, // NBS Code maps to functional CFOP in service layer
        ncm: munCode,
        gross_value: totalValue,
        discount_value: discountVal,
        net_value: netVal,
        rtc_impact: 'NONE',
        rtc: {
          cst,
          vBC: vBC || undefined,
          vIBS,
          pCBS,
          vCBS,
        },
        taxes_current: {
          iss_base: issBase || undefined,
          iss_rate: issRate || undefined,
          iss_value: issValue || undefined,
          iss_retained: issRetained,
          ir_value: Number(retTrib.vRetIRRF ?? undefined),
          pis_value: Number(retTrib.vRetPIS ?? undefined),
          cofins_value: Number(retTrib.vRetCOFINS ?? undefined),
          csll_value: Number(retTrib.vRetCSLL ?? undefined),
          inss_value: Number(retTrib.vRetINSS ?? undefined),
        },
      }
    ];

    return {
      access_key: accessKey,
      document_type: 'NFSE',
      version,
      issue_date: issueDate,
      purpose: 'NORMAL',
      tax_regime: taxRegime,
      direction: 'UNKNOWN',
      issuer: {
        cnpj_cpf: issuerCnpjCpf,
        name: issuerName,
        ie: issuerIm,
      },
      receiver: {
        cnpj_cpf: receiverCnpjCpf,
        name: receiverName,
      },
      total_value: totalValue,
      totals: {
        vProd: totalValue,
        vDesc: discountVal,
        vTotTrib: Number(totTrib.vTotTrib ?? undefined),
        vBCIBSCBS: vBC || undefined,
        vIBS,
        vCBS,
        vISS: issValue || undefined,
        vISSRet: issRetained ? issValue : undefined,
      },
      items,
      status: 'VALID',
      source_filename: filename,
      municipality_code: municipalityCode,
    };
  }
}
