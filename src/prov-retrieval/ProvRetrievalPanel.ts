/**
 * Created by Holger Stitz on 01.06.2017.
 */
import * as d3 from 'd3';
import ProvenanceGraph from 'phovea_core/src/provenance/ProvenanceGraph';
import {AVisInstance, IVisInstance} from 'phovea_core/src/vis';
import {onDOMNodeRemoved, mixin} from 'phovea_core/src/index';
import StateNode from 'phovea_core/src/provenance/StateNode';
import * as idtypes from 'phovea_core/src/idtype';
import {Select2} from './Select2';


/**
 * To enable the Provenance Retrieval Panel the application must set to the ACLUEWrapper.
 *
 * ```
 * const elems = template.create(document.body, { ... });
 * elems.graph.then((graph) => {
 *   const app = gapminder.create(<Element>elems.$main.node(), graph);
 *   elems.setApplication(app); // set application to enable provenance retrieval
 *   // ...
 * });
 * ```
 */
export class ProvRetrievalPanel extends AVisInstance implements IVisInstance {

  private trigger = this.update.bind(this);
  private $node: d3.Selection<any>;

  private dim: [number, number] = [200, 100];

  constructor(public data: ProvenanceGraph, public parent: Element, private options: any) {
    super();
    this.options = mixin({}, options);
    this.$node = this.build(d3.select(parent));
    onDOMNodeRemoved(this.node, this.destroy, this);

    this.bind();
    this.update();
  }

  private bind() {
    this.data.on('switch_state', this.trigger);
  }

  destroy() {
    super.destroy();
    this.data.off('switch_state', this.trigger);
  }

  get rawSize(): [number, number] {
    return this.dim;
  }

  get node() {
    return <Element>this.$node.node();
  }

  private build($parent: d3.Selection<any>) {
    const $p = $parent.append('aside')
      .classed('provenance-layout-vis', true)
      .classed('prov-retrieval-panel', true)
      .style('transform', 'rotate(' + this.options.rotate + 'deg)');

    $p.html(`
      <div class="header">
        <h2><i class="fa fa-search"></i> Search Provenance States</h2>
      </div>
      <div class="body">
        <form action="#" onsubmit="return false;">
          <div class="form-group">
            <label for="prov-retrieval-select">Filter provenance states by &hellip;</label>
            <select multiple="multiple" style="width: 100%" class="form-control" id="prov-retrieval-select"></select>
          </div>
        </form>
      </div>
    `);

    if(this.options.app && this.options.app.getVisStateAttrs) {
      const $select2 = new Select2();
      $select2.init('#prov-retrieval-select', this.options.app.getVisStateAttrs());

    } else {
      $p.select('.body > form').classed('hidden', true);
    }

    return $p;
  }

  update() {
    //const that = this;
    //const graph = this.data;
    //const currentState:StateNode = graph.act;

    /*const similarities = graph.states
     .filter((other) => currentState !== other) // exclude self
     .map((other) => {
     return {
     state: other,
     score: currentState.getSimilarityTo(other)
     };
     })
     .sort((a, b) => d3.ascending(a.score, b.score));*/

    /*console.group('switch state to'.toUpperCase() + ' ' + currentState.name);
     similarities.forEach((d) => {
     console.log(d.state.id, d.state.name, d.score);
     });
     console.groupEnd();*/

    /*const $ol = this.$node.select('ol.similar-states');
     const $li = $ol.selectAll('li').data(similarities);

     $li.enter().append('li');

     $li
     .html((d) => {
     return `${d.state.name} (${d.score})`;
     })
     //.on('click', (d) => {
     //  graph.selectState(d.state, idtypes.SelectOperation.SET, idtypes.defaultSelectionType);
     //})
     .on('mouseenter', (d) => {
     graph.selectState(d.state, idtypes.SelectOperation.SET, idtypes.hoverSelectionType);
     })
     .on('mouseleave', (d) => {
     graph.selectState(d.state, idtypes.SelectOperation.REMOVE, idtypes.hoverSelectionType);
     });

     $li.exit().remove();*/
  }

}

export function create(data: ProvenanceGraph, parent: Element, options = {}) {
  return new ProvRetrievalPanel(data, parent, options);
}
