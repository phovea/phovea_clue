/**
 * Created by Samuel Gratzl on 15.10.2015.
 */

import C = require('../caleydo_core/main');
import prov = require('../caleydo_provenance/main');
import cmode = require('../caleydo_provenance/mode');
import d3 = require('d3');
import marked = require('marked');

const modeFeatures = {
  isEditable: () => cmode.getMode().authoring > 0.8
};

export class Renderer {
  private options = {
    animation: true,
    duration: 100,
    markdown: true
  };

  private prev = Promise.resolve(null);

  constructor(private $main:d3.Selection<any>, private graph:prov.ProvenanceGraph, options = {}) {
    C.mixin(this.options, options);
  }

  render(state:prov.AStoryNode) {
    //createa full chain
    this.prev = this.prev.then(() => {
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
    });
    return this.prev;
  }

  renderAnnotations(anns:prov.IStateAnnotation[]) {
    return new Promise((resolve) => {
      const $anns = this.$main.selectAll('div.text-annotation').data(anns);
      $anns.enter().append('div').classed('text-annotation', true).style('opacity', 0);
      $anns.html((d) => this.options.markdown ? marked(d.text) : d.text);
      $anns.style({
        width: (d:prov.IStateAnnotation) => d.size ? d.size[0] + 'px' : null,
        height: (d:prov.IStateAnnotation) => d.size ? d.size[1] + 'px' : null,
        transform: (d:prov.IStateAnnotation) => `translate(${d.pos[0]}px,${d.pos[1]}px)rotate(${d.rotation || 0}deg)scale(${d.scale ? d.scale[1] : 1},${d.scale ? d.scale[1] : 1})`
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
    const renderer : any = this.options.markdown ? marked : String;
    return new Promise((resolve) => {
      var $div = this.$main.append('div').classed('text-overlay', true).attr('data-id', overlay.id).style('opacity', 0);
      var $divs = $div.selectAll('div').data([overlay.title, overlay.text]);
      $divs.enter().append('div');
      $divs.attr('class', (d,i) => `text-overlay-${i === 0 ? 'header': 'body'}`);

      if (modeFeatures.isEditable()) {
        let onEdit = function(d) {
          //disable on click handler
          const $elem = d3.select(this).on('click', null);
          const isBody = $elem.classed('text-overlay-body');

          $elem.append('textarea').property('value', d).on('blur', function()  {
            if (!isBody) {
              overlay.title = this.value;
            } else {
              overlay.text = this.value;
            }
            //update value and enable edit click handler again
            $elem.datum(this.value).html((d: string) => d.length === 0 ? '<i>Enter Text by Clicking (MarkDown supported)</i>' : renderer(d)).on('click', onEdit);
          });
        };
        $divs.html((d: string) => d.length === 0 ? '<i>Enter Text by Clicking (MarkDown supported)</i>' : renderer(d));
        $divs.on('click', onEdit);
      } else {
        $divs.html(renderer);
      }

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

  editAnnotation(anns:prov.IStateAnnotation) {

  }
}

export function create(main:HTMLElement, graph:prov.ProvenanceGraph) {
  const instance = new Renderer(d3.select(main), graph);
  return {
    render: instance.render.bind(instance),
    edit: instance.editAnnotation.bind(instance)
  };
}