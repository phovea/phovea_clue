/**
 * Created by Holger Stitz on 07.06.2017.
 */
import {IVisState} from 'phovea_core/src/provenance/retrieval/VisState';
import {
  IProperty, IPropertyValue, Property, PropertyType,
  TAG_VALUE_SEPARATOR
} from 'phovea_core/src/provenance/retrieval/VisStateProperty';
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

export class PropertyModifier {

  private _properties:IProperty[] = [];
  private _searchResults:ISearchResult[] = [];
  private _activeVisState:IVisState;

  private propertyLookup:Map<string, IProperty> = new Map();
  private idLookup:Map<string, IPropertyValue> = new Map();
  private idCounter:Map<string, number> = new Map();

  constructor(visStates:IVisState[]) {
    this.addStatesToLookup(visStates);
  }

  addState(visState:IVisState) {
    this.addStatesToLookup([visState]);
    this.modifyProperties();
  }

  get searchResults():ISearchResult[] {
    return this._searchResults;
  }

  set searchResults(value:ISearchResult[]) {
    this._searchResults = value;
    this.generateSimilarResultProps(this.properties, this.searchResults, 10);
    this.modifyProperties();
  }

  get properties():IProperty[] {
    return this._properties;
  }

  set properties(value:IProperty[]) {
    this._properties = value;
    this._properties.forEach((prop) => {
      prop.values.forEach((propVal) => {
        this.propertyLookup.set(propVal.baseId, prop);
      });
    });
    this.modifyProperties();
  }

  get activeVisState():IVisState {
    return this._activeVisState;
  }

  set activeVisState(visState:IVisState) {
    this._activeVisState = visState;
    this.modifyProperties();
  }

  private addStatesToLookup(visStates:IVisState[]) {
    visStates
      .filter((s) => s !== undefined || s !== null)
      .map((s) => s.propValues)
      .reduce((prev, curr) => prev.concat(curr), []) // flatten the  array
      .forEach((p) => {
        const id = PropertyModifier.getPropId(p);
        // filter None values
        if(id === 'None') {
          return;
        }
        this.idLookup.set(id, p);
        this.idLookup.set(p.baseId, p); // add baseId for correct disabled setting
        const counter = (this.idCounter.has(id)) ? this.idCounter.get(id) : 0;
        this.idCounter.set(id, counter+1);
      });
  }

  private modifyProperties() {
    if(this.properties.length === 0) {
      return;
    }

    this.generateTopProperties(this.properties, this.idCounter, this.idLookup, 10);

    this.properties.map((property) => {
      property.values.map((propVal) => {
        // important: mutable action (modifies original property data)
        this.updateActive(propVal);
        this.updateDisabled(propVal);
        return propVal;
      });
      return property;
    });
  }

  private generateTopProperties(properties:IProperty[], idCounter:Map<string, number>, idLookup:Map<string, IPropertyValue>, numTop:number = 10, propText = `Top ${numTop}`) {
    const vals = Array.from(idCounter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, numTop)
      .map((d) => idLookup.get(d[0]))
      .map((d) => {
        if(!d.payload) {
          d.payload = {};
        }
        d.payload.propText = this.propertyLookup.get(d.baseId).text;
        return d;
      });

    const topProperties = new Property(PropertyType.SET, propText, vals);

    const index = properties.findIndex((p) => p.text === topProperties.text);
    // replace if exists
    if(index > -1) {
      properties.splice(index, 1, topProperties);

    // add as first
    } else {
      properties.unshift(topProperties);
    }
  }

  private generateSimilarResultProps(properties:IProperty[], results:ISearchResult[], numTop:number = 10) {
    const propText = `Related Search Terms`;
    const index = properties.findIndex((p) => p.text === propText);

    if(results.length === 0) {
      // remove existing element
      if(index > -1) {
        properties.splice(index, 1);
      }
      return;
    }

    const queryPropVals = results[0].query.propValues;

    const idLookup:Map<string, IPropertyValue> = new Map();
    const idCounter:Map<string, number> = new Map();

    results
      .map((r) => r.state.propValues)
      .reduce((prev, curr) => prev.concat(curr), []) // flatten the  array
      .filter((p) => !queryPropVals.find((qp) => qp.baseId === p.baseId))
      .forEach((p) => {
        const id = PropertyModifier.getPropId(p);
        // filter None values
        if(id === 'None') {
          return;
        }
        idLookup.set(id, p);
        idLookup.set(p.baseId, p); // add baseId for correct disabled setting
        const counter = (idCounter.has(id)) ? idCounter.get(id) : 0;
        idCounter.set(id, counter+1);
      });

    this.generateTopProperties(properties, idCounter, idLookup, numTop, propText);
  }

  private updateDisabled(propVal:IPropertyValue) {
    // important: mutable action (modifies original property data)
    propVal.isDisabled = !this.idLookup.has(propVal.baseId);
  }

  private updateActive(propVal:IPropertyValue) {
    if(!this.activeVisState) {
      return;
    }
    // important: mutable action (modifies original property data)
    propVal.isActive = (this.activeVisState.propValues.filter((p) => PropertyModifier.getPropId(propVal) === PropertyModifier.getPropId(p)).length > 0);
  }

  private static getPropId(propVal:IPropertyValue):string {
    // use p.text for numerical properties to consider the numVal and distinguish between `skinny = 0.21` and `skinny = 0.22`
    return (propVal.type === PropertyType.NUMERICAL && propVal.payload) ? `${propVal.baseId} ${TAG_VALUE_SEPARATOR} ${d3.round(propVal.payload.numVal, 2)}` : propVal.id;
  }

}
