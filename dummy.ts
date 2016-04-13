/**
 * dummy clue wrapper
 *
 * Created by Samuel Gratzl on 27.08.2015.
 */
/// <amd-dependency path='font-awesome' />
/// <amd-dependency path='bootstrap' />
import header = require('../caleydo_bootstrap_fontawesome/header');
import prov = require('./prov');
import d3 = require('d3');

/**
 * factory method creating a CLUEWrapper instance
 * @param body
 * @param options
 * @returns {CLUEWrapper}
 */
export function create(body:HTMLElement, options:any = {}) {
  header.create(body, {
      app: options.app || 'Caleydo',
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
