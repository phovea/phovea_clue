import {IPlugin, IPluginDesc} from 'phovea_core/src/plugin';
import ProvenanceGraph from 'phovea_core/src/provenance/ProvenanceGraph';

/**
 * Provides the loaded provenance graph
 *
 * @factoryParam {ProvenanceGraph} provenanceGraph The loaded provenance graph
 */
export const EP_PHOVEA_CLUE_PROVENANCE_GRAPH = 'epPhoveaClueProvenanceGraph';

export interface IProvenanceGraphExtensionPoint {
  factory(graph: ProvenanceGraph): void;
}

export interface IProvenanceGraphExtensionPointDesc extends IPluginDesc {
  load(): Promise<IPlugin & IProvenanceGraphExtensionPoint>;
}
