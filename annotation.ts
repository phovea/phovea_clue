v/**
 * Created by Samuel Gratzl on 15.10.2015.
 */

import C = require('../caleydo_core/main');
import prov = require('../caleydo_provenance/main');
import d3 = require('d3');
import marked = require('marked');

export class Renderer {
  private options = {
    animation: true,
    duration: 100,
    markdown: true
  };

  constructor(private $main:d3.Selection<any>, options = {}) {
    C.mixin(this.options, options);
  }

  renderAnnotations(anns:prov.IStateAnnotation[]) {
    return new Promise((resolve) => {
      const $anns = this.$main.selectAll('div.text-annotation').data(anns);
      $anns.enter().append('div').classed('text-annotation',true).style('opacity', 0);
      $anns.html((d) => this.options.markdown ? marked(d.text) : d.text);
      $anns.style({
        width: (d: prov.IStateAnnotation) => d.size ? d.size[0]+'px': null,
        height: (d: prov.IStateAnnotation) => d.size ? d.size[1]+'px': null,
        transform: (d: prov.IStateAnnotation) => `translate(${d.pos[0]},${d.pos[1]})rotate(${d.rotation||0})scale(${d.scale ? d.scale[1] : 1},${d.scale ? d.scale[1] : 1})`
      });
      if (this.options.animation) {
        $anns.transition().duration(this.options.duration).style('opacity', 1).each('end', () => {
          resolve($anns.node());
        });
      } else {
        $anns.style('opacity', 1);
        resolve($anns.node());
      }
      $anns.exit().remove();
    });
  }

  removeAnnotations() {
    return new Promise((resolve) => {
      const $div = this.$main.selectAll('div.text-annotation');
      if (this.options.animation) {
        $div.transition().duration(this.options.duration).style('opacity', 0).each('end', () => {
          resolve();
        }).remove();
      } else {
        $div.remove();
        resolve();
      }
    });
  }

  render(overlay:prov.TextStoryNode) {
    return new Promise((resolve) => {
      var $div = this.$main.append('div').classed('text-overlay', true).attr('data-id', overlay.id).style('opacity', 0);
      $div.html(this.options.markdown ? marked(overlay.text) : overlay.text);
      if (this.options.animation) {
        $div.transition().duration(this.options.duration).style('opacity', 1).each('end', () => {
          resolve($div.node());
        });
      } else {
        $div.style('opacity', 1);
        resolve($div.node());
      }
    });
  }

  hide(overlay:prov.TextStoryNode) {
    return new Promise((resolve) => {
      var $div = this.$main.select(`div.text-overlay[data-id="${overlay.id}"]`);
      if (this.options.animation) {
        $div.transition().duration(this.options.duration).style('opacity', 0).each('end', () => {
          resolve();
        }).remove();
      } else {
        $div.remove();
        resolve();
      }
    });
  }
}

export function create(main:HTMLElement) {
  return new Renderer(d3.select(main));
}