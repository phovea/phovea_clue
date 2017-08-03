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
import {
  IQuery, ISearchResult, ISearchResultSequence, Query, SearchResultSequence,
  VisStateIndex
} from './VisStateIndex';
import ActionNode from 'phovea_core/src/provenance/ActionNode';
import {IPropertyValue, TAG_VALUE_SEPARATOR} from 'phovea_core/src/provenance/retrieval/VisStateProperty';
import {ProvenanceGraphDim} from 'phovea_core/src/provenance';
import {SelectOperation} from 'phovea_core/src/idtype/IIDType';
import * as utils from './../utils';


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

  private currentSequences: ISearchResultSequence[] = [];

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
          <ul class="weighting-editor"></ul>
        </div>
      </div>
      <div class="body scrollable">
        <svg class="hidden">
          <defs>
            <g id="one-state">
              <circle r="10" cx="180" cy="20"/>
            </g>
            <g id="two-states">
              <circle r="10" cx="100" cy="20"/>
              <circle r="10" cx="180" cy="20"/>
              <line x1="100" y1="20" x2="180" y2="20" stroke-width="6"/>
            </g>
            <g id="three-states">
              <circle r="10" cx="20" cy="20"/>
              <circle r="10" cx="100" cy="20"/>
              <circle r="10" cx="180" cy="20"/>
              <line x1="20" y1="20" x2="180" y2="20" stroke-width="6"/>
            </g>
            <g id="n-states">
              <circle r="10" cx="20" cy="20"/>
              <circle r="10" cx="180" cy="20"/>
              <line x1="20" y1="20" x2="60" y2="20" stroke-width="6"/>
              <line x1="140" y1="20" x2="180" y2="20" stroke-width="6"/>
            </g>
            <g id="loading-animation">
              <circle r="11" transform="translate(16 16)" class="a">
                <animateTransform attributeName="transform" type="scale" additive="sum" values="1;1.42;1;1;1;1;1;1;1;1" dur="1500ms" repeatCount="indefinite"/>
              </circle>
              <circle r="11" transform="translate(64 16)" class="a">
                <animateTransform attributeName="transform" type="scale" additive="sum" values="1;1;1;1;1.42;1;1;1;1;1" dur="1500ms" repeatCount="indefinite"/>
              </circle>
              <circle r="11" transform="translate(112 16)" class="a">
                <animateTransform attributeName="transform" type="scale" additive="sum" values="1;1;1;1;1;1;1;1.42;1;1" dur="1500ms" repeatCount="indefinite"/>
              </circle>
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
    const $terms = d3.select('#prov-retrieval-weighting-editor ul.terms')
      .selectAll('li')
      .data(query.propValues, (d) => String(d.id));

    $terms.enter().append('li');
    $terms
      .style('border-color', (d, i) => query.colors[i])
      .style('color', (d, i) => query.colors[i])
      .html((d, i) => `
        <span class="remove" role="presentation" title="Remove">×</span>
        <span>${d.text}</span>
      `)//;
    //$terms.select('.remove')
      .on('click', (propValue) => {
        propValue.isSelected = false;
        this.query = this.query.removePropValue(propValue);
        this.updateWeightingEditor(this.query);
        this.performSearch(this.query);
      });
    $terms.exit().remove();

    const $weightingEditor = d3.select('#prov-retrieval-weighting-editor .weighting-editor');
    const widthScale = d3.scale.linear().domain([0, 1]).range([0, (<Element>$weightingEditor.node()).clientWidth]);

    const $editorLi = $weightingEditor.selectAll('li')
      .data(query.propValues, (d) => String(d.id));

    $editorLi.enter().append('li');
    $editorLi
      .style('width', (d, i) => `${widthScale(query.weights[i])}px`)
      .style('background-color', (d, i) => query.colors[i])
      .attr('title', (d, i) => `${d.text}: ${d3.round(query.weights[i]*100, 2)}%`)
      .html((d, i) => `<span class="draggable"></span>`);

    const drag = d3.behavior.drag()
      .on('drag', (d, i) => {
        const newWeight = widthScale.invert((<any>d3.event).x); // px to %
        const diffWeight = (query.weights[i] - newWeight) / (query.weights.length - 1 - i);

        query.weights = query.weights.map((d, j) => {
          if(i === j) {
            return newWeight; // apply new weight to current element
          } else if(j > i) {
            return d + diffWeight; // shift all upcoming elements
          }
          return d; // keep previous elements the same
        });

        $editorLi
          .attr('title', (d, j) => `${d.text}: ${d3.round(query.weights[j]*100, 2)}%`)
          .style('width', (d, j) => `${widthScale(query.weights[j])}px`);
      })
      .on('dragend', () => {
        console.log('dragend', query.weights);
        this.currentSequences.forEach((seq) => seq.update());
        this.updateResults(this.currentSequences, false);
      });

    $editorLi.select('.draggable').call(drag);

    $editorLi.exit().remove();
  }

  private performSearch(query:IQuery) {
    if(!query) {
      return;
    }

    const results = this.stateIndex
      .compareAll(query)
      .filter((state) => state.similarity > 0); // filter results that does not match at all

    this.currentSequences = this.groupIntoSequences(results);
    this.updateResults(this.currentSequences, true);
  }

  /**
   * Given a list of search results cluster the results into sequences
   * A sequence is a subset (list) of consecutive states.
   * Note that every search result can only be sorted into one sequence (no duplicate states).
   *
   * Sequence Algorithm:
   * 1. Partition search results by the number of matching terms (1, 2, 3, ...)
   * 2. Within each group: Run through all search results.
   *    Going backward in the graph find a previous state that is...
   *    a) ... part of the result set and ...
   *    b) ... has the same number of matching terms.
   *
   * The algorithm tend to produce multiple short sequences.
   *
   * List of consecutive states from the provenance graph:
   * ```
   * [
   *    {id: 0, num: 2},
   *    {id: 1, num: 1},
   *    {id: 2, num: 1},
   *    {id: 3, num: 0}, // just for demonstration, should be excluded from the result set before
   *    {id: 4, num: 1},
   *    {id: 5, num: 2},
   *    {id: 6, num: 2},
   * ]
   * ```
   *
   * Results in the following sequences (ordered by number of matching terms):
   * ```
   * [
   *    // 2 matching terms:
   *    [
   *      [{id: 0, num: 2}], // sequence 1
   *      [{id: 5, num: 2}, {id: 6, num: 2}], // sequence 2
   *    ],
   *    // 1 matching term:
   *    [
   *      [{id: 1, num: 1}, {id: 2, num: 1}], // sequence 3
   *      [{id: 4, num: 1}], // sequence 4
   *    ],
   *    // 0 matching terms:
   *    [
   *      [{id: 3, num: 0}],
   *    ]
   * ]
   * ```
   *
   * @param {ISearchResult[]} results
   * @returns {ISearchResultSequence[]}
   */

  private groupIntoSequences(results:ISearchResult[]):ISearchResultSequence[] {
    const lookup:Map<StateNode, number> = new Map();
    // create lookup for faster access of matching terms per state node
    results.forEach((r) => {
      lookup.set(<StateNode>r.state.node, r.numMatchingTerms);
    });

    return d3.nest()
      .key((d:ISearchResult) => d.numMatchingTerms + ' matching terms')
      .sortKeys(d3.descending)
      .key((d:ISearchResult) => {
        let firstStateNode:StateNode = <StateNode>d.state.node;
        let bakStateNode:StateNode = firstStateNode;
        // continue as long as previous state is still available in the search results and
        // the number of matching terms are still equal. Otherwise create a new sequence.
        while(lookup.has(firstStateNode) && lookup.get(firstStateNode) === d.numMatchingTerms) {
          bakStateNode = firstStateNode;
          firstStateNode = firstStateNode.previousState;
        }
        return String(bakStateNode.id);
      })
      .sortKeys(d3.ascending)
      .sortValues((a:ISearchResult, b:ISearchResult) => a.state.node.id - b.state.node.id)
      .entries(results)
      // </end> of d3.nest -> continue with nested array
      //.map((d) => { // debug
      //  console.log(d );
      //  return d;
      //})
      // flatten the array
      .reduce((prev, curr) => prev.concat(curr.values), [])
      // flatten once more and create a sequence from search results array
      .map((d) => new SearchResultSequence(d.values));
  }


  private updateResults(sequences:ISearchResultSequence[], clearContent:boolean = false) {

    if(clearContent) {
      this.$searchResults.selectAll('*').remove(); // clear DOM list
    }

    if(sequences.length === 0) {
      return;
    }

    const widthScale = d3.scale.linear().domain([0, 1]).range([0, 100]);

    const $seqLi = this.createSequenceDOM(this.$searchResults, sequences, widthScale);
    this.createStateListDOM($seqLi.select('.states'), widthScale);
  }

  /**
   *
   * @param $parent
   * @param sequences
   * @param widthScale
   * @returns {selection.Update<ISearchResultSequence>}
   */
  private createSequenceDOM($parent, sequences:ISearchResultSequence[], widthScale):d3.Selection<ISearchResultSequence> {
    const that = this;

    const data = sequences.sort((a, b) => b.topResult.weightedSimilarity - a.topResult.weightedSimilarity);

    const $seqLi = $parent
      .selectAll('li.sequence')
      .data(sequences, (d:ISearchResultSequence) => d.id)
      .order();

    $seqLi.enter().append('li')
      .classed('sequence', true)
      // set child elements here to avoid reloading when manipulating the weights
      .html(function(d:ISearchResultSequence) {
        const terms = d.topResult.state.propValues.map((prop) => {
          const match = d.topResult.query.propValues.find((p) => p.id.split(TAG_VALUE_SEPARATOR)[0].trim() === prop.id.split(TAG_VALUE_SEPARATOR)[0].trim());
          return (match) ? `<span class="match">${prop.text}</span>` : `${prop.text}`;
        });

        let seqIconId = 'n-states';
        let seqLength = d.searchResults.length || '';
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

        const url = utils.thumbnail_url(that.data, (<StateNode>d.topResult.state.node));
        const img = new Image();
        img.onload = () => {
          d3.select(this).select('.prov-ret-thumbnail > .loading').classed('hidden', true);
        };
        img.src = url;
        if (img.complete) {
          (<any>img).onload();
        }

        return `
          <div class="top-result" data-score="${d.topResult.weightedSimilarity.toFixed(2)}">
            <div class="prov-ret-thumbnail">
              <svg role="img" viewBox="0 0 128 32" class="loading" preserveAspectRatio="xMinYMin meet">
                <use xlink:href="#loading-animation"></use>
              </svg>
              <div class="img" style="background-image: url(${url})"></div>
            </div>
            <div class="title" href="#" title="${(<StateNode>d.topResult.state.node).name}">${(<StateNode>d.topResult.state.node).name}</div>
            <small class="result-terms">${terms.join(', ')}</small>
            <div class="seq-length" title="Click to show state sequence">
              <svg role="img" viewBox="0 0 100 40" class="svg-icon" preserveAspectRatio="xMinYMin meet">
                <use xlink:href="#${seqIconId}"></use>
              </svg>
              <span>${seqLength}</span>
            </div>
            <ul class="similarity-bar"></ul>
          </div>
          <ol class="states hidden"></ol>
        `;
      });

    $seqLi.exit().remove();

    const addMouseListener = ($elem) => {
      $elem
        .on('mouseenter', (d:ISearchResultSequence) => {
          (<Event>d3.event).stopPropagation();
          this.data.selectState(<StateNode>d.topResult.state.node, idtypes.SelectOperation.SET, idtypes.hoverSelectionType);
        })
        .on('mouseleave', (d:ISearchResultSequence) => {
          (<Event>d3.event).stopPropagation();
          this.data.selectState(<StateNode>d.topResult.state.node, idtypes.SelectOperation.REMOVE, idtypes.hoverSelectionType);
        })
        .on('click', (d:ISearchResultSequence) => {
          (<Event>d3.event).stopPropagation();
          this.data.selectState(<StateNode>d.topResult.state.node, idtypes.toSelectOperation(<MouseEvent>d3.event));
          this.data.jumpTo(<StateNode>d.topResult.state.node);
          return false;
        });
    };

    addMouseListener($seqLi.select('.title'));
    addMouseListener($seqLi.select('.prov-ret-thumbnail'));

    const hoverMultipleStateNodes = (seq:ISearchResultSequence, operation: SelectOperation) => {
      const stateNodeIds:number[] = seq.searchResults.map((d) => this.data.states.indexOf(<StateNode>d.state.node));
      // hover multiple stateNodeIds
      this.data.select(ProvenanceGraphDim.State, idtypes.hoverSelectionType, stateNodeIds, operation);
    };

    $seqLi.select('.seq-length')
      .on('mouseenter', (d:ISearchResultSequence) => {
        (<Event>d3.event).stopPropagation();
        hoverMultipleStateNodes(d, idtypes.SelectOperation.SET);
      })
      .on('mouseleave', (d:ISearchResultSequence) => {
        (<Event>d3.event).stopPropagation();
        hoverMultipleStateNodes(d, idtypes.SelectOperation.REMOVE);
      })
      .on('click', (d:ISearchResultSequence) => {
        (<Event>d3.event).stopPropagation();
        // expand/collapse only for sequence length > 1
        if(d.searchResults.length > 1) {
          const li = (<any>d3.event).target.parentNode.parentNode;
          li.classList.toggle('active');
          li.querySelector('.states').classList.toggle('hidden');
        }
        return false;
      });

    const $seqSimBar = $seqLi.select('.similarity-bar')
      .attr('data-tooltip', (d:ISearchResultSequence) => {
        const textSim = d.topResult.query.propValues.map((p, i) => {
          return {text: p.text, similarity: d.topResult.weightedSimilarities[i]};
        });
        textSim.push({text: 'Total', similarity: d.topResult.weightedSimilarity});
        return textSim.map((t) => `${t.text}:\t${d3.round(widthScale(t.similarity), 2)}%`).join('\n');
      })
      .selectAll('li.bar')
      .data((d:ISearchResultSequence) => {
        return d.topResult.weightedSimilarities.map((sim, i) => {
          const propValue = (<any>d).topResult.query.propValues[i];
          return {
            id: propValue.id,
            text: propValue.text,
            weight: (<any>d).topResult.query.weights[i],
            color: (<any>d).topResult.query.colors[i],
            width: widthScale(sim),
          };
        });
      });

    $seqSimBar.enter().append('li').classed('bar', true);

    $seqSimBar
      .attr('data-weight', (d:any) => `${d3.round(d.weight, 2)}%`)
      .style('background-color', (d:any) => d.color)
      .style('width', (d:any) => `${d3.round(d.width, 2)}%`);

    $seqSimBar.exit().remove();

    return $seqLi;
  }

  /**
   *
   * @param $parent
   * @param widthScale
   */
  private createStateListDOM($parent:d3.Selection<ISearchResultSequence>, widthScale) {

    const $stateLi = $parent
      .selectAll('li.state')
      .data((seq:ISearchResultSequence) => seq.searchResults, (d) => d.id)
      .order();

    $stateLi.enter().append('li')
      .classed('state', true)
      .html((d:ISearchResult) => {
        return `
          <div class="seq-state-result" data-score="${d.weightedSimilarity.toFixed(2)}">
            <div class="circle"><i class="fa fa-circle glyph"></i></div>
            <div class="title" href="#">${(<StateNode>d.state.node).name}</div>
            <ul class="similarity-bar"></ul>
          </div>
        `;
      });

    $stateLi.exit().remove();

    $stateLi.select('.seq-state-result')
      .on('mouseenter', (d:ISearchResult) => {
        (<Event>d3.event).stopPropagation();
        this.data.selectState(<StateNode>d.state.node, idtypes.SelectOperation.SET, idtypes.hoverSelectionType);
      })
      .on('mouseleave', (d:ISearchResult) => {
        (<Event>d3.event).stopPropagation();
        this.data.selectState(<StateNode>d.state.node, idtypes.SelectOperation.REMOVE, idtypes.hoverSelectionType);
      })
      .on('click', (d:ISearchResult) => {
        (<Event>d3.event).stopPropagation();
        this.data.selectState(<StateNode>d.state.node, idtypes.toSelectOperation(<MouseEvent>d3.event));
        this.data.jumpTo(<StateNode>d.state.node);
        return false;
      });

    const $simBar = $stateLi.select('.similarity-bar')
      .attr('data-tooltip', (d:ISearchResult) => {
        const textSim = d.query.propValues.map((p, i) => {
          return {text: p.text, similarity: d.weightedSimilarities[i]};
        });
        textSim.push({text: 'Total', similarity: d.weightedSimilarity});
        return textSim.map((t) => `${t.text}:\t${d3.round(widthScale(t.similarity), 2)}%`).join('\n');
      })
      .selectAll('li.bar')
      .data((d:ISearchResult) => {
        return d.weightedSimilarities.map((sim, i) => {
          const propValue = d.query.propValues[i];
          return {
            id: propValue.id,
            text: propValue.text,
            weight: d.query.weights[i],
            color: d.query.colors[i],
            width: widthScale(sim),
          };
        });
      });

    $simBar.enter().append('li').classed('bar', true);

    $simBar
      .attr('data-weight', (d:any) => `${d3.round(d.weight, 2)}%`)
      .style('background-color', (d:any) => d.color)
      .style('width', (d:any) => `${d3.round(d.width, 2)}%`);

    $simBar.exit().remove();
  }

}

export function create(data: ProvenanceGraph, parent: Element, options = {}) {
  return new ProvRetrievalPanel(data, parent, options);
}
