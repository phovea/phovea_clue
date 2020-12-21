/**
 * Created by Holger Stitz on 28.06.2017.
 */
import * as d3 from 'd3';
import { PropertyType } from 'phovea_core';
import { InverseDocumentFrequency } from 'phovea_core';
import { Jaccard } from 'phovea_core';
class NumericalPropertyComparator {
    constructor() {
        this.minMax = new Map();
        //
    }
    addState(state) {
        // get min/max value for each property id
        state.propValues
            .filter((d) => d.type === PropertyType.NUMERICAL)
            .forEach((propValue) => {
            this.updateMinMax(propValue.baseId, parseFloat(propValue.payload.numVal));
        });
    }
    compare(propValue1, propValue2) {
        if (!this.minMax.has(propValue1.baseId)) {
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
    updateMinMax(id, numVal) {
        if (isNaN(numVal)) {
            return;
        }
        const minMax = (this.minMax.has(id)) ? this.minMax.get(id) : [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
        const minMax2 = [Math.min(minMax[0], numVal), Math.max(minMax[1], numVal)];
        this.minMax.set(id, minMax2);
    }
}
class CategoricalPropertyComparator {
    constructor() {
        // single IDF source
        this.idf = new InverseDocumentFrequency();
        //
    }
    addState(state) {
        // inject idf into every new state
        state.idf = this.idf;
    }
    compare(term, termFreq) {
        return this.idf.tfidf([term], termFreq);
    }
}
class SetPropertyComparator {
    constructor() {
        //
    }
    addState(state) {
        //
    }
    compare(set1, set2) {
        let jaccardIndex = Jaccard.index(set1, set2);
        if (isNaN(jaccardIndex)) {
            jaccardIndex = 0;
        }
        return jaccardIndex;
    }
}
// singleton
const numComparator = new NumericalPropertyComparator();
const catComparator = new CategoricalPropertyComparator();
const setComparator = new SetPropertyComparator();
export const COMPARATORS = [numComparator, catComparator, setComparator];
export function selectComparator(type) {
    switch (type) {
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
//# sourceMappingURL=VisStatePropertyComparator.js.map