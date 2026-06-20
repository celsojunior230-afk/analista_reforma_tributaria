/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FiscalDocument } from '../../domain/models/FiscalDocument';

export interface IXmlParser {
  parse(xmlContent: string, filename: string): FiscalDocument;
}
