/**
 * Created by Holger Stitz on 07.06.2017.
 */
import {IProperty} from './VisStateProperty';

export interface IVisStateApp {
  getVisStateProps(): Promise<IProperty[]>;
  getCurrVisState(): string[];
}

