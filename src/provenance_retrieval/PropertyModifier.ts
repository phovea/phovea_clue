/**
 * Created by Holger Stitz on 09.08.2017.
 */
import {IVisState} from 'phovea_core/src/provenance/retrieval/VisState';
import {
  IProperty, IPropertyValue, Property, PropertyType,
  TAG_VALUE_SEPARATOR
} from 'phovea_core/src/provenance/retrieval/VisStateProperty';
import {ISearchResult} from './VisStateIndex';
import * as d3 from 'd3';

export class PropertyModifier {

  private _properties:IProperty[] = [];
  private _searchResults:ISearchResult[] = [];
  private _activeVisState:IVisState;

  private propertyLookup:Map<string, IProperty> = new Map();
  private idLookup:Map<string, IPropertyValue> = new Map();
  private idCounter:Map<string, number> = new Map();

  constructor() {
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
    this.sortPropertyValues();
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
      .map((propVals) => {
        const terms = propVals.map((p) => PropertyModifier.getPropId(p));
        const uniqueTerms = Array.from(new Set(terms));
        uniqueTerms.forEach((t) => {
          const counter = (this.idCounter.has(t)) ? this.idCounter.get(t) : 0;
          this.idCounter.set(t, counter+1);
        });
        return propVals;
      })
      .reduce((prev, curr) => prev.concat(curr), []) // flatten the array
      .forEach((p) => {
        const id = PropertyModifier.getPropId(p);
        // filter None values
        if(id === 'None') {
          return;
        }
        this.idLookup.set(id, p);
        this.idLookup.set(p.baseId, p); // add baseId for correct disabled setting
      });

    this.sortPropertyValues();
  }

  private sortPropertyValues() {
    this.properties.forEach((prop) => {
      prop.values = prop.values
        .map((propVal) => {
          const id = PropertyModifier.getPropId(propVal);
          propVal.numCount = (this.idCounter.has(id)) ? this.idCounter.get(id) : 0; // undefined = count of 0
          return propVal;
        })
        .sort((a, b) => b.numCount - a.numCount); // desc
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
      .filter((d) => d !== undefined)
      .map((d) => d.clone())
      .map((d) => {
        if(this.propertyLookup.has(d.baseId)) {
          if(!d.payload) {
            d.payload = {};
          }
          d.payload.propText = this.propertyLookup.get(d.baseId).text;
        }
        return d;
      });

    const topProperties = new Property(PropertyType.SET, propText, vals);

    topProperties.values = topProperties.values
      .map((propVal) => {
        const id = PropertyModifier.getPropId(propVal);
        propVal.numCount = (idCounter.has(id)) ? idCounter.get(id) : 0; // undefined = count of 0
        return propVal;
      });

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
      .map((propVals) => {
        const terms = propVals.map((p) => PropertyModifier.getPropId(p));
        const uniqueTerms = Array.from(new Set(terms));
        uniqueTerms.forEach((t) => {
          const counter = (idCounter.has(t)) ? idCounter.get(t) : 0;
          idCounter.set(t, counter+1);
        });
        return propVals;
      })
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
