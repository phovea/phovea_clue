/**
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

  render: (state: prov.AStoryNode) => Promise<void>;

  constructor(private $main:d3.Selection<any>, private graph: prov.ProvenanceGraph, options = {}) {
    C.mixin(this.options, options);
    this.render = this.renderImpl.bind(this);
  }

  private renderImpl(state: prov.AStoryNode) {
    var takedown = this.hideOld();
    if (!state) {
      return takedown;
    }
    var next = Promise.resolve(null);
    if (state instanceof prov.TextStoryNode) {
      next = this.renderText(<prov.TextStoryNode>state);
    }
    if (state instanceof prov.JumpToStoryNode) {
      next = Promise.all([this.graph.jumpTo(state.state), this.renderAnnotations(state.annotations)]);
    }
    return Promise.all([takedown, next]);
  }

  renderAnnotations(anns:prov.IStateAnnotation[]) {
    return new Promise((resolve) => {
      const $anns = this.$main.selectAll('div.text-annotation').data(anns);
      $anns.enter().append('div').classed('text-annotation',true).style('opacity', 0);
      $anns.html((d) => this.options.markdown ? marked(d.text) : d.text);
      $anns.style({
        width: (d: prov.IStateAnnotation) => d.size ? d.size[0]+'px': null,
        height: (d: prov.IStateAnnotation) => d.size ? d.size[1]+'px': null,
        transform: (d: prov.IStateAnnotation) => `translate(${d.pos[0]}px,${d.pos[1]}px)rotate(${d.rotation||0}deg)scale(${d.scale ? d.scale[1] : 1},${d.scale ? d.scale[1] : 1})`
      });
      if (this.options.animation && !$anns.empty()) {
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

  hideOld() {
    return new Promise((resolve) => {
      const $div = this.$main.selectAll('div.text-annotation, div.text-overlay');
      if (this.options.animation && !$div.empty()) {
        $div.transition().duration(this.options.duration).style('opacity', 0).each('end', () => {
          resolve();
        }).remove();
      } else {
        $div.remove();
        resolve();
      }
    });
  }

  renderText(overlay:prov.TextStoryNode) {
    return new Promise((resolve) => {
      var $div = this.$main.append('div').classed('text-overlay', true).attr('data-id', overlay.id).style('opacity', 0);
      $div.append('div').classed('text-overlay-header',true).html(this.options.markdown ? marked(overlay.title) : overlay.title);
      $div.append('div').classed('text-overlay-body',true).html(this.options.markdown ? marked(overlay.text) : overlay.text);
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
}

export function create(main:HTMLElement, graph: prov.ProvenanceGraph) {
  return (new Renderer(d3.select(main), graph)).render;
}