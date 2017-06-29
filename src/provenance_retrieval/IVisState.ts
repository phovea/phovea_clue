/**
 * Created by Holger Stitz on 07.06.2017.
 */
import {IProperty, IPropertyValue} from 'phovea_core/src/provenance/retrieval/VisStateProperty';

export interface IVisStateApp {
  getVisStateProps(): Promise<IProperty[]>;
  getCurrVisState(): IPropertyValue[];
}

