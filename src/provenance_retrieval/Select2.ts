/**
 * Created by Holger Stitz on 07.06.2017.
 */
import 'select2';
import * as $ from 'jquery';
import {
  IProperty, IPropertyValue, PropertyType,
  TAG_VALUE_SEPARATOR, createPropertyValue
} from 'phovea_core/src/provenance/retrieval/VisStateProperty';

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

  private prepData:ISelect2Category[] = [];

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

    const $instance = $(selector);
    return $instance.select2(<any>{
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
          items = this.updateDisabled(items);
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
          if (item.needsInput && this.findQueryInParam(query, item.text)) {
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

  /**
   * Updates Select2 field according to the PropertyValue setting.
   * Important: This function mutates the original data.
   * @param {ISelect2Category[]} data
   * @returns {ISelect2Category[]}
   */
  private updateDisabled(data:ISelect2Category[]):ISelect2Category[] {
    data.forEach((d) => {
      if (d.children) {
        d.children.forEach((item) => {
          // sets the Select2 disabled field based on the propValue
          item.disabled = item.propValue.isDisabled;
        });
      }
    });
    return data;
  }

  // mark match code from http://stackoverflow.com/a/29018243/940219
  private templateResult(item, searchTerm) {
    const text = item.text;
    const isActive = (item.propValue) ? item.propValue.isActive : false;

    // Find where the match is
    const match = text.toUpperCase().indexOf(searchTerm.toUpperCase());

    const $template = $('<div></div>');

    // If there is no match, move on
    if (match < 0) {
      return $template.html(text);
    }

    const $result = $(`
      <div>
        <span>${text.substring(0, match)}</span>
        <span class="select2-rendered__match">${text.substring(match, match + searchTerm.length)}</span>
        <span>${text.substring(match + searchTerm.length)}</span>
      </div>
    `);

    $template.append($result);

    if(isActive) {
      const $isActive = $(`<div class="select2-rendered__is-active"></div>`);
      $template.append($isActive);
    }

    return $template;
  }

}
