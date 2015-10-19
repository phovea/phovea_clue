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

  private renderer;

  constructor(private $main:d3.Selection<any>, private graph:prov.ProvenanceGraph, options = {}) {
    C.mixin(this.options, options);

    this.renderer = (d:string) => modeFeatures.isEditable() && d.length === 0 ? '<i>Enter Text by Clicking (MarkDown supported)</i>' : (this.options.markdown ? marked(d) : d);
  }

  render(state:prov.AStoryNode) {
    //create full chain
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
        next = this.graph.jumpTo(state.state);
      }
      return Promise.all([takedown, next, this.renderAnnotations(state)]); //, this.renderArrows(state)]);
    });
    return this.prev;
  }

  private renderAnnotationsImpl(state:prov.AStoryNode) {
    const that = this;
    const editable = modeFeatures.isEditable();

    const $anns = this.$main.selectAll('div.annotation').data(state.annotations);
    const $anns_enter = $anns.enter().append('div')
      .attr('class',(d) => d.type+'-annotation')
      .classed('editable',editable);

    //move
    $anns_enter.append('button').attr('tabindex',-1).attr('class', 'btn btn-default fa fa-arrows').call(d3.behavior.drag()
      .origin((d:prov.IStateAnnotation) => ({x: d.pos[0], y: d.pos[1]}))
      .on('drag', function (d:prov.IStateAnnotation, i) {
        const e:any = d3.event;
        d.pos = [e.x, e.y];
        state.setAnnotation(i, d);
        d3.select(this.parentNode).style('left', d.pos[0]+'px').style('top', d.pos[1]+'px');
      }));

    //remove
    $anns_enter.append('button').attr('tabindex',-1).attr('class', 'btn btn-default fa fa-remove').on('click', function (d:prov.IStateAnnotation, i) {
      d3.select(this.parentNode).remove();
      state.removeAnnotation(i);
    });


    const updateTransform = (d:prov.ITextStateAnnotation) => `rotate(${d.rotation || 0}deg)`;

    $anns.filter((d) => d.type === 'text' || !d.hasOwnProperty('type')).call(($texts: d3.selection.Update<prov.ITextStateAnnotation>, $texts_enter: d3.selection.Update<prov.ITextStateAnnotation>) => {
      $texts_enter.append('div');
      $texts.select('div').html((d) => this.renderer(d.text)).style({
        width: (d:prov.ITextStateAnnotation) => d.size ? d.size[0] + 'px' : null,
        height: (d:prov.ITextStateAnnotation) => d.size ? d.size[1] + 'px' : null,
        transform: updateTransform
      });
    }, $anns_enter.filter((d) => d.type === 'text' || !d.hasOwnProperty('type')));

    $anns.filter((d) => d.type === 'arrow').call(($arrows: d3.selection.Update<prov.IArrowStateAnnotation>, $arrows_enter: d3.selection.Update<prov.IArrowStateAnnotation>) => {
      var $svg_enter = $arrows_enter.append('svg').attr({
          width: 200, //TODO (50) + xminmax[1] - xminmax[0],
          height: (50), //TODO yminmax[1] - yminmax[0],
          //transform: `translate(${-xminmax[0]},${-yminmax[0]})`
        });
      $svg_enter.append('defs').append('marker').attr({
          id: 'clue_text_arrow_marker',
          viewBox: '0 -5 10 10',
          refX: 15,
          refY: -1.5,
          markerWidth: 6,
          markerHeight: 6,
          orient: 'auto'
        }).append('path').attr('d', 'M0,-5L10,0L0,5');
      $svg_enter.append('line').classed('arrow',true).attr({
        'marker-end': 'url(#clue_text_arrow_marker)',
      });
      /*
      $arrows.select('svg');

      const xminmax = d3.extent(arrows, (d) => Math.min(d.start[0], d.end[0]));
      const yminmax = d3.extent(arrows, (d) => Math.min(d.start[1], d.end[1]));

      $svg.attr({
        width: (50) + xminmax[1] - xminmax[0],
        height: (50) + yminmax[1] - yminmax[0],
        transform: `translate(${-xminmax[0]},${-yminmax[0]})`
      });
      $svg

      const $arrows = $svg.selectAll('g.arrow').data(arrows);
      const $arrows_enter = $arrows.enter().append('g');
      $arrows_enter.append('line').classed('arrow', true).attr({
        'marker-end': 'url(#clue_text_arrow_marker)',
        x1: (d) => d.start[0],
        x2: (d) => d.end[0],
        y1: (d) => d.start[1],
        y2: (d) => d.end[1]
      });
      */
    }, $anns_enter.filter((d) => d.type === 'arrow'));

    $anns.filter((d) => d.type === 'frame').call(($frames: d3.selection.Update<prov.IFrameStateAnnotation>, $frames_enter: d3.selection.Update<prov.IFrameStateAnnotation>) => {

    }, $anns_enter.filter((d) => d.type === 'frame'));

    $anns.style({
      left: (d:prov.IStateAnnotation) => d.pos[0] + 'px',
      top: (d:prov.IStateAnnotation) => d.pos[1] + 'px'
    });

    $anns.exit().remove();

    return $anns;
  }

  private renderTextAnnotationsImpl(state:prov.AStoryNode) {
    const that = this;
    const editable = modeFeatures.isEditable();

    const $anns = this.$main.selectAll('div.text-annotation').data(<prov.ITextStateAnnotation[]>state.annotations.filter((d) => d.type === 'text'));
    const $anns_enter = $anns.enter().append('div')
      .classed('text-annotation', true);


    let onEdit = function (d:prov.ITextStateAnnotation, i) {
      const $elem = d3.select(this);
      if (!d3.select(this.parentNode).classed('editable')) {
        return;
      }
      $elem.on('click', null);
      $elem.append('textarea').property('value', d.text).on('blur', function () {
        d.text = this.value;
        state.setAnnotation(i, d);
        //update value and enable edit click handler again
        $elem.html(that.renderer(this.value)).on('click', onEdit);
      });
    };

    $anns_enter.append('div').on('click', onEdit);

    const updateTransform = (d:prov.ITextStateAnnotation) => `rotate(${d.rotation || 0}deg)`;

    if (editable) {

      //resize
      $anns_enter.append('button').attr('tabindex',-1).attr('class', 'btn btn-default fa fa-expand fa-flip-horizontal')
        .on('dblclick', function(d:prov.ITextStateAnnotation,i) {
          //remove the fixed size
          delete d.size;
          state.setAnnotation(i, d);
          d3.select(this.parentNode).style({
            width: null,
            height: null
          });
        })
        .call(d3.behavior.drag()
          .origin((d:prov.IStateAnnotation) => ({x: d.pos[0], y: d.pos[1]}))
          .on('drag', function (d:prov.ITextStateAnnotation, i) {
          const e : any = d3.event;
          d.size = [d.pos[0] + e.x, d.pos[1] + e.y];
          state.setAnnotation(i, d);
          d3.select(this.parentNode).select('div').style({
            width: (d:prov.ITextStateAnnotation) => d.size ? d.size[0] + 'px' : null,
            height: (d:prov.ITextStateAnnotation) => d.size ? d.size[1] + 'px' : null
          });
        }));
      //rotate
      $anns_enter.append('button').attr('tabindex', -1).attr('class', 'btn btn-default fa fa-rotate-right').call(d3.behavior.drag()
        .origin(() => ({x : 0, y: 0}))
        .on('drag', function (d:prov.ITextStateAnnotation, i) {
          const e:any = d3.event;
          //const base_pos = C.bounds(this);
          //const bounds = C.bounds(this.parentNode);
          var bak = d.rotation || 0;
          if (e.dx > 1) {
            d.rotation = bak + 10;
          } else if (e.dx < -1) {
            d.rotation = bak - 10;
          }
          if (d.rotation !== bak) {
            state.setAnnotation(i, d);
            d3.select(this.parentNode).select('div').style('transform', updateTransform);
          }
        }));
    }
    $anns.select('div').html((d) => this.renderer(d.text)).style({
      width: (d:prov.ITextStateAnnotation) => d.size ? d.size[0] + 'px' : null,
      height: (d:prov.ITextStateAnnotation) => d.size ? d.size[1] + 'px' : null,
      transform: updateTransform
    }).each(function(d) {
      if (d.styles) {
        d3.select(this).style(d.styles);
      }
    });
    $anns.style({
      left: (d:prov.IStateAnnotation) => d.pos[0] + 'px',
      top: (d:prov.IStateAnnotation) => d.pos[1] + 'px'
    });

    $anns.exit().remove();

    return $anns;
  }

  renderAnnotations(state:prov.AStoryNode) {
    return new Promise((resolve) => {
      const $anns = this.renderAnnotationsImpl(state);
      const editable = modeFeatures.isEditable();
      if (editable) {
        this.$main.append('button').attr('class', 'btn btn-default fa fa-plus-square add-text-annotation').on('click', () => {
          state.pushAnnotation({
            type: 'text',
            pos: [100, 100],
            text: ''
          });
          this.renderAnnotationsImpl(state);
        });
      }


      if (this.options.animation && !$anns.empty()) {
        $anns.style('opacity', 0).transition().duration(this.options.duration).style('opacity', 1).each('end', () => {
          resolve($anns.node());
        });
      } else {
        $anns.style('opacity', 1);
        resolve($anns.node());
      }
    });
  }

  hideOld() {
    return new Promise((resolve) => {
      const $div = this.$main.selectAll('div.text-annotation, div.text-overlay, button.add-text-annotation, svg.text-arrow');
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
    const that = this;
    return new Promise((resolve) => {
      var $div = this.$main.append('div').classed('text-overlay', true).attr('data-id', overlay.id).style('opacity', 0);
      var $divs = $div.selectAll('div').data([overlay.title, overlay.text]);
      $divs.enter().append('div');
      $divs.attr('class', (d, i) => `text-overlay-${i === 0 ? 'header' : 'body'}`);

      const editable = modeFeatures.isEditable();

      $divs.classed('editable', editable);
      let onEdit = function (d) {
        const $elem = d3.select(this);
        if (!$elem.classed('editable')) {
          return;
        }
        $elem.on('click', null);
        //disable on click handler
        const isBody = $elem.classed('text-overlay-body');

        $elem.append('textarea').property('value', d).on('blur', function () {
          if (!isBody) {
            overlay.title = this.value;
          } else {
            overlay.text = this.value;
          }
          //update value and enable edit click handler again
          $elem.datum(this.value).html(that.renderer).on('click', onEdit);
        });
      };
      $divs.on('click', onEdit);

      $divs.html(that.renderer);

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

export function create(main:HTMLElement, graph:prov.ProvenanceGraph) {
  const instance = new Renderer(d3.select(main), graph);
  return {
    render: instance.render.bind(instance)
  };
}
