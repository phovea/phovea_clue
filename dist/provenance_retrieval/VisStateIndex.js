import { COMPARATORS, selectComparator } from './VisStatePropertyComparator';
import * as d3 from 'd3';
const COLORS = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
    '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5', '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5'
];
const colorScale = d3.scale.ordinal().range(COLORS);
export class Query {
    constructor() {
        this._propValues = [];
        this._weights = [];
        //
    }
    get propValues() {
        return this._propValues;
    }
    get weights() {
        return this._weights;
    }
    set weights(value) {
        this._weights = value;
    }
    get colors() {
        return this.propValues.map((d) => colorScale(String(d.id)));
    }
    addPropValue(propValue) {
        // no new query, if property is already in query
        if (this.propValues.indexOf(propValue) > -1) {
            return this;
        }
        const q = new Query();
        q._propValues = [].concat(this.propValues, propValue);
        const newPercentage = 1 / q._propValues.length;
        // transform the old weight distribution to the new percentage and add the weight for the new prop
        q._weights = [...this.weights.map((d, i, arr) => d * newPercentage * arr.length), newPercentage];
        return q;
    }
    removePropValue(propValue) {
        const q = new Query();
        const index = this.propValues.indexOf(propValue);
        q._propValues = this.propValues.filter((d, i) => i !== index);
        q._weights = this.weights.filter((d, i) => i !== index);
        const newPercentage = 1 / q._weights.reduce((a, b) => a + b, 0.0);
        q._weights = q._weights.map((d) => d * newPercentage);
        return q;
    }
    replacePropValues(propValue) {
        const q = new Query();
        q._propValues = [].concat(...propValue);
        const newPercentage = 1 / q._propValues.length;
        q._weights = Array.apply(null, Array(q._propValues.length)).map(() => newPercentage);
        return q;
    }
    clear() {
        return new Query();
    }
}
class SearchResult {
    constructor(query, state, similarities) {
        this.query = query;
        this.state = state;
        this.similarities = similarities;
        this.isTopResult = false;
        this.isActiveInMainView = false;
        this._similarity = this.similarities.reduce((a, b) => a + b, 0.0);
        this._matchingIndices = this.similarities
            .map((d, i) => (d > 0) ? i : null)
            .filter((d) => d !== null);
        this.update();
    }
    get id() {
        return String(this.state.node.id);
    }
    get similarity() {
        return this._similarity;
    }
    get weightedSimilarities() {
        return this._weightedSimilarities;
    }
    get weightedSimilarity() {
        return this._weightedSimilarity;
    }
    get matchingIndices() {
        return this._matchingIndices;
    }
    get numMatchingTerms() {
        return this.matchingIndices.length;
    }
    update() {
        this._weightedSimilarities = this.similarities.map((d, i) => d * this.query.weights[i]);
        this._weightedSimilarity = this.weightedSimilarities.reduce((a, b) => a + b, 0.0);
    }
    matchingIndicesStr(separator = '') {
        return this._matchingIndices.join(separator);
    }
}
export class SearchResultSequence {
    constructor(searchResults) {
        this.searchResults = searchResults;
        this.update();
    }
    get id() {
        return this._id;
    }
    get topResult() {
        return this._topResult;
    }
    update() {
        this.searchResults.forEach((d) => d.update());
        // get top result which is the first state with the highest similarity score
        this._topResult = this.searchResults.reduce((a, b) => ((a.weightedSimilarity >= b.weightedSimilarity) ? a : b));
        this._topResult.isTopResult = true;
        // create sequence id from list of all states
        this._id = this.searchResults.map((d) => d.state.node.id).join(',');
    }
}
export class VisStateIndex {
    constructor() {
        this.states = [];
        //
    }
    addState(state) {
        if (this.states.indexOf(state) > -1) {
            return false;
        }
        this.states = [...this.states, state];
        COMPARATORS.forEach((c) => {
            c.addState(state);
        });
        return true;
    }
    compareAll(query, similarityScale) {
        return this.states.map((s) => VisStateIndex.compare(query, s, similarityScale));
    }
    static compare(query, state, similarityScale) {
        let similarities = state.compare(selectComparator, query.propValues);
        if (similarityScale) {
            similarities = query.propValues.map((propVal, i) => similarityScale(propVal.type, similarities[i]));
        }
        return new SearchResult(query, state, similarities);
    }
}
//# sourceMappingURL=VisStateIndex.js.map