/**
 * Created by Samuel Gratzl on 28.02.2017.
 */
import { IProvenanceGraphDataDescription, ProvenanceGraph } from 'phovea_core';
import { CLUEGraphManager } from '../base/CLUEGraphManager';
export declare class ProvenanceGraphMenu {
    private readonly manager;
    private readonly $node;
    private graph;
    constructor(manager: CLUEGraphManager, parent: HTMLElement, appendChild?: boolean);
    get node(): HTMLElement;
    setGraph(graph: ProvenanceGraph): void;
    private init;
    build(graphs: IProvenanceGraphDataDescription[]): void;
}
