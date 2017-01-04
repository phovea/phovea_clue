/**
 * dummy clue wrapper
 *
 * Created by Samuel Gratzl on 27.08.2015.
 */
/// <amd-dependency path='font-awesome' />
/// <amd-dependency path='bootstrap' />
import * as header from 'phovea_ui/src/header';
import * as prov from 'phovea_core/src/provenance';
import * as d3 from 'd3';

/**
 * factory method creating a CLUEWrapper instance
 * @param body
 * @param options
 * @returns {CLUEWrapper}
 */
export function create(body:HTMLElement, options:any = {}) {
  header.create(body, {
      appLink: new header.AppHeaderLink(options.app || 'Caleydo'),
      inverse: true
    });
  const $main = d3.select(body).append('main').style('height', '92vh');
  const graph = prov.createDummy();
  return {
    on: (...args : any[]) => 0,
    $main: $main,
    graph: Promise.resolve(graph),
    jumpToStored: () => 0
  };
}
