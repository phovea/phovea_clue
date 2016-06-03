/* *****************************************************************************
 * Caleydo - Visualization for Molecular Biology - http://caleydo.org
 * Copyright (c) The Caleydo Team. All rights reserved.
 * Licensed under the new BSD license, available at http://caleydo.org/license
 **************************************************************************** */
/**
 * Created by michael gillhofer
 */
'use strict';
import {isUndefined} from "../caleydo_core/main";
import {IDType} from "../caleydo_core/idtype";


export enum TokenType {
    string,
    ordinal,
    ordinalIDType,
    idtype
  };


export abstract class IStateToken {
  name: string;
  importance: number;


  protected catImpOfChilds:number[];

  constructor(name:string, importance:number) {
    this.name = name;
    this.importance = importance;
  }

  public isLeaf:boolean;
}

export class StateTokenNode extends IStateToken {

  childs: IStateToken[]

  constructor(name:string, importance:number, childs:IStateToken[]) {
    super(name,importance)
    this.childs = childs
    this.isLeaf = false;
  }

}

export class StateTokenLeaf extends IStateToken{


  static categories:string[] = ["data", "visual", "selection", "layout", "analysis"]

  type: TokenType;
  value;
  category:string;
  hash=null;

  constructor(name:string,  importance: number,  type: TokenType,  value,  category:string) {
    super(name,importance);
    this.type = type;;
    this.value = value;;
    this.category = category;
    this.isLeaf = true;
  }

}
