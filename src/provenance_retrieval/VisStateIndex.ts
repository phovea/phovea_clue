/**
 * Created by Holger Stitz on 07.06.2017.
 */
import {IVisState} from 'phovea_core/src/provenance/retrieval/VisState';
import {IPropertyValue} from 'phovea_core/src/provenance/retrieval/VisStateProperty';
import {COMPARATORS, selectComparator} from './VisStatePropertyComparator';
import * as d3 from 'd3';

export interface IQuery {
  propValues: IPropertyValue[];
  weights: number[];
  colors: string[];

  addPropValue(propValue:IPropertyValue):IQuery;
  removePropValue(propValue:IPropertyValue):IQuery;

  replacePropValues(propValue:IPropertyValue[]):IQuery;
  clear():IQuery;
}

export interface ISearchResult {
  id: string;
  state: IVisState;

  query: IQuery;
  numMatchingTerms: number;

  similarities: number[];
  weightedSimilarities: number[];
  similarity: number;
  weightedSimilarity: number;

  update();
}

export interface ISearchResultSequence {
  id: string;
  topResult: ISearchResult;
  searchResults: ISearchResult[];

  update();
}

const COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5', '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5'
];

const colorScale =  d3.scale.ordinal().range(COLORS);

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

  set weights(value:number[]) {
    this._weights = value;
  }

  get colors():string[] {
    return this.propValues.map((d) => <string>colorScale(String(d.id)));
  }

  addPropValue(propValue:IPropertyValue):IQuery {
    // no new query, if property is already in query
    if(this.propValues.indexOf(propValue) > -1) {
      return this;
    }

    const q = new Query();
    q._propValues = [].concat(this.propValues, propValue);
    const newPercentage = 1 / q._propValues.length;
    // transform the old weight distribution to the new percentage and add the weight for the new prop
    q._weights = [...this.weights.map((d, i, arr) => d * newPercentage * arr.length), newPercentage];
    return q;
  }

  removePropValue(propValue:IPropertyValue):IQuery {
    const q = new Query();
    const index = this.propValues.indexOf(propValue);

    q._propValues = this.propValues.filter((d,i) => i !== index);

    q._weights = this.weights.filter((d, i) => i !== index);
    const newPercentage = 1 / q._weights.reduce((a, b) => a + b, 0.0);
    q._weights = q._weights.map((d) => d * newPercentage);

    return q;
  }

  replacePropValues(propValue:IPropertyValue[]):IQuery {
    const q = new Query();
    q._propValues = [].concat(...propValue);
    const newPercentage = 1 / q._propValues.length;
    q._weights = Array.apply(null, Array(q._propValues.length)).map(() => newPercentage);

    return q;
  }

  clear():IQuery {
    return new Query();
  }

}

class SearchResult implements ISearchResult {

  numMatchingTerms: number;
  similarity: number;

  private _weightedSimilarities: number[];
  private _weightedSimilarity: number;

  constructor(public query: IQuery, public state: IVisState, public similarities: number[]) {
    this.similarity = this.similarities.reduce((a,b) => a + b, 0.0);
    this.numMatchingTerms = this.similarities.filter((d) => d > 0).length;
    this.update();
  }

  get id(): string {
    return String(this.state.node.id);
  }

  get weightedSimilarities(): number[] {
    return this._weightedSimilarities;
  }

  get weightedSimilarity(): number {
    return this._weightedSimilarity;
  }

  update() {
    this._weightedSimilarities = this.similarities.map((d, i) => d * this.query.weights[i]);
    this._weightedSimilarity = this.weightedSimilarities.reduce((a,b) => a + b, 0.0);
  }
}

export class SearchResultSequence implements ISearchResultSequence {

  topResult:ISearchResult;
  id: string;

  constructor(public searchResults: ISearchResult[]) {
    this.update();
  }

  update() {
    this.searchResults.forEach((d) => d.update());

    // get top result which is the first state with the highest similarity score
    this.topResult = this.searchResults.reduce((a,b) => ((a.weightedSimilarity >= b.weightedSimilarity) ? a : b));
    // create sequence id from list of all states
    this.id = this.searchResults.map((d) => d.state.node.id).join(',');
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
    return new SearchResult(query, state, similarities);
  }

}
