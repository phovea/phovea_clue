/**
 * Created by Holger Stitz on 09.08.2017.
 */
import { IVisState, IProperty } from 'phovea_core';
import { ISearchResult } from './VisStateIndex';
export declare class PropertyModifier {
    private _properties;
    private _searchResults;
    private _activeVisState;
    private _searchForStateProperty;
    private _showActiveStateOnly;
    private propertyLookup;
    private idLookup;
    private idCounter;
    constructor();
    addState(visState: IVisState): void;
    get searchResults(): ISearchResult[];
    set searchResults(value: ISearchResult[]);
    get properties(): IProperty[];
    set properties(value: IProperty[]);
    get activeVisState(): IVisState;
    set activeVisState(visState: IVisState);
    get searchForStateProperty(): IProperty;
    set searchForStateProperty(property: IProperty);
    get showActiveStateOnly(): boolean;
    set showActiveStateOnly(value: boolean);
    private addStatesToLookup;
    private sortValuesAndAddCount;
    private modifyProperties;
    private updatePropertyValues;
    private generateTopProperties;
    private generateSimilarResultProps;
    private updateDisabled;
    private updateActive;
    private updateVisibility;
    private static getPropId;
}
