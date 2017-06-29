/**
 * Created by Holger Stitz on 07.06.2017.
 */
import 'select2';
import * as $ from 'jquery';
import {VisStateIndex} from './VisStateIndex';
import {IProperty, IPropertyValue, PropertyType} from 'phovea_core/src/provenance/retrieval/VisStateProperty';

interface IQuery {
  term: string;
}

interface ISelect2Attr {
  text: string;
  id?: number|string;
  param?: boolean;
  prop?: IProperty;
  propValue?: IPropertyValue;
}

interface ISelect2Category extends ISelect2Attr {
  children?: ISelect2Attr[];
}

export class Select2 {

  private query: IQuery = {
    term: ''
  };

  constructor() {
    //
  }

  private prepareData(data : IProperty[]):ISelect2Category[] {
    return data.map((prop) => {
      return {
        text: prop.text,
        children: prop.values.map((propValue:IPropertyValue) => {
          return {
            text: propValue.text,
            id: propValue.id,
            param: propValue.type === PropertyType.NUMERICAL,
            prop,
            propValue
          };
        })
      };
    });
  }

  init(selector: string, data: IProperty[]) {
    const prepData:ISelect2Category[] = this.prepareData(data);

    return $(selector).select2(<any>{
      theme: 'bootstrap',
      placeholder: 'Add filter by attribute, visualization, value, …',
      data: prepData,
      multiple: true,

      tags: true,
      // create custom tags for items that have a parameter and that parameter is complete
      createTag: (query) => {
        const queryTerm = query.term;
        const matchItemWithParam = prepData.slice(0)
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
            items: this.filterData(prepData.slice(0), queryParams.data.term)
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

      if (item.param === true) {
        // prevent adding items with parameter -> will be added by `createTag()`
        e.preventDefault();

        // instead: provide some autocomplete the the user just has to enter the parameter
        const $searchfield = $(e.currentTarget).next()
          .find('.select2-search__field');

        $searchfield
          .val(item.text.slice(0, item.text.indexOf(VisStateIndex.TAG_VALUE_SEPARATOR) + 2))
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

  private findQueryInText(query:string, text:string) {
    return text.toLowerCase().indexOf(query.toLowerCase()) > -1;
  }

  private findQueryInParam(query:string, text:string) {
    // matching `key=value` pairs with numbers (.4, 0.4, 4) as values
    const regex = /(\w+)\s*\=\s*((?:\d*\.)?\d+)/i;
    const matches = query.match(regex);
    return matches && this.findQueryInText(matches[1], text);
  }

  private filterData(data:ISelect2Category[], query:string) {
    if (!query) {
      return data;
    }

    let result = [];

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
