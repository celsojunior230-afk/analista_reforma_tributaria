/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DocumentType } from '../../domain/models/FiscalDocument';
import { IXmlParser } from './IXmlParser';
import { ParserNFe } from './ParserNFe';
import { ParserCTe } from './ParserCTe';
import { ParserNFSe } from './ParserNFSe';

export class ParserFactory {
  static getParser(type: DocumentType): IXmlParser {
    switch (type) {
      case 'NFE':
      case 'NFCE':
        return new ParserNFe();
      case 'CTE':
        return new ParserCTe();
      case 'NFSE':
        return new ParserNFSe();
      default:
        throw new Error(`Unsupported document type for parsing: ${type}`);
    }
  }
}
