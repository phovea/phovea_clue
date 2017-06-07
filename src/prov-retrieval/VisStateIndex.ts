/**
 * Created by Holger Stitz on 07.06.2017.
 */
import * as d3 from 'd3';
import {VisState} from 'phovea_core/src/provenance/retrieval/VisState';

interface ISearchResult {
  query: string[];
  state: VisState;
  similarity: number;
}


/**
 *
 */
export class VisStateIndex {

  public static TAG_VALUE_SEPARATOR = '=';

  states: VisState[] = [];

  private idfCache = new Map<string, number>();

  private termValueScales = new Map<string, d3.scale.Linear<any, any>>();

  /**
   *
   */
  constructor() {
    //
  }

  /**
   *
   * @param state
   * @param restoreCache If restoreCache is set to true, all terms idf scores currently cached will be recomputed. Otherwise, the cache will just be wiped clean
   */
  addState(state: VisState, restoreCache: boolean = false) {
    this.states.push(state);

    // make sure the cache is invalidated when new documents arrive
    if (restoreCache === true) {
      Array.from(this.idfCache.keys())
      // invoking idf with the force option set will
      // force a recomputation of the idf, and it will
      // automatically refresh the cache value.
        .forEach((term) => this.idf(term, true));

    } else {
      this.idfCache.clear();
    }
  }

  /**
   *
   * @param term
   * @param force
   * @returns {any}
   */
  private idf(term, force: boolean = false) {
    // Lookup the term in the New term-IDF caching,
    // this will cut search times down exponentially on large document sets.
    if (this.idfCache.has(term) && force !== true) {
      return this.idfCache.get(term);
    }

    const docsWithTerm = this.states.reduce((count, state) => count + (state.hasTerm(term) ? 1 : 0), 0);

    const idf: number = 1 + Math.log((this.states.length) / ( 1 + docsWithTerm ));

    // Add the idf to the term cache and return it
    this.idfCache.set(term, idf);
    return idf;
  }

  /**
   *
   * @param term
   * @param force
   * @returns {any}
   */
  private termValueScale(term, force: boolean = false) {
    // Lookup the term in the New term-IDF caching,
    // this will cut search times down exponentially on large document sets.
    if (this.termValueScales.has(term) && force !== true) {
      return this.termValueScales.get(term);
    }

    const tfs = this.states
      .filter((state) => state.hasTerm(term))
      .map((state) => state.tf(term));

    const scale = d3.scale.linear()
      .domain([Math.min(...tfs, 0), Math.max(...tfs, 0)])
      .range([0, 1]);

    // Add the idf to the term cache and return it
    this.termValueScales.set(term, scale);
    return scale;
  }

  /**
   *
   * @param terms
   * @param index
   * @return number
   */
  tfidf(terms: string[], index: number):ISearchResult {
    //if (!Array.isArray(terms)) {
    //  terms = tokenizer.tokenize(terms.toString().toLowerCase());
    //}

    const similarity = terms.reduce((value, term) => {
      const paramTerm = term.split(VisStateIndex.TAG_VALUE_SEPARATOR).map((d) => d.trim());

      // handle terms with parameter
      if (paramTerm.length > 1) {
        // if `term = 0` return the value
        if (this.states[index].tf(paramTerm[0]) === 0) {
          return value;
        }

        const scale = this.termValueScale(paramTerm[0]);
        const paramTf = 1 - Math.abs(scale(this.states[index].tf(paramTerm[0])) - scale(parseFloat(paramTerm[1])));

        let idf = this.idf(paramTerm[0]);
        idf = (idf === Infinity) ? 0 : idf;

        //console.log(term, 'value', value, 'tf', paramTf, 'idf', idf, 'return', (value + (paramTf * idf)));

        return value + (paramTf * idf);
      }

      let idf = this.idf(term);
      idf = (idf === Infinity) ? 0 : idf;

      //console.log(term, 'value', value, 'tf', this.states[index].tf(term), 'idf', idf, 'return', value + (this.states[index].tf(term) * idf));
      return value + (this.states[index].tf(term) * idf);
    }, 0.0);
    //console.log('--------------');

    return {
      query: terms,
      state: this.states[index],
      similarity,
    };
  }

  /*listTerms(d):{term:string, tfidf: number}[] {
    return this.states[d].terms()
      .map((term) => {
        return {term, tfidf: this.tfidf(term, d).similarity};
      })
      .sort((x, y) => y.tfidf - x.tfidf);
  };*/

  /**
   *
   * @param terms
   * @param callback
   * @returns {number[]}
   */
  tfidfs(terms, callback?:(index:number, result:ISearchResult) => void) {
    const tfidfs = new Array(this.states.length);

    for (let i = 0; i < this.states.length; i++) {
      tfidfs[i] = this.tfidf(terms, i);

      if (callback) {
        callback(i, tfidfs[i]);
      }
    }

    return tfidfs;
  };

}
