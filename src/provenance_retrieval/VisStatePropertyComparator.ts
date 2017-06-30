/**
 * Created by Holger Stitz on 28.06.2017.
 */
import {PropertyType} from 'phovea_core/src/provenance/retrieval/VisStateProperty';
import {
  ICategoricalPropertyComparator, INumericalPropertyComparator,
  IPropertyComparator, ISetPropertyComparator
} from 'phovea_core/src/provenance/retrieval/PropertyValueComparator';
import {TermFrequency} from 'phovea_core/src/provenance/retrieval/tf_idf/TermFrequency';
import {InverseDocumentFrequency} from 'phovea_core/src/provenance/retrieval/tf_idf/InverseDocumentFrequency';
import {Jaccard} from 'phovea_core/src/provenance/retrieval/jaccard/Jaccard';


class NumericalPropertyComparator implements INumericalPropertyComparator {
  constructor() {
    //
  }

  compare(numVal1:number, numVal2:number):number {
    return numVal1 - numVal2;
  }
}


class CategoricalPropertyComparator implements ICategoricalPropertyComparator {
  constructor() {
    //
  }

  compare(term:string, termFreq:TermFrequency, idf:InverseDocumentFrequency):number {
    return idf.tfidf([term], termFreq);
  }
}


class SetPropertyComparator implements ISetPropertyComparator {
  constructor() {
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
