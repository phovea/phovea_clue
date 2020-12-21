/**
 * Created by Holger Stitz on 07.06.2017.
 */
import 'select2';
import * as $ from 'jquery';
import { PropertyType, TAG_VALUE_SEPARATOR, createPropertyValue } from 'phovea_core';
import * as d3 from 'd3';
export class Select2 {
    constructor() {
        this.prepData = [];
        this.numCountScale = d3.scale.linear().domain([0, 1, 1]).range([0, 2, 100]);
        this.query = {
            term: ''
        };
        //
    }
    open() {
        if (!this.$instance) {
            return;
        }
        this.$instance.select2('open');
    }
    close() {
        if (!this.$instance) {
            return;
        }
        this.$instance.select2('close');
    }
    prepareData(data) {
        return data.map((prop) => {
            return {
                text: prop.text,
                children: prop.values
                    .filter((propValue) => propValue.isVisible === true)
                    .map((propValue) => {
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
    updateData(data) {
        this.prepData = this.prepareData(data);
    }
    init(selector, data) {
        this.updateData(data);
        this.$instance = $(selector);
        return this.$instance.select2({
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
                }
                else {
                    return null; // no match == no tag
                }
            },
            escapeMarkup: (markup) => {
                return markup;
            },
            //minimumInputLength: 1,
            language: {
                searching: (params) => {
                    // Intercept the query as it is happening
                    this.query = params;
                    // Change this to be appropriate for your application
                    return 'Searching…';
                }
            },
            templateResult: (item) => {
                // No need to template the searching text
                if (item.loading) {
                    return item.text;
                }
                const term = this.query.term || '';
                return this.templateResult(item, term);
            },
            templateSelection: (item) => {
                if (!item.id) {
                    return $(`<span>${item.text}</span>`);
                }
                return $(`<span>${item.text}</span>`);
            },
            ajax: {
                cache: false,
                dataType: 'json',
                delay: 0,
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
            const item = e.params.args.data;
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
        });
    }
    findQueryInText(query, text) {
        return text.toLowerCase().indexOf(query.toLowerCase()) > -1;
    }
    findQueryInParam(query, text) {
        // matching `key=value` pairs with numbers (.4, 0.4, 4) as values
        const regex = /(\w+)\s*\=\s*((?:\d*\.)?\d+)/i;
        const matches = query.match(regex);
        return matches && this.findQueryInText(matches[1], text);
    }
    filterData(data, query) {
        if (!query) {
            return data;
        }
        let result = [];
        data.forEach((d) => {
            const res = { text: d.text };
            if (d.id) {
                res.id = d.id;
            }
            // query found in category -> add all children
            if (this.findQueryInText(query, d.text)) {
                res.children = d.children;
                result = [...result, res];
                // otherwise search in children and add only matching
            }
            else if (d.children) {
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
    templateResult(item, searchTerm) {
        function markMatch($template, cssClass, text, searchTerm) {
            // Find where the match is
            const match = text.toUpperCase().indexOf(searchTerm.toUpperCase());
            const $result = $(`<div class="${cssClass}"></div>`);
            // If there is no match, move on
            if (match < 0 || searchTerm === '') {
                $result.html(text);
            }
            else {
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
        if (item.propValue && item.propValue.payload && item.propValue.payload.propText) {
            markMatch($searchResults, 'select2-rendered__prop-text', `${item.propValue.payload.propText}`, searchTerm);
        }
        $template.append($searchResults);
        if (item.propValue && item.propValue.isActive) {
            const $isActive = $(`<div class="select2-rendered__is-active" title="Active in current view"></div>`);
            $template.append($isActive);
        }
        if (item.propValue && item.propValue.numCount !== undefined) {
            const $numCount = $(`<div class="select2-rendered__num-count" title="Found in ${item.propValue.numCount} states" data-num-count="${item.propValue.numCount}"><div style="width: ${this.numCountScale(item.propValue.numCount)}%;"></div></div>`);
            $template.append($numCount);
        }
        return $template;
    }
}
//# sourceMappingURL=Select2.js.map