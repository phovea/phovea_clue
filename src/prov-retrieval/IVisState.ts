/**
 * Created by Holger Stitz on 07.06.2017.
 */

export interface IVisStateApp {
  getVisStateAttrs(): IVisStateCategory[];
  getCurrVisState(): string[];
}

export interface IVisStateAttr {
  text: string;
  id?: string;
  param?: boolean;
}

export interface IVisStateCategory extends IVisStateAttr {
  children?: IVisStateAttr[];
}
