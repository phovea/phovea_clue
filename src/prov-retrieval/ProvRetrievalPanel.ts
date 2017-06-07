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
import {VisStateIndex} from './VisStateIndex';


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

  private $node: d3.Selection<any>;
  private $searchResults: d3.Selection<any>;

  private dim: [number, number] = [200, 100];

  private stateIndex:VisStateIndex = new VisStateIndex();

  private query:string[] = [];

  constructor(public data: ProvenanceGraph, public parent: Element, private options: any) {
    super();
    this.options = mixin({}, options);
    this.$node = this.build(d3.select(parent));
    onDOMNodeRemoved(this.node, this.destroy, this);

    this.bind();
    this.initStateIndex();
  }

  private bind() {
    this.data.on('executed_first', this.addState.bind(this));
  }

  destroy() {
    super.destroy();
    this.data.off('executed_first', this.addState.bind(this));
  }

  get rawSize(): [number, number] {
    return this.dim;
  }

  get node() {
    return <Element>this.$node.node();
  }

  private initStateIndex() {
    this.data.states.forEach((stateNode) => {
      this.stateIndex.addState(stateNode.visState);
    });
  }

  private addState(evt, action, stateNode) {
    this.stateIndex.addState(stateNode.visState);
    this.updateSearchResults(this.query);
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
        <form action="#" onsubmit="return false; ">
          <div class="form-group">
            <label class="sr-only" for="prov-retrieval-select">Filter provenance states by &hellip;</label>
            <select multiple="multiple" style="width: 100%" class="form-control" id="prov-retrieval-select"></select>
          </div>
        </form>
        <ol class="search-results"></ol>
        <p>No matching states found.</p>
      </div>
    `);

    this.$searchResults = $p.select('.search-results');

    if(this.options.app && this.options.app.getVisStateAttrs) {
      const $s2Instance = new Select2();
      const $select2 = $s2Instance.init('#prov-retrieval-select', this.options.app.getVisStateAttrs());
      $select2
        .on('change', (evt) => {
          this.query = $select2.val();
          this.updateSearchResults(this.query);
        })
        //.on('select2:select', (evt) => {
          //console.log('select2:select', e.params.data);
        //})
        .on('select2:unselect', (evt) => {
          //console.log('select2:unselect', e.params.data);
          // close drop down on unselect (see https://github.com/select2/select2/issues/3209#issuecomment-149663474)
          if (!evt.params.originalEvent) {
            return;
          }
          evt.params.originalEvent.stopPropagation();
        });

    } else {
      $p.select('.body > form').classed('hidden', true);
    }

    return $p;
  }

  private updateSearchResults(query) {
    this.$searchResults.selectAll('*').remove(); // clear DOM list

    const results = this.stateIndex.tfidfs(query)
      .filter((state) => state.similarity > 0);

    if(results.length === 0) {
      return;
    }

    const data = results
      .sort((x, y) => y.similarity - x.similarity)
      .map((d) => {
        d.terms = d.state.terms.map((term) => {
          return (d.query.indexOf(term) > -1) ? `<span class="match">${term}</span>` : `${term}`;
        });
        return d;
      });

    const $li = this.$searchResults.selectAll('li').data(data);

    $li.enter().append('li');

    $li
      .html((d) => `
        <span class="title">${d.state.node.name}</span>
        <span class="label score">${d.similarity.toFixed(2)} </span>
        <small class="terms">${d.terms.join(', ')}</small>
      `)
      .on('mouseenter', (d) => {
        (<Event>d3.event).stopPropagation();
        this.data.selectState(d.state.node, idtypes.SelectOperation.SET, idtypes.hoverSelectionType);
      })
      .on('mouseleave', (d) => {
        (<Event>d3.event).stopPropagation();
        this.data.selectState(d.state.node, idtypes.SelectOperation.REMOVE, idtypes.hoverSelectionType);
      })
      .on('click', (d) => {
        (<Event>d3.event).stopPropagation();
        this.data.selectState(d.state.node, idtypes.toSelectOperation(<MouseEvent>d3.event));
        this.data.jumpTo(d.state.node);
      });

    $li.exit().remove();

  }

}

export function create(data: ProvenanceGraph, parent: Element, options = {}) {
  return new ProvRetrievalPanel(data, parent, options);
}
