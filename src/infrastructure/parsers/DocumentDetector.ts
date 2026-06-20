/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DocumentType } from '../../domain/models/FiscalDocument';

export class DocumentDetector {
  static detect(xmlContent: string): DocumentType {
    if (/<cteProc/i.test(xmlContent) || /<CTe/i.test(xmlContent)) {
      return 'CTE';
    }

    if (/sped\.fazenda\.gov\.br\/nfse/i.test(xmlContent) || /<infNFSe/i.test(xmlContent) || /<NFSe/i.test(xmlContent)) {
      return 'NFSE';
    }

    if (/<nfeProc/i.test(xmlContent) || /<NFe/i.test(xmlContent)) {
      // Determine model: mod 55 is NFE, mod 65 is NFCE
      const modMatch = /<mod>(\d+)<\/mod>/.exec(xmlContent);
      if (modMatch && modMatch[1] === '65') {
        return 'NFCE';
      }
      return 'NFE';
    }

    return 'UNKNOWN';
  }
}
