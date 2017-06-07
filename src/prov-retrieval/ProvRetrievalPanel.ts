/**
 * Created by Holger Stitz on 01.06.2017.
 */
import 'select2';
import * as $ from 'jquery';
import * as d3 from 'd3';
import ProvenanceGraph from 'phovea_core/src/provenance/ProvenanceGraph';
import {AVisInstance, IVisInstance} from 'phovea_core/src/vis';
import {onDOMNodeRemoved, mixin} from 'phovea_core/src/index';
import StateNode from 'phovea_core/src/provenance/StateNode';
import * as idtypes from 'phovea_core/src/idtype';

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

    const $select2 = new Select2();
    $select2.init('#prov-retrieval-select', []);

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

interface IQuery {
  term: string;
}

interface ISelect2Data {
  text: string;
  id?: string;
  children?: ISelect2Data[];
  param?: boolean;
}

class Select2 {

  private static TAG_VALUE_SEPARATOR = '=';

  private query: IQuery = {
    term: ''
  };

  constructor() {
    //
  }

  init(selector: string, data: ISelect2Data[]) {
    return $(selector).select2(<any>{
      theme: 'bootstrap',
      placeholder: 'Add filter by attribute, visualization, value, …',
      data,
      multiple: true,

      tags: true,
      // create custom tags for items that have a parameter and that parameter is complete
      createTag: (query) => {
        const queryTerm = query.term;
        const matchItemWithParam = data.slice(0)
          .filter((d) => d.children !== undefined)
          .map((d) => d.children)
          .some((d) => {
            return d
              .filter((e) => e.param === true)
              .some((e) => this.findQueryInParam(queryTerm, e.text));
          });

        if (matchItemWithParam) {
          return {
            id: queryTerm,
            text: queryTerm,
            tag: true
          };
        } else {
          return null; // no match == no tag
        }
      },

      escapeMarkup: (markup) => {
        return markup;
      }, // let our custom formatter work
      //minimumInputLength: 1,
      language: {
        searching: (params) => {
          // Intercept the query as it is happening
          this.query = params;

          // Change this to be appropriate for your application
          return 'Searching…';
        }
      },
      templateResult: (item: any) => {
        // No need to template the searching text
        if (item.loading) {
          return item.text;
        }

        const term = this.query.term || '';
        return this.markMatch(item.text, term);
      },
      templateSelection: (item: any) => {
        if (!item.id) {
          return $(`<span>${item.text}</span>`);
        }
        return $(`<span>${item.text}</span>`);
      },
      ajax: {
        cache: false,
        dataType: 'json',
        delay: 0, // increase for 'real' ajax calls

        data: (params) => {
          return params; // params.term = search term
        },

        // fake ajax call with local data
        transport: (queryParams, success, error) => {
          return success({
            items: this.filterData(data.slice(0), queryParams.data.term)
          });
        },

        // parse the results into the format expected by Select2.
        processResults: (data, params) => {
          return {
            results: data.items,
            pagination: {
              more: false
            }
          };
        }
      }
    })
      .on('select2:selecting', (e) => {
        const item:ISelect2Data = e.params.args.data;

        if (item.param === true) {
          // prevent adding items with parameter -> will be added by `createTag()`
          e.preventDefault();

          // instead: provide some autocomplete the the user just has to enter the parameter
          const $searchfield = $(e.currentTarget).next()
            .find('.select2-search__field');

          $searchfield
            .val(item.text.slice(0, item.text.indexOf(Select2.TAG_VALUE_SEPARATOR) + 2))
            .css('width', '12em') // TODO make it flexible based on the text length or automatically by triggering select2.keypress()
            .focus();

          /*if(!findQueryInParam(query.term, item.text)) {
           $searchfield.get(0)
           .setSelectionRange(item.text.indexOf(tagValueSeparator) + 2, item.text.length);
           }*/
        }
      })
      /*.on('change', (e) => { console.log('change', e); })
       .on('select2:open', function (e) { console.log('select2:open', e); })
       .on('select2:close', function (e) { console.log('select2:close', e); })
       .on('select2:select', function (e) { console.log('select2:select', e); })
       .on('select2:unselect', function (e) { console.log('select2:unselect', e); })*/
      ;
  }

  private findQueryInText(query, text) {
    return text.toLowerCase().indexOf(query.toLowerCase()) > -1;
  }

  private findQueryInParam(query, text) {
    // matching `key=value` pairs with numbers (.4, 0.4, 4) as values
    const regex = /(\w+)\s*\=\s*((?:\d*\.)?\d+)/i;
    const matches = query.match(regex);
    return matches && this.findQueryInText(matches[1], text);
  }

  private filterData(data, query) {
    if (!query) {
      return data;
    }

    let result = [];

    data.forEach((d) => {
      const res: ISelect2Data = {text: d.text};

      if (d.id) {
        res.id = d.id;
      }

      // query found in category -> add all children
      if (this.findQueryInText(query, d.text)) {
        res.children = d.children;
        result = [...result, res];

        // otherwise search in children and add only matching
      } else if (d.children) {
        res.children = d.children.filter((item) => {
          if (item.param && this.findQueryInParam(query, item.text)) {
            return true;
          }
          return this.findQueryInText(query, item.text);
        });

        if (res.children.length > 0) {
          result = [...result, res];
        }
      }
    });

    return result;
  }

  // from http://stackoverflow.com/a/29018243/940219
  private markMatch(text, term) {
    // Find where the match is
    const match = text.toUpperCase().indexOf(term.toUpperCase());

    const $result = $('<span></span>');

    // If there is no match, move on
    if (match < 0) {
      return $result.html(text);
    }

    // Put in whatever text is before the match
    $result.html(text.substring(0, match));

    // Mark the match
    const $match = $(`<span class="select2-rendered__match"></span>`);
    $match.html(text.substring(match, match + term.length));

    // Append the matching text
    $result.append($match);

    // Put in whatever is after the match
    $result.append(text.substring(match + term.length));

    return $result;
  }

}


export function create(data: ProvenanceGraph, parent: Element, options = {}) {
  return new ProvRetrievalPanel(data, parent, options);
}
