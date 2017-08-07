/**
 * Created by Holger Stitz on 28.06.2017.
 */
import * as d3 from 'd3';
import {IPropertyValue, PropertyType, TAG_VALUE_SEPARATOR} from 'phovea_core/src/provenance/retrieval/VisStateProperty';
import {
ICategoricalPropertyComparator, INumericalPropertyComparator,
IPropertyComparator, ISetPropertyComparator
} from 'phovea_core/src/provenance/retrieval/PropertyValueComparator';
import {TermFrequency} from 'phovea_core/src/provenance/retrieval/tf_idf/TermFrequency';
import {InverseDocumentFrequency} from 'phovea_core/src/provenance/retrieval/tf_idf/InverseDocumentFrequency';
import {Jaccard} from 'phovea_core/src/provenance/retrieval/jaccard/Jaccard';
import {IVisState} from 'phovea_core/src/provenance/retrieval/VisState';


class NumericalPropertyComparator implements INumericalPropertyComparator {

  private minMax = new Map<string, number[]>();

  constructor() {
    //
  }

  addState(state:IVisState) {
    // get min/max value for each property id
    state.propValues
      .filter((d) => d.type === PropertyType.NUMERICAL)
      .forEach((propValue) => {
        this.updateMinMax(propValue.baseId, parseFloat(propValue.payload.numVal));
      });
  }

  compare(propValue1:IPropertyValue, propValue2:IPropertyValue):number {
    if(!this.minMax.has(propValue1.baseId)) {
      return 0;
    }
    const minMax = this.minMax.get(propValue1.baseId);
    const scale = d3.scale.linear().domain([0, Math.abs(minMax[1] - minMax[0])]).range([1, 0]).clamp(true);
    const diff = Math.abs(parseFloat(propValue1.payload.numVal) - parseFloat(propValue2.payload.numVal));
    const r = scale(diff);
    return (r >= 0.8) ? r : 0; // keep only states that have a high similarity and skip the rest
  }

  /**
   * get global min/max value for all states for each numerical property
   * @param id
   * @param numVal
   */
  private updateMinMax(id:string, numVal:number) {
    if(isNaN(numVal)) {
      return;
    }
    const minMax = (this.minMax.has(id)) ? this.minMax.get(id) : [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
    const minMax2 = [Math.min(minMax[0], numVal), Math.max(minMax[1], numVal)];
    this.minMax.set(id, minMax2);
  }
}


class CategoricalPropertyComparator implements ICategoricalPropertyComparator {
  // single IDF source
  private idf: InverseDocumentFrequency = new InverseDocumentFrequency();

  constructor() {
    //
  }

  addState(state:IVisState) {
    // inject idf into every new state
    state.idf = this.idf;
  }

  compare(term:string, termFreq:TermFrequency):number {
    return this.idf.tfidf([term], termFreq);
  }
}


class SetPropertyComparator implements ISetPropertyComparator {
  constructor() {
    //
  }

  addState(state:IVisState) {
    //
  }

  compare(set1:string[], set2:string[]):number {
    let jaccardIndex = Jaccard.index(set1, set2);

    if(isNaN(jaccardIndex)) {
      jaccardIndex = 0;
    }

    return jaccardIndex;
  }
}


// singleton
const numComparator = new NumericalPropertyComparator();
const catComparator = new CategoricalPropertyComparator();
const setComparator = new SetPropertyComparator();

export const COMPARATORS:IPropertyComparator[] = [numComparator, catComparator, setComparator];

export function selectComparator(type:PropertyType): IPropertyComparator {
  switch(type) {
    case PropertyType.NUMERICAL:
      return numComparator;
    case PropertyType.CATEGORICAL:
      return catComparator;
    case PropertyType.SET:
      return setComparator;
  }
  console.log('Invalid property type. No matching comparator found.');
  return null;
}
