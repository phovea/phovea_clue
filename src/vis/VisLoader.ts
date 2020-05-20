import {ProvenanceGraph} from 'phovea_core/src/provenance';
import {LayoutedProvVis} from './provvis';
import {VerticalStoryVis} from './storyvis';


export class VisLoader {

  static loadProvenanceGraphVis(data:Promise<ProvenanceGraph>, parent:Element, options = {}): ()=>Promise<LayoutedProvVis> {
    parent.insertAdjacentHTML('beforeend', `<aside class="provenance-layout-vis"></aside>`);
    let c: Promise<LayoutedProvVis>;
    return () => {
      if (!c) {
        c = Promise.all([<any>data, System.import('./provvis')]).then((args) => args[1].createLayoutedProvVis(args[0], parent, options));
      }
      return c;
    };
  }

  static loadStoryVis(graph: Promise<ProvenanceGraph>, parent: HTMLElement, main: HTMLElement, options: {thumbnails: boolean}): ()=>Promise<VerticalStoryVis> {
    parent.insertAdjacentHTML('beforeend', `<aside class="provenance-story-vis"></aside>`);
    let c: Promise<VerticalStoryVis>;
    return () => {
      if (!c) {
        c = Promise.all([<any>graph, System.import('./storyvis')]).then((args) => args[1].createStoryVis(args[0], parent, main, options));
      }
      return c;
    };
  }
}
