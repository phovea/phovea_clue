/**
 * Created by Holger Stitz on 07.06.2017.
 */

import {ISelect2Data} from './Select2';

export interface IVisStateApp {
  getVisStateAttrs(): ISelect2Data[];
  getCurrVisState(): string[];
}
