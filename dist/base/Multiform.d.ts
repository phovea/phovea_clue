/**
 * Created by sam on 10.02.2015.
 */
import { IObjectRef, ICmdResult, IVisInstance, ITransform, ActionMetaData, IMultiForm, ProvenanceGraph } from 'phovea_core';
export declare class Multiform {
    static transform(inputs: IObjectRef<any>[], parameter: any): ICmdResult;
    static createTransform(v: IObjectRef<IVisInstance>, t: ITransform, old?: ITransform): {
        meta: ActionMetaData;
        id: string;
        f: typeof Multiform.transform;
        inputs: IObjectRef<IVisInstance>[];
        parameter: {
            transform: ITransform;
            old: ITransform;
        };
    };
    static changeVis(inputs: IObjectRef<any>[], parameter: any): Promise<ICmdResult>;
    static createChangeVis(v: IObjectRef<IMultiForm>, to: string, from?: string): {
        meta: ActionMetaData;
        id: string;
        f: typeof Multiform.changeVis;
        inputs: IObjectRef<IMultiForm>[];
        parameter: {
            to: string;
            from: string;
        };
    };
    static setOption(inputs: IObjectRef<any>[], parameter: any): ICmdResult;
    static createSetOption(v: IObjectRef<IVisInstance>, name: string, value: any, old?: any): {
        meta: ActionMetaData;
        id: string;
        f: typeof Multiform.setOption;
        inputs: IObjectRef<IVisInstance>[];
        parameter: {
            name: string;
            value: any;
            old: any;
        };
    };
    static attach(graph: ProvenanceGraph, v: IObjectRef<IVisInstance>): void;
}
