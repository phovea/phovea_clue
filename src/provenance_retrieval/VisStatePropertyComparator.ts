/**
 * Created by Holger Stitz on 28.06.2017.
 */
import * as d3 from 'd3';
import {IPropertyValue, PropertyType} from 'phovea_core/src/provenance/retrieval/VisStateProperty';
import {
ICategoricalPropertyComparator, INumericalPropertyComparator,
IPropertyComparator, ISetPropertyComparator
} from 'phovea_core/src/provenance/retrieval/PropertyValueComparator';
import {TermFrequency} from 'phovea_core/src/provenance/retrieval/tf_idf/TermFrequency';
import {InverseDocumentFrequency} from 'phovea_core/src/provenance/retrieval/tf_idf/InverseDocumentFrequency';
import {Jaccard} from 'phovea_core/src/provenance/retrieval/jaccard/Jaccard';
import {IVisState} from 'phovea_core/src/provenance/retrieval/VisState';


class NumericalPropertyComparator implements INumericalPropertyComparator {

  private scales = new Map<string|number, d3.scale.Linear<any, any>>();

  constructor() {
    //
  }

  addState(state:IVisState) {
    // get min/max value for each property id
    state.propValues
      .filter((d) => d.type === PropertyType.NUMERICAL)
      .forEach((propValue) => {
        this.updateScale(propValue.id, propValue.payload.numVal);
      });
  }

  compare(propValue1:IPropertyValue, propValue2:IPropertyValue):number {
    if(propValue1.id !== propValue2.id || !this.scales.has(propValue1.id)) {
      return 0;
    }
    const scale = this.scales.get(propValue1.id);
    return scale(Math.abs(propValue1.payload.numVal - propValue2.payload.numVal));
  }

  /**
   * get global min/max value for all states for each numerical property
   * @param id
   * @param numVal
   */
  private updateScale(id:string|number, numVal:number) {
    const scale = (this.scales.has(id)) ? this.scales.get(id) : d3.scale.linear().domain([0, 0]).range([1, 0]).clamp(true);
    const domain = scale.domain();
    scale.domain([Math.min(domain[0], numVal), Math.max(domain[1], numVal)]);
    this.scales.set(id, scale);
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
