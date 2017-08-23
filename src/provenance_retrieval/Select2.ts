/**
 * Created by Holger Stitz on 07.06.2017.
 */
import 'select2';
import * as $ from 'jquery';
import {
  IProperty, IPropertyValue, PropertyType,
  TAG_VALUE_SEPARATOR, createPropertyValue
} from 'phovea_core/src/provenance/retrieval/VisStateProperty';
import * as d3 from 'd3';

interface IQuery {
  term: string;
}

interface ISelect2Attr {
  text: string;
  id?: number|string;
  needsInput?: boolean;
  disabled?: boolean;
  prop?: IProperty;
  propValue?: IPropertyValue;
}

interface ISelect2Category extends ISelect2Attr {
  children?: ISelect2Attr[];
}

export class Select2 {

  $instance:JQuery;

  private prepData:ISelect2Category[] = [];
  private numCountScale: d3.scale.Linear<number, number> = d3.scale.linear().domain([0, 1, 1]).range([0, 2, 100]);

  private query: IQuery = {
    term: ''
  };

  constructor() {
    //
  }

  open() {
    if(!this.$instance) {
      return;
    }
    this.$instance.select2('open');
  }

  close() {
    if(!this.$instance) {
      return;
    }
    this.$instance.select2('close');
  }

  private prepareData(data : IProperty[]):ISelect2Category[] {
    return data.map((prop) => {
      return {
        text: prop.text,
        children: prop.values.map((propValue:IPropertyValue) => {
          // adapt scale with maximum value
          this.numCountScale.domain([0, 1, Math.max(...this.numCountScale.domain(), propValue.numCount)]);

          return {
            text: propValue.text,
            id: propValue.id,
            needsInput: propValue.needsInput,
            disabled: propValue.isDisabled,
            prop,
            propValue
          };
        })
      };
    });
  }

  updateData(data:IProperty[]) {
    this.prepData = this.prepareData(data);
  }

  init(selector: string, data: IProperty[]) {
    this.updateData(data);

    this.$instance = $(selector);
    return this.$instance.select2(<any>{
      theme: 'bootstrap',
      placeholder: 'Search for attribute, selection, …',
      data: this.prepData,
      multiple: true,

      tags: true,
      // create custom tags for items that have a parameter and that parameter is complete
      createTag: (query) => {
        const queryTerm = query.term;
        const matchItemWithParam = this.prepData.slice(0)
          .filter((d) => d.children !== undefined)
          .map((d) => d.children)
          .some((d) => {
            return d
              .filter((e) => e.needsInput === true)
              .some((e) => this.findQueryInParam(queryTerm, e.text));
          });

        if (matchItemWithParam) {
          const queryParts = queryTerm.split(TAG_VALUE_SEPARATOR).map((d) => d.trim());
          return {
            id: queryTerm,
            text: queryTerm,
            tag: true,
            propValue: createPropertyValue(PropertyType.NUMERICAL, {
              id: queryTerm,
              text: queryTerm,
              payload: {
                numVal: parseFloat(queryParts[1])
              }
            })
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
        return this.templateResult(item, term);
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
          let items = this.prepData.slice(0);
          items = this.filterData(items, queryParams.data.term);
          return success({
            items
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
      const item:ISelect2Attr = e.params.args.data;

      if (item.needsInput === true) {
        // prevent adding items with parameter -> will be added by `createTag()`
        e.preventDefault();

        // instead: provide some autocomplete the the user just has to enter the parameter
        const $searchfield = $(e.currentTarget).next()
          .find('.select2-search__field');

        $searchfield
          .val(item.text.slice(0, item.text.indexOf(TAG_VALUE_SEPARATOR) + 2))
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

  private findQueryInText(query:string, text:string):boolean {
    return text.toLowerCase().indexOf(query.toLowerCase()) > -1;
  }

  private findQueryInParam(query:string, text:string):boolean {
    // matching `key=value` pairs with numbers (.4, 0.4, 4) as values
    const regex = /(\w+)\s*\=\s*((?:\d*\.)?\d+)/i;
    const matches = query.match(regex);
    return matches && this.findQueryInText(matches[1], text);
  }

  private filterData(data:ISelect2Category[], query:string):ISelect2Category[] {
    if (!query) {
      return data;
    }

    let result:ISelect2Category[] = [];

    data.forEach((d) => {
      const res: ISelect2Category = {text: d.text};

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
          const propText = (item.propValue && item.propValue.payload && item.propValue.payload.propText) ? item.propValue.payload.propText : '';
          if (item.needsInput && (this.findQueryInParam(query, item.text) || this.findQueryInParam(query, propText))) {
            return true;
          }
          return (this.findQueryInText(query, item.text) || this.findQueryInText(query, propText));
        });

        if (res.children.length > 0) {
          result = [...result, res];
        }
      }
    });

    return result;
  }

  // mark match code from http://stackoverflow.com/a/29018243/940219
  private templateResult(item, searchTerm) {
    function markMatch($template:JQuery, cssClass:string, text:string, searchTerm:string) {
      // Find where the match is
      const match = text.toUpperCase().indexOf(searchTerm.toUpperCase());

      const $result = $(`<div class="${cssClass}"></div>`);

      // If there is no match, move on
      if (match < 0 || searchTerm === '') {
        $result.html(text);

      } else {
        $result.html(` 
          <span>${text.substring(0, match).replace(' ', '&nbsp;')}</span> 
          <span class="select2-rendered__match">${text.substring(match, match + searchTerm.length).replace(' ', '&nbsp;')}</span> 
          <span>${text.substring(match + searchTerm.length).replace(' ', '&nbsp;')}</span>
        `);
      }

      $template.append($result);
    }

    const $template = $('<div></div>');
    const $searchResults = $('<div class="select2-rendered__result-text"></div>');
    markMatch($searchResults, 'select2-rendered__item-text', item.text, searchTerm);

    if(item.propValue && item.propValue.payload && item.propValue.payload.propText) {
      markMatch($searchResults, 'select2-rendered__prop-text', `${item.propValue.payload.propText}`, searchTerm);
    }
    $template.append($searchResults);

    if(item.propValue && item.propValue.isActive) {
      const $isActive = $(`<div class="select2-rendered__is-active" title="Active in current state"></div>`);
      $template.append($isActive);
    }

    if(item.propValue && item.propValue.numCount !== undefined) {
      const $numCount = $(`<div class="select2-rendered__num-count" title="Found in ${item.propValue.numCount} states" data-num-count="${item.propValue.numCount}"><div style="width: ${this.numCountScale(item.propValue.numCount)}%;"></div></div>`);
      $template.append($numCount);
    }

    return $template;
  }

}
