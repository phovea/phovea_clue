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
import {IQuery, ISearchResult, Query, VisStateIndex} from './VisStateIndex';
import ActionNode from 'phovea_core/src/provenance/ActionNode';
import {IPropertyValue} from 'phovea_core/src/provenance/retrieval/VisStateProperty';
import {ProvenanceGraphDim} from 'phovea_core/src/provenance';
import {SelectOperation} from '../../../phovea_core/src/idtype/IIDType';


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

  /**
   * Capture the `StateNode.visState` that haven not been persisted yet and index them.
   *
   * NOTE:
   * In order to capture a StateNode the application must jump to each state and capture it.
   * Depending on the machine and number of states that might results in long loading times.
   *
   * @type {boolean}
   */
  private static CAPTURE_AND_INDEX_NON_PERSISTED_STATES = true;

  private executedFirstListener = ((evt:any, action:ActionNode, state:StateNode) => {
    const success = this.captureAndIndexState(state);
    if(success) {
      this.updateWeightingEditor(this.query);
      this.performSearch(this.query);
    }
  });

  private searchForStateListener = ((evt:any, state:StateNode) => {
    this.query = this.query.replacePropValues(state.visState.propValues);
    this.updateWeightingEditor(this.query);
    this.performSearch(this.query);
  });

  private $node: d3.Selection<any>;
  private $searchResults: d3.Selection<any>;

  private dim: [number, number] = [200, 100];

  private stateIndex:VisStateIndex = new VisStateIndex();

  private query:IQuery = new Query();

  constructor(public data: ProvenanceGraph, public parent: Element, private options: any) {
    super();
    this.options = mixin({}, options);
    this.$node = this.build(d3.select(parent));
    onDOMNodeRemoved(this.node, this.destroy, this);

    this.bind();
    this.initStateIndex(this.data.states, ProvRetrievalPanel.CAPTURE_AND_INDEX_NON_PERSISTED_STATES);
  }

  private bind() {
    this.data.on('search_state', this.searchForStateListener);
    this.data.on('executed_first', this.executedFirstListener);
  }

  destroy() {
    super.destroy();
    this.data.off('search_state', this.searchForStateListener);
    this.data.off('executed_first', this.executedFirstListener);
  }

  get rawSize(): [number, number] {
    return this.dim;
  }

  get node() {
    return <Element>this.$node.node();
  }

  /**
   * Build the index of given StateNodes for later retrieval.
   * The flag determines how to handle states that do not contain a valid visState.
   *
   * @param stateNodes List of StateNodes that should be indexed
   * @param captureAndIndex Capture and index *non-persisted* states?
   */
  private initStateIndex(stateNodes:StateNode[], captureAndIndex:boolean) {
    // already persisted states have to be added to the index only
    stateNodes
      .filter((stateNode) => stateNode.visState.isPersisted())
      .forEach((stateNode) => {
        //console.log('already persisted', stateNode.name, stateNode.visState.isPersisted());
        this.stateIndex.addState(stateNode.visState);
      });

    const nonPersistedStates = stateNodes.filter((stateNode) => !stateNode.visState.isPersisted());

    if(nonPersistedStates.length > 0) {
      if(captureAndIndex) {
        this.jumpToAndIndexStates(nonPersistedStates);

      } else {
        console.warn(`${nonPersistedStates.length} provenance states were not indexed for the provenance state search. You will get incomplete search results.`);
      }
    }
  }

  /**
   * Iterates asynchronously over all states, jumps to them, captures the visState and indexes them.
   * @param stateNodes
   * @returns {Promise<any>} Will be resolved, once all states are processed.
   */
  private async jumpToAndIndexStates(stateNodes:StateNode[]):Promise<any> {
    const currentState = this.data.act;

    for (const stateNode of stateNodes) {
      await this.data.jumpTo(stateNode);
      this.captureAndIndexState(stateNode);
      //console.log('newly persisted', stateNode.name, stateNode.visState.terms);
    }

    return this.data.jumpTo(currentState); // jump back to previous state
  }

  /**
   * Captures the visState of a node and adds it to the index
   * @param stateNode
   * @returns {boolean} Returns `true` if successfully added to index. Otherwise returns `false`.
   */
  private captureAndIndexState(stateNode:StateNode):boolean {
    stateNode.visState.captureAndPersist();
    return this.stateIndex.addState(stateNode.visState);
  }

  private build($parent: d3.Selection<any>) {
    const $p = $parent.append('aside')
      //.classed('provenance-layout-vis', true)
      .classed('provenance-retrieval-panel', true)
      .style('transform', 'rotate(' + this.options.rotate + 'deg)');

    $p.html(`
      <div class="header">
        <h2><i class="fa fa-search"></i> Search Provenance States</h2>
      </div>
      <div class="body">
        <form action="#" onsubmit="return false; ">
          <div class="form-group">
            <label class="sr-only" for="prov-retrieval-select">Filter provenance states by &hellip;</label>
            <select multiple="multiple" style="width: 100%" class="form-control hidden" id="prov-retrieval-select"></select>
          </div>
        </form>
        <div id="prov-retrieval-weighting-editor">
          <ul class="terms"></ul>
        </div>
      </div>
      <div class="body scrollable">
        <svg class="hidden">
          <defs>
            <g id="one-state">
              <circle r="15" cx="180" cy="20"/>
            </g>
            <g id="two-states">
              <circle r="15" cx="100" cy="20"/>
              <circle r="15" cx="180" cy="20"/>
              <line x1="100" y1="20" x2="180" y2="20" stroke-width="6"/>
            </g>
            <g id="three-states">
              <circle r="15" cx="20" cy="20"/>
              <circle r="15" cx="100" cy="20"/>
              <circle r="15" cx="180" cy="20"/>
              <line x1="20" y1="20" x2="180" y2="20" stroke-width="6"/>
            </g>
            <g id="n-states">
              <circle r="15" cx="20" cy="20"/>
              <circle r="15" cx="180" cy="20"/>
              <line x1="20" y1="20" x2="60" y2="20" stroke-width="6"/>
              <line x1="140" y1="20" x2="180" y2="20" stroke-width="6"/>
            </g>
          </defs>
        </svg>
        <ol class="search-results" start="1"></ol>
        <p>No matching states found</p>
      </div>
    `);

    this.$searchResults = $p.select('.search-results');

    if(this.options.app && this.options.app.getVisStateProps) {
      this.options.app.getVisStateProps().then((properties) => {
        const $s2Instance = new Select2();
        const $select2 = $s2Instance.init('#prov-retrieval-select', properties);
        $select2
          .on('select2:select', (evt) => {
            const propValue:IPropertyValue = evt.params.data.propValue;
            propValue.isSelected = true;
            //console.log('select2:select', evt.params.data);

            this.query = this.query.addPropValue(propValue);
            this.updateWeightingEditor(this.query);
            this.performSearch(this.query);

            // prevent adding new terms as tags and add them to the weighting editor instead
            $select2.val(null).trigger('change');
          })
          .on('select2:unselect', (evt) => {
            const propValue:IPropertyValue = evt.params.data.propValue;
            propValue.isSelected = false;
            //console.log('select2:unselect ', evt.params.data);

            this.query = this.query.removePropValue(propValue);
            this.updateWeightingEditor(this.query);
            this.performSearch(this.query);

            // close drop down on unselect (see https://github.com/select2/select2/issues/3209#issuecomment-149663474)
            if (!evt.params.originalEvent) {
              return;
            }
            evt.params.originalEvent.stopPropagation();
          });
      });

    } else {
      $p.select('.body > form').classed('hidden', true);
    }

    return $p;
  }

  private updateWeightingEditor(query:IQuery) {
    const $terms = d3.select('#prov-retrieval-weighting-editor ul')
      .selectAll('li')
      .data(query.propValues, (d) => String(d.id));

    $terms.enter().append('li');
    $terms
      .style('border-color', (d, i) => query.colors[i])
      .style('color', (d, i) => query.colors[i])
      .html((d, i) => `
        <span class="remove" role="presentation" title="Remove">×</span>
        <span>${d.text}</span>
      `);
    $terms.select('.remove')
      .on('click', (propValue) => {
        propValue.isSelected = false;
        this.query = this.query.removePropValue(propValue);
        this.updateWeightingEditor(this.query);
        this.performSearch(this.query);
      });
    $terms.exit().remove();
  }

  private performSearch(query:IQuery) {
    if(!query) {
      return;
    }

    const results:ISearchResult[] = this.stateIndex
      .compareAll(query)
      .filter((state) => state.similarity > 0);

    const groupedResults = this.groupIntoSequences(results);
    this.updateResults(groupedResults);
  }

  private groupIntoSequences(results:ISearchResult[]):ISearchResult[][] {
    const snCache = results.map((r) => <StateNode>r.state.node);

    return d3.nest()
      .key((d:ISearchResult) => d.similarities.filter((d) => d > 0).length + ' matching terms')
      .key((d:ISearchResult) => {
        let firstStateNode:StateNode = <StateNode>d.state.node;
        let bakStateNode:StateNode = firstStateNode;
        while(snCache.indexOf(firstStateNode) > -1) {
          bakStateNode = firstStateNode;
          firstStateNode = firstStateNode.previousState;
        }
        return String(bakStateNode.id);
      })
      .sortValues((a:ISearchResult, b:ISearchResult) => a.state.node.id - b.state.node.id)
      .entries(results)
      // </end> of d3.nest -> continue with nested array
      // flatten the array
      .reduce((prev, curr) => prev.concat(curr.values), [])
      // flatten the array
      .map((d) => d.values)
      // sort results by similarity
      .sort((a, b) => b[0].similarity - a[0].similarity);
  }


  private updateResults(results:ISearchResult[][]) {

    this.$searchResults.selectAll('*').remove(); // clear DOM list

    if(results.length === 0) {
      return;
    }

    const widthScale = d3.scale.linear().domain([0, 1]).range([0, (100/results[0][0].similarities.length)]);

    const data = results.map((seq) => {
      (<any>seq[0]).seqLength = seq.length;
      return seq;
    });

    const $seqLi = this.$searchResults.selectAll('li').data(results, (d) => String(d[0].state.node.id));
    $seqLi.enter().append('li').classed('sequence', true);
    $seqLi.html((d, i) => `<ol class="states"></ol>`);
    $seqLi.exit().remove();

    const $stateLi = $seqLi.select('.states').selectAll('li').data((seq) => seq, (d) => String(d.state.node.id));

    $stateLi.enter().append('li')
      .attr('class', (d, i) => (i === 0) ? '' : 'hidden');

    $stateLi
      .html((d, i) => {
        let seqIconId = 'n-states';
        let seqLength = (<any>d).seqLength || '';
        switch(seqLength) {
          case 1:
            seqIconId = 'one-state';
            seqLength = '';
            break;
          case 2:
            seqIconId = 'two-states';
            seqLength = '';
            break;
          case 3:
            seqIconId = 'three-states';
            seqLength = '';
            break;
        }

        return `
          <article data-score="${d.similarity.toFixed(2)}">
            <div class="title" href="#">${(<StateNode>d.state.node).name}</div>
            <div class="seq-length" title="Click to show state sequence">
              <svg viewBox="0 0 100 40" class="svg-icon" preserveAspectRatio="xMinYMin meet">
                <use xlink:href="#${seqIconId}"></use>
              </svg>
              <span>${seqLength}</span>
            </div>
          </article>
          <ul class="similarity-bar"></ul>
        `;
      });

    $stateLi.exit().remove();

    $stateLi.select('.title')
      .on('mouseenter', (d) => {
        (<Event>d3.event).stopPropagation();
        this.data.selectState(<StateNode>d.state.node, idtypes.SelectOperation.SET, idtypes.hoverSelectionType);
      })
      .on('mouseleave', (d) => {
        (<Event>d3.event).stopPropagation();
        this.data.selectState(<StateNode>d.state.node, idtypes.SelectOperation.REMOVE, idtypes.hoverSelectionType);
      })
      .on('click', (d) => {
        (<Event>d3.event).stopPropagation();
        this.data.selectState(<StateNode>d.state.node, idtypes.toSelectOperation(<MouseEvent>d3.event));
        this.data.jumpTo(<StateNode>d.state.node);
        return false;
      });

    const hoverMultipleStateNodes = (elem, operation: SelectOperation) => {
      const $ol = d3.select(elem.parentNode.parentNode.parentNode);
      const stateNodeIds:number[] = (<ISearchResult[]>$ol.datum()).map((d) => this.data.states.indexOf(<StateNode>d.state.node));
      // hover multiple stateNodeIds
      this.data.select(ProvenanceGraphDim.State, idtypes.hoverSelectionType, stateNodeIds, operation);
    };

    $stateLi.select('.seq-length')
      .on('mouseenter', () => {
        (<Event>d3.event).stopPropagation();
        hoverMultipleStateNodes((<any>d3.event).target, idtypes.SelectOperation.SET);
      })
      .on('mouseleave', (d) => {
        (<Event>d3.event).stopPropagation();
        hoverMultipleStateNodes((<any>d3.event).target, idtypes.SelectOperation.REMOVE);
      })
      .on('click', (d) => {
        (<Event>d3.event).stopPropagation();
        const seqLengthElem = (<any>d3.event).target;
        seqLengthElem.classList.toggle('active');
        const li:Element = seqLengthElem.parentNode.parentNode;
        const siblings:Element[] = Array.from(li.parentElement.children).filter((n) => n !== li);
        siblings.forEach((n) => n.classList.toggle('hidden'));
        return false;
      });

    const $simBar = $stateLi.select('.similarity-bar')
      .attr('data-tooltip', (d) => {
        const textSim = d.query.propValues.map((p, i) => {
          return {text: p.text, similarity: d.similarities[i]};
        });
        textSim.push({text: 'Total', similarity: d.similarity});
        return textSim.map((t) => `${t.text}:\t${d3.round(widthScale(t.similarity), 2)}%`).join('\n');
      })
      .selectAll('li').data((d) => {
        return d.similarities.map((sim, i) => {
          const propValue = d.query.propValues[i];
          return {
            id: propValue.id,
            text: propValue.text,
            weight: d.query.weights[i],
            color: d.query.colors[i],
            similarity: widthScale(sim),
            width: widthScale(sim),
          };
        });
      });

    $simBar.enter().append('li');

    $simBar
      .attr('data-weight', (d) => `${d3.round(d.weight, 2)}%`)
      .style('background-color', (d) => d.color)
      .style('width', (d) => `${d3.round(d.width, 2)}%`);

    $simBar.exit().remove();

  }

}

export function create(data: ProvenanceGraph, parent: Element, options = {}) {
  return new ProvRetrievalPanel(data, parent, options);
}
