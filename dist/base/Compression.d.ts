import { ActionNode } from 'phovea_core';
export declare class Compression {
    static lastOnly(path: ActionNode[], functionId: string, toKey: (action: ActionNode) => string): ActionNode[];
    static createRemove(path: ActionNode[], createFunctionId: string, removeFunctionId: string): ActionNode[];
}
