/**
 * Created by Samuel Gratzl on 28.02.2017.
 */

import {hash} from 'phovea_core/src/index';
import {IProvenanceGraphDataDescription} from 'phovea_core/src/provenance';
import MixedStorageProvenanceGraphManager from 'phovea_core/src/provenance/MixedStorageProvenanceGraphManager';
import ProvenanceGraph from 'phovea_core/src/provenance/ProvenanceGraph';
import {canWrite, isLoggedIn} from 'phovea_core/src/security';

export default class CLUEGraphManager {
  constructor(private manager: MixedStorageProvenanceGraphManager) {
    //selected by url
  }

  static setGraphInUrl(value: string) {
    hash.removeProp('clue_slide', false);
    hash.removeProp('clue_state', false);
    hash.setProp('clue_graph', value);
  }

  newRemoteGraph() {
    if (isLoggedIn()) {
      CLUEGraphManager.setGraphInUrl('new_remote');
      window.location.reload();
    }
  }

  newGraph() {
    CLUEGraphManager.setGraphInUrl('new');
    window.location.reload();
  }

  loadGraph(desc: any) {
    // reset
    CLUEGraphManager.setGraphInUrl(desc.id);
    window.location.reload();
  }

  get storedSlide() {
    return hash.getInt('clue_slide', null);
  }

  set storedSlide(value: number) {
    if (value !== null) {
      hash.setInt('clue_slide', value);
    } else {
      hash.removeProp('clue_slide');
    }
  }

  get storedState() {
    return hash.getInt('clue_state', null);
  }

  set storedState(value: number) {
    if (value !== null) {
      hash.setInt('clue_state', value);
    } else {
      hash.removeProp('clue_state');
    }
  }

  get isAutoPlay() {
    return hash.has('clue_autoplay');
  }

  list() {
    return this.manager.list();
  }

  delete(graph: IProvenanceGraphDataDescription) {
    return this.manager.delete(graph);
  }

  startFromScratch() {
    hash.removeProp('clue_slide', false);
    hash.removeProp('clue_state', false);
    hash.removeProp('clue_graph');
    window.location.reload();
  }

  importGraph(dump: any, remote = false) {
    (remote ? this.manager.importRemote(dump) : this.manager.importLocal(dump)).then((graph) => {
      this.loadGraph(graph.desc);
    });
  }

  importExistingGraph(graph: IProvenanceGraphDataDescription, extras: any = {}, cleanUpLocal = false) {
    return this.manager.cloneRemote(graph, extras).then((newGraph) => {
      const p = (graph.local && cleanUpLocal) ? this.manager.delete(graph) : Promise.resolve(null);
      return p.then(() => this.loadGraph(newGraph.desc));
    });
  }

  migrateGraph(graph: ProvenanceGraph, extras: any = {}): Promise<ProvenanceGraph> {
    const old = graph.desc;
    return this.manager.migrateRemote(graph, extras).then((newGraph) => {
      return (old.local ? this.manager.delete(old) : Promise.resolve(true)).then(() => {
        hash.setProp('clue_graph', newGraph.desc.id); //just update the reference
        return newGraph;
      });
    });
  }

  editGraphMetaData(graph: IProvenanceGraphDataDescription, extras: any = {}) {
    return this.manager.edit(graph, extras);
  }

  setGraph(graph: ProvenanceGraph) {
    hash.setProp('clue_graph', graph.desc.id);
    return graph;
  }

  private chooseImpl(list: IProvenanceGraphDataDescription[], rejectOnNotFound: boolean = false) {
    const loggedIn = isLoggedIn();
    const graph = hash.getProp('clue_graph', null);
    if (graph === 'new_remote' && loggedIn) {
      return this.manager.createRemote();
    }
    if (graph === null || graph === 'new') {
      return this.manager.createLocal();
    }
    const desc = <IProvenanceGraphDataDescription>list.find((d) => d.id === graph);
    if (desc) {
      if ((<any>desc).local || (loggedIn && canWrite(desc))) {
        return this.manager.get(desc);
      }
      return this.manager.cloneLocal(desc);
    }
    // not found
    if (rejectOnNotFound) {
      return Promise.reject({ graph, msg: `Provenance Graph with id ${graph} not found`});
    }
    return this.manager.create();
  }

  choose(list: IProvenanceGraphDataDescription[], rejectOnNotFound: boolean = false) {
    return this.chooseImpl(list, rejectOnNotFound).then((g) => this.setGraph(g));
  }

  loadOrClone(graph: IProvenanceGraphDataDescription, isSelect: boolean) {
    if (isSelect) {
      this.loadGraph(graph);
    } else {
      this.cloneLocal(graph);
    }
  }

  cloneLocal(graph: IProvenanceGraphDataDescription) {
    this.manager.cloneLocal(graph).then((graph) => this.loadGraph(graph.desc));
  }
}

/**
 * create the provenance graph selection dropdown and handles the graph selection
 * @param manager
 * @returns {Promise<U>}
 */
function choose(manager: CLUEGraphManager): Promise<ProvenanceGraph> {
  return manager.list().then((list) => manager.choose(list));
}
