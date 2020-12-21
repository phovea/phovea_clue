/**
 * Created by Holger Stitz on 07.06.2017.
 */
import { IVisState } from 'phovea_core';
import { IPropertyValue, PropertyType } from 'phovea_core';
export interface IQuery {
    readonly propValues: IPropertyValue[];
    readonly colors: string[];
    weights: number[];
    addPropValue(propValue: IPropertyValue): IQuery;
    removePropValue(propValue: IPropertyValue): IQuery;
    replacePropValues(propValue: IPropertyValue[]): IQuery;
    clear(): IQuery;
}
export interface ISearchResult {
    readonly id: string;
    readonly state: IVisState;
    readonly query: IQuery;
    readonly numMatchingTerms: number;
    readonly matchingIndices: number[];
    readonly similarities: number[];
    readonly weightedSimilarities: number[];
    readonly similarity: number;
    readonly weightedSimilarity: number;
    isTopResult: boolean;
    isActiveInMainView: boolean;
    update(): any;
    matchingIndicesStr(separator?: string): any;
}
export interface ISearchResultSequence {
    readonly id: string;
    readonly topResult: ISearchResult;
    readonly searchResults: ISearchResult[];
    update(): any;
}
export declare class Query implements IQuery {
    private _propValues;
    private _weights;
    constructor();
    get propValues(): IPropertyValue[];
    get weights(): number[];
    set weights(value: number[]);
    get colors(): string[];
    addPropValue(propValue: IPropertyValue): IQuery;
    removePropValue(propValue: IPropertyValue): IQuery;
    replacePropValues(propValue: IPropertyValue[]): IQuery;
    clear(): IQuery;
}
export declare class SearchResultSequence implements ISearchResultSequence {
    readonly searchResults: ISearchResult[];
    private _topResult;
    private _id;
    constructor(searchResults: ISearchResult[]);
    get id(): string;
    get topResult(): ISearchResult;
    update(): void;
}
export declare class VisStateIndex {
    states: IVisState[];
    constructor();
    addState(state: IVisState): boolean;
    compareAll(query: IQuery, similarityScale?: (type: PropertyType, similarity: number) => number): ISearchResult[];
    static compare(query: IQuery, state: IVisState, similarityScale?: (type: PropertyType, similarity: number) => number): ISearchResult;
}
