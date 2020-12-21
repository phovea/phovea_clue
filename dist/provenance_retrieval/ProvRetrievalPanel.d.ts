import { AVisInstance, IVisInstance, ProvenanceGraph } from 'phovea_core';
import { IVisStateApp } from './IVisState';
interface IProvRetrievalPanelOptions {
    captureNonPersistedStates?: boolean;
    rotate?: number;
    app?: IVisStateApp;
    startCollapsed?: boolean;
}
/**
 * To enable the Provenance Retrieval Panel the application must set to the ACLUEWrapper.
 *
 * ```
 * const elems = template.create(document.body, { ... });
 * elems.graph.then((graph) => {
 *   const app = gapminder.create(<Element>elems.$main.node(), graph);
 *   elems.setApplication(app); // set application to enable provenance retrieval
 *   // ...
 * });
 * ```
 */
export declare class ProvRetrievalPanel extends AVisInstance implements IVisInstance {
    data: ProvenanceGraph;
    parent: Element;
    private options;
    /**
     * Capture the `StateNode.visState` that haven not been persisted yet and index them.
     *
     * NOTE:
     * In order to capture a StateNode the application must jump to each state and capture it.
     * Depending on the machine and number of states that might results in long loading times.
     *
     * @type {boolean}
     */
    private static CAPTURE_AND_INDEX_NON_PERSISTED_STATES;
    private defaultOptions;
    private executedFirstListener;
    private searchForStateListener;
    private switchStateListener;
    private $node;
    private $searchResults;
    private $select2Instance;
    private dim;
    private stateIndex;
    private lastStateBeforeSearch;
    private query;
    private currentSequences;
    private propertyModifier;
    private executedFirstPromises;
    constructor(data: ProvenanceGraph, parent: Element, options: IProvRetrievalPanelOptions);
    private bind;
    destroy(): void;
    get rawSize(): [number, number];
    get node(): Element;
    private setLastStateBeforeSearch;
    private resetLastStateBeforeSearch;
    /**
     * Build the index of given StateNodes for later retrieval.
     * The flag determines how to handle states that do not contain a valid visState.
     *
     * @param stateNodes List of StateNodes that should be indexed
     * @param captureAndIndex Capture and index *non-persisted* states?
     */
    private initStateIndex;
    /**
     * Iterates asynchronously over all states, jumps to them, captures the visState and indexes them.
     * @param stateNodes
     * @returns {Promise<any>} Will be resolved, once all states are processed.
     */
    private jumpToAndIndexStates;
    /**
     * Captures the visState of a node and adds it to the index
     * @param stateNode
     * @returns {Promise<boolean>} Returns `true` if successfully added to index. Otherwise returns `false`.
     */
    private captureAndIndexState;
    private build;
    private updateWeightingEditor;
    private performSearch;
    /**
     * Filter the query for all categorical properties.
     * Run a comparison and create a D3 scale with the domain
     * between 0 and the maximum TF-IDF value.
     *
     * Background: The TF-IDF value can go beyond 1. A high TF-IDF value
     * can be reached by a high term frequency (in the given visualization state)
     * and a low document frequency of the term in the whole collection
     * of visualization states.
     * We must ensure TF-IDF values in the range [0, 1] in order to work
     * that the weighted scaling is still working.
     *
     * @param {IQuery} query
     * @returns {d3.scale.Linear<number, number>}
     */
    private createCategoricalSimilarityScale;
    /**
     * Given a list of search results cluster the results into sequences
     * A sequence is a subset (list) of consecutive states.
     * Note that every search result can only be sorted into one sequence (no duplicate states).
     *
     * Sequence Algorithm:
     * 1. Partition search results by the number of matching terms (1, 2, 3, ...)
     * 2. Within each group: Run through all search results.
     *    Going backward in the graph find a previous state that is...
     *    a) ... part of the result set and ...
     *    b) ... has the same number of matching terms.
     *
     * The algorithm tend to produce multiple short sequences.
     *
     * List of consecutive states from the provenance graph:
     * ```
     * [
     *    {id: 0, num: 2},
     *    {id: 1, num: 1},
     *    {id: 2, num: 1},
     *    {id: 3, num: 0}, // just for demonstration, should be excluded from the result set before
     *    {id: 4, num: 1},
     *    {id: 5, num: 2},
     *    {id: 6, num: 2},
     * ]
     * ```
     *
     * Results in the following sequences (ordered by number of matching terms):
     * ```
     * [
     *    // 2 matching terms:
     *    [
     *      [{id: 0, num: 2}], // sequence 1
     *      [{id: 5, num: 2}, {id: 6, num: 2}], // sequence 2
     *    ],
     *    // 1 matching term:
     *    [
     *      [{id: 1, num: 1}, {id: 2, num: 1}], // sequence 3
     *      [{id: 4, num: 1}], // sequence 4
     *    ],
     *    // 0 matching terms:
     *    [
     *      [{id: 3, num: 0}],
     *    ]
     * ]
     * ```
     *
     * @param {ISearchResult[]} results
     * @returns {ISearchResultSequence[]}
     */
    private groupIntoSequences;
    private updateResults;
    /**
     *
     * @param $parent
     * @param sequences
     * @param widthScale
     * @returns {selection.Update<ISearchResultSequence>}
     */
    private createSequenceDOM;
    /**
     *
     * @param $parent
     * @param widthScale
     */
    private createStateListDOM;
    static create(data: ProvenanceGraph, parent: Element, options?: IProvRetrievalPanelOptions): ProvRetrievalPanel;
}
export {};
