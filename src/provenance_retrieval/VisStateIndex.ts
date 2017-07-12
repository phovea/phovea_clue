/**
 * Created by Holger Stitz on 07.06.2017.
 */
import {IVisState} from 'phovea_core/src/provenance/retrieval/VisState';
import {IPropertyValue, PropertyType} from 'phovea_core/src/provenance/retrieval/VisStateProperty';
import {COMPARATORS, selectComparator} from './VisStatePropertyComparator';
import * as d3 from 'd3';

export interface IQuery {
  propValues: IPropertyValue[];
  weights: number[];
  colors: string[];

  addPropValue(propValue:IPropertyValue):IQuery;
  removePropValue(propValue:IPropertyValue):IQuery;

  replacePropValues(propValue:IPropertyValue[]):IQuery;
}

export interface ISearchResult {
  query: IQuery;
  state: IVisState;
  similarities: number[];
  similarity: number;
}

const colorScale =  d3.scale.category20();

export class Query implements IQuery {

  private _propValues:IPropertyValue[] = [];
  private _weights:number[] = [];

  constructor() {
    //
  }

  get propValues():IPropertyValue[] {
    return this._propValues;
  }

  get weights():number[] {
    return this._weights;
  }

  get colors():string[] {
    return this.propValues.map((d) => colorScale(String(d.id)));
  }

  addPropValue(propValue:IPropertyValue):IQuery {
    const q = new Query();
    q._propValues = [].concat(this.propValues, propValue);
    return q;
  }

  removePropValue(propValue:IPropertyValue):IQuery {
    const q = new Query();
    q._propValues = this.propValues.filter((d) => d !== propValue);
    return q;
  }

  replacePropValues(propValue:IPropertyValue[]):IQuery {
    const q = new Query();
    q._propValues = [].concat(...propValue);
    return q;
  }

}

export class VisStateIndex {

  states: IVisState[] = [];

  constructor() {
    //
  }

  addState(state: IVisState) {
    if(this.states.indexOf(state) > -1) {
      return false;
    }

    this.states = [...this.states, state];

    COMPARATORS.forEach((c) => {
      c.addState(state);
    });

    return true;
  }

  compareAll(query:IQuery):ISearchResult[] {
    return this.states.map((s) => VisStateIndex.compare(query, s));
  }

  static compare(query:IQuery, state: IVisState):ISearchResult {
    const similarities = state.compare(selectComparator, query.propValues);

    return <ISearchResult>{
      query,
      state,
      similarities,
      similarity: similarities.reduce((a,b) => a + b, 0.0)
    };
  }

}
