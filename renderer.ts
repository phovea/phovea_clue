/**
 * Created by Samuel Gratzl on 15.10.2015.
 */

import prov = require('../caleydo_provenance/main');
import d3 = require('d3');

export interface IRenderer {
  render(overlay:prov.TextStoryNode): Promise<HTMLElement>;
  hide(overlay:prov.TextStoryNode): Promise<HTMLElement>;
}

export function create(main:HTMLElement): IRenderer {
  const $main = d3.select(main);
  return {
    render: (overlay:prov.TextStoryNode) => {
      return new Promise((resolve) => {
        var $div = $main.append('div').classed('text-overlay', true).attr('data-id', overlay.id).style('opacity', 0);
        $div.html(overlay.text);
        $div.transition().duration(100).style('opacity', 1).each('end', () => {
          resolve($div.node());
        });
      });
    },
    hide: (overlay:prov.TextStoryNode) => {
      return new Promise((resolve) => {
        var $div = this.$main.select(`div.text-overlay[data-id="${overlay.id}"]`);
        $div.transition().duration(100).style('opacity', 0).each('end', () => {
          resolve();
        }).remove();
      });
    }
  }
}