/* *****************************************************************************
 * Caleydo - Visualization for Molecular Biology - http://caleydo.org
 * Copyright (c) The Caleydo Team. All rights reserved.
 * Licensed under the new BSD license, available at http://caleydo.org/license
 **************************************************************************** */
/**
 * Created by michael gillhofer
 */
'use strict';


export enum TokenType {
    string,
    ordinal,
    ordinalIDType,
    idtype
  };


export abstract class IStateToken {
  name: string;
  importance: number;

  constructor(name:string, importance:number) {
    this.name = name;
    this.importance = importance;
  }

  //calculates the total importance of all Leaf tokens for each category.
  abstract categoryImportanceOfChilds():number[];

}

export class StateTokenNode extends IStateToken {

  childs: IStateToken[]

  constructor(name:string, importance:number, childs:IStateToken[]) {
    super(name,importance)
    this.childs = childs
  }

  //calculates the total importance of all Leaf tokens for each category.

  categoryImportanceOfChilds():number[] {
    let weight:number[] = [0,0,0,0,0];
    let sum:number[] = [];
    for (let i = 0; i < this.childs.length; i++) {
      let w = this.childs[i].categoryImportanceOfChilds()
      weight[0] += w[0]
      weight[1] += w[1]
      weight[2] += w[2]
      weight[3] += w[3]
      weight[4] += w[4]
    }
    return weight;
  }
}

export class StateTokenLeaf extends IStateToken{

  static categories:string[] = ["data", "visual", "selection", "layout", "analysis"]

  type: TokenType;
  value;
  category:string;

  constructor(name:string,  importance: number,  type: TokenType,  value,  category:string) {
    super(name,importance);
    this.type = type;;
    this.value = value;;
    this.category = category;
  }

    //calculates the total importance of all Leaf tokens for each category.
  categoryImportanceOfChilds():number[] {
    let weight:number[] = [0,0,0,0,0];
    weight[StateTokenLeaf.categories.indexOf(this.category)] = this.importance;
    return weight;
  }

}
