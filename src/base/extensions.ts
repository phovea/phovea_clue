import {IPlugin, IPluginDesc} from 'phovea_core';
import {ProvenanceGraph} from 'phovea_core';

/**
 * Provides the loaded provenance graph
 *
 * @factoryParam {ProvenanceGraph} provenanceGraph The loaded provenance graph
 */
export const EP_PHOVEA_CLUE_PROVENANCE_GRAPH = 'epPhoveaClueProvenanceGraph';

export interface IProvenanceGraphEP {
  factory(graph: ProvenanceGraph): void;
}

export interface IProvenanceGraphEPDesc extends IPluginDesc {
  load(): Promise<IPlugin & IProvenanceGraphEP>;
}
