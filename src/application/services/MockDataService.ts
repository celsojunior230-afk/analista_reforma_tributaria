/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FiscalDocument } from '../../domain/models/FiscalDocument';

export class MockDataService {
  static getMockDocuments(referenceCnpj: string): FiscalDocument[] {
    const cleanRef = referenceCnpj.replace(/\D/g, '') || '03124567000189';

    return [
      // 1. INBOUND: NF-e RPA with IBS/CBS Highlight
      {
        access_key: '35260101234567000101550010000001011234567890',
        document_type: 'NFE',
        version: '4.00',
        issue_date: '2026-01-15T14:30:00-03:00',
        purpose: 'NORMAL',
        tax_regime: 'RPA',
        direction: 'INBOUND',
        issuer: {
          cnpj_cpf: '45987123000140',
          name: 'Metalúrgica Inox Brasil Ltda',
          uf: 'SP',
        },
        receiver: {
          cnpj_cpf: cleanRef,
          name: 'Comércio Industrial Delta S/A',
          uf: 'SP',
        },
        total_value: 15450.0,
        totals: {
          vProd: 15000.0,
          vDesc: 0,
          vFrete: 450.0,
          vTotTrib: 1845.0,
          vBCIBSCBS: 15450.0,
          vIBS: 1236.0, // 8% IBS
          vCBS: 1390.5, // 9% CBS
        },
        items: [
          {
            item_number: 1,
            description: 'Chapa de Aço Inoxidável Recozido',
            cfop: '5101',
            ncm: '72199000',
            gross_value: 15000.0,
            discount_value: 0,
            net_value: 15000.0,
            rtc_impact: 'CREDIT',
            rtc: {
              cst: '001',
              vBC: 15000.0,
              vIBS: 1200.0,
              vCBS: 1350.0,
            },
            taxes_current: {
              icms_cst: '00',
              icms_base: 15000.0,
              icms_rate: 18,
              icms_value: 2700.0,
            },
          },
        ],
        status: 'VALID',
        source_filename: 'nfe_inox_rpa_entrada.xml',
      },

      // 2. INBOUND: NF-e Simples Nacional - correctly NOT highlighting IBS/CBS
      {
        access_key: '35260198765432000188550010000001021234567891',
        document_type: 'NFE',
        version: '4.00',
        issue_date: '2026-02-10T10:15:00-03:00',
        purpose: 'NORMAL',
        tax_regime: 'SIMPLES_NACIONAL',
        direction: 'INBOUND',
        issuer: {
          cnpj_cpf: '12345098000122',
          name: 'Embalagens São Caetano ME',
          uf: 'SP',
        },
        receiver: {
          cnpj_cpf: cleanRef,
          name: 'Comércio Industrial Delta S/A',
          uf: 'SP',
        },
        total_value: 2800.0,
        totals: {
          vProd: 2800.0,
          vDesc: 0,
        },
        items: [
          {
            item_number: 1,
            description: 'Caixas de Papelão Ondulado KFT-20',
            cfop: '5102',
            ncm: '48191000',
            gross_value: 2800.0,
            discount_value: 0,
            net_value: 2800.0,
            rtc_impact: 'NONE',
            rtc: {
              cst: '003', // exempt or Simples
            },
            taxes_current: {
              icms_cst: '102', // Simples
            },
          },
        ],
        status: 'VALID',
        source_filename: 'nfe_embalagens_nao_credita.xml',
      },

      // 3. INBOUND: NF-e RPA - INCONFORMIDADE (Omitted highlight post-2026)
      {
        access_key: '31260388776655000199550010000001031234567892',
        document_type: 'NFE',
        version: '4.00',
        issue_date: '2026-03-05T09:00:00-03:00',
        purpose: 'NORMAL',
        tax_regime: 'RPA',
        direction: 'INBOUND',
        issuer: {
          cnpj_cpf: '88776655000199',
          name: 'Distribuidora Ferroligas Minas Ltda',
          uf: 'MG',
        },
        receiver: {
          cnpj_cpf: cleanRef,
          name: 'Comércio Industrial Delta S/A',
          uf: 'SP',
        },
        total_value: 9500.0,
        totals: {
          vProd: 9500.0,
          vDesc: 0,
        },
        items: [
          {
            item_number: 1,
            description: 'Eletrodo Revestido de Solda 3.2mm',
            cfop: '6102', // commercial, should have highlight
            ncm: '83111000',
            gross_value: 9500.0,
            discount_value: 0,
            net_value: 9500.0,
            rtc_impact: 'NONE',
            rtc: {}, // Omitted tags completely!
            taxes_current: {
              icms_cst: '00',
              icms_base: 9500.0,
              icms_rate: 12,
              icms_value: 1140.0,
            },
          },
        ],
        status: 'VALID',
        source_filename: 'nfe_ferroligas_inconforme.xml',
      },

      // 4. INBOUND: CT-e freight with credits
      {
        access_key: '35260199887766000111570010000002101234567893',
        document_type: 'CTE',
        version: '3.00',
        issue_date: '2026-01-16T18:00:00-03:00',
        purpose: 'NORMAL',
        tax_regime: 'RPA',
        direction: 'INBOUND',
        issuer: {
          cnpj_cpf: '99887766000111',
          name: 'Rapidez Guarulhos Transportadora S/A',
          uf: 'SP',
        },
        receiver: {
          cnpj_cpf: cleanRef,
          name: 'Comércio Industrial Delta S/A',
          uf: 'SP',
        },
        total_value: 1250.0,
        totals: {
          vBCIBSCBS: 1250.0,
          vIBS: 100.0,
          vCBS: 112.5,
        },
        items: [
          {
            item_number: 1,
            description: 'Serviço de Frete Rodoviário',
            cfop: '5352',
            ncm: 'N/A',
            gross_value: 1250.0,
            discount_value: 0,
            net_value: 1250.0,
            rtc_impact: 'CREDIT',
            rtc: {
              cst: '001',
              vBC: 1250.0,
              vIBS: 100.0,
              vCBS: 112.5,
            },
            taxes_current: {},
          },
        ],
        status: 'VALID',
        source_filename: 'cte_inox_frete.xml',
      },

      // 5. INBOUND: NFS-e Nacional with Service credits
      {
        access_key: '35260588112233000144000001100000030212345678',
        document_type: 'NFSE',
        version: '1.01',
        issue_date: '2026-04-12T16:45:00-03:00',
        purpose: 'NORMAL',
        tax_regime: 'RPA',
        direction: 'INBOUND',
        issuer: {
          cnpj_cpf: '88112233000144',
          name: 'Sistemas Inteligentes de Nuvem Ltda',
          uf: 'SP',
        },
        receiver: {
          cnpj_cpf: cleanRef,
          name: 'Comércio Industrial Delta S/A',
          uf: 'SP',
        },
        total_value: 4500.0,
        totals: {
          vProd: 4500.0,
          vDesc: 0,
          vBCIBSCBS: 4500.0,
          vIBS: 360.0,
          vCBS: 405.0,
        },
        items: [
          {
            item_number: 1,
            description: 'Hospedagem e Licenciamento de Servidores',
            cfop: '1.03', // NBS Code
            ncm: '1234',
            gross_value: 4500.0,
            discount_value: 0,
            net_value: 4500.0,
            rtc_impact: 'CREDIT',
            rtc: {
              cst: '001',
              vBC: 4500.0,
              vIBS: 360.0,
              vCBS: 405.0,
            },
            taxes_current: {},
          },
        ],
        status: 'VALID',
        source_filename: 'nfse_cloud_services.xml',
      },

      // 6. OUTBOUND: NF-e RPA - Sales B2B (with Debit Highlights)
      {
        access_key: '35260103124567000189550010000005011234567894',
        document_type: 'NFE',
        version: '4.00',
        issue_date: '2026-01-20T11:00:00-03:00',
        purpose: 'NORMAL',
        tax_regime: 'RPA',
        direction: 'OUTBOUND',
        issuer: {
          cnpj_cpf: cleanRef,
          name: 'Comércio Industrial Delta S/A',
          uf: 'SP',
        },
        receiver: {
          cnpj_cpf: '33445566000122',
          name: 'Motores Industriais Bandeirante Ltda',
          uf: 'SP',
        },
        total_value: 24500.0,
        totals: {
          vProd: 24000.0,
          vDesc: 0,
          vFrete: 500.0,
          vBCIBSCBS: 24500.0,
          vIBS: 1960.0, // 8% IBS
          vCBS: 2205.0, // 9% CBS
        },
        items: [
          {
            item_number: 1,
            description: 'Painéis Pneumáticos Hidráulicos Delta-H',
            cfop: '5101',
            ncm: '84122110',
            gross_value: 24000.0,
            discount_value: 0,
            net_value: 24000.0,
            rtc_impact: 'DEBIT',
            rtc: {
              cst: '001',
              vBC: 24500.0,
              vIBS: 1960.0,
              vCBS: 2205.0,
            },
            taxes_current: {
              icms_cst: '00',
              icms_base: 24000.0,
              icms_rate: 18,
              icms_value: 4320.0,
            },
          },
        ],
        status: 'VALID',
        source_filename: 'nfe_venda_painel_b2b.xml',
      },

      // 7. OUTBOUND: NF-e RPA - Sales B2C (CPF destination)
      {
        access_key: '35260203124567000189550010000005021234567895',
        document_type: 'NFE',
        version: '4.00',
        issue_date: '2026-02-18T16:30:00-03:00',
        purpose: 'NORMAL',
        tax_regime: 'RPA',
        direction: 'OUTBOUND',
        issuer: {
          cnpj_cpf: cleanRef,
          name: 'Comércio Industrial Delta S/A',
          uf: 'SP',
        },
        receiver: {
          cnpj_cpf: '453.987.123-01',
          name: 'Gilberto S. Martins',
          uf: 'SP',
        },
        total_value: 12000.0,
        totals: {
          vProd: 12000.0,
          vDesc: 0,
          vBCIBSCBS: 12000.0,
          vIBS: 960.0,
          vCBS: 1080.0,
        },
        items: [
          {
            item_number: 1,
            description: 'Servomotores Rotativos de Posicionamento',
            cfop: '5102',
            ncm: '85015110',
            gross_value: 12000.0,
            discount_value: 0,
            net_value: 12000.0,
            rtc_impact: 'DEBIT',
            rtc: {
              cst: '001',
              vBC: 12000.0,
              vIBS: 960.0,
              vCBS: 1080.0,
            },
            taxes_current: {},
          },
        ],
        status: 'VALID',
        source_filename: 'nfe_venda_servomotores_b2c.xml',
      },

      // 8. OUTBOUND: NF-e RPA - Sales B2B in March
      {
        access_key: '50260303124567000189550010000005031234567896',
        document_type: 'NFE',
        version: '4.00',
        issue_date: '2026-03-15T11:45:00-03:00',
        purpose: 'NORMAL',
        tax_regime: 'RPA',
        direction: 'OUTBOUND',
        issuer: {
          cnpj_cpf: cleanRef,
          name: 'Comércio Industrial Delta S/A',
          uf: 'SP',
        },
        receiver: {
          cnpj_cpf: '44556677000133',
          name: 'Equipamentos Metalúrgicos Rio Doce',
          uf: 'ES',
        },
        total_value: 35000.0,
        totals: {
          vProd: 35000.0,
          vDesc: 0,
          vBCIBSCBS: 35000.0,
          vIBS: 2800.0,
          vCBS: 3150.0,
        },
        items: [
          {
            item_number: 1,
            description: 'Trens Hidráulicos de Válvulas Distribuidoras',
            cfop: '6101',
            ncm: '84812090',
            gross_value: 35000.0,
            discount_value: 0,
            net_value: 35000.0,
            rtc_impact: 'DEBIT',
            rtc: {
              cst: '001',
              vBC: 35000.0,
              vIBS: 2800.0,
              vCBS: 3150.0,
            },
            taxes_current: {},
          },
        ],
        status: 'VALID',
        source_filename: 'nfe_venda_valvulas_b2b_es.xml',
      },

      // 9. OUTBOUND: NF-e RPA - Sales B2B in April
      {
        access_key: '35260403124567000189550010000005041234567897',
        document_type: 'NFE',
        version: '4.00',
        issue_date: '2026-04-20T10:00:00-03:00',
        purpose: 'NORMAL',
        tax_regime: 'RPA',
        direction: 'OUTBOUND',
        issuer: {
          cnpj_cpf: cleanRef,
          name: 'Comércio Industrial Delta S/A',
          uf: 'SP',
        },
        receiver: {
          cnpj_cpf: '88776655000100',
          name: 'Automação Comercial Centro-Oeste Ltda',
          uf: 'GO',
        },
        total_value: 19800.0,
        totals: {
          vProd: 19800.0,
          vDesc: 0,
          vBCIBSCBS: 19800.0,
          vIBS: 1584.0,
          vCBS: 1782.0,
        },
        items: [
          {
            item_number: 1,
            description: 'Controladores Lógicos Programáveis Integrais',
            cfop: '6102',
            ncm: '85371020',
            gross_value: 19800.0,
            discount_value: 0,
            net_value: 19800.0,
            rtc_impact: 'DEBIT',
            rtc: {
              cst: '001',
              vBC: 19800.0,
              vIBS: 1584.0,
              vCBS: 1782.0,
            },
            taxes_current: {},
          },
        ],
        status: 'VALID',
        source_filename: 'nfe_venda_clp_b2b_go.xml',
      },

      // 10. OUTBOUND: NF-e RPA - Sales B2B in May (High volume)
      {
        access_key: '35260503124567000189550010000005051234567898',
        document_type: 'NFE',
        version: '4.00',
        issue_date: '2026-05-18T14:15:00-03:00',
        purpose: 'NORMAL',
        tax_regime: 'RPA',
        direction: 'OUTBOUND',
        issuer: {
          cnpj_cpf: cleanRef,
          name: 'Comércio Industrial Delta S/A',
          uf: 'SP',
        },
        receiver: {
          cnpj_cpf: '33445566000122',
          name: 'Motores Industriais Bandeirante Ltda',
          uf: 'SP',
        },
        total_value: 52000.0,
        totals: {
          vProd: 52000.0,
          vDesc: 0,
          vBCIBSCBS: 52000.0,
          vIBS: 4160.0,
          vCBS: 4680.0,
        },
        items: [
          {
            item_number: 1,
            description: 'Redutores Planetários e Flanges Conjugadas',
            cfop: '5101',
            ncm: '84834010',
            gross_value: 52000.0,
            discount_value: 0,
            net_value: 52000.0,
            rtc_impact: 'DEBIT',
            rtc: {
              cst: '001',
              vBC: 52000.0,
              vIBS: 4160.0,
              vCBS: 4680.0,
            },
            taxes_current: {},
          },
        ],
        status: 'VALID',
        source_filename: 'nfe_venda_redutores_maio.xml',
      }
    ];
  }
}
