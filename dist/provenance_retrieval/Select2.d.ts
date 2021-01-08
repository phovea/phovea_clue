/// <reference types="jquery" />
/// <reference types="jquery.scrollto" />
/// <reference types="bootstrap" />
/**
 * Created by Holger Stitz on 07.06.2017.
 */
import 'select2';
import { IProperty } from 'phovea_core';
export declare class Select2 {
    $instance: JQuery;
    private prepData;
    private numCountScale;
    private query;
    constructor();
    open(): void;
    close(): void;
    private prepareData;
    updateData(data: IProperty[]): void;
    init(selector: string, data: IProperty[]): any;
    private findQueryInText;
    private findQueryInParam;
    private filterData;
    private templateResult;
}
