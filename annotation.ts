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
      .attr('class',(d) => d.type+'-annotation annotation')
      .classed('editable',editable);

    if (editable) {
      //move
      $anns_enter.append('button').attr('tabindex', -1).attr('class', 'btn btn-default fa fa-arrows').call(d3.behavior.drag()
        .origin((d:prov.IStateAnnotation) => ({x: d.pos[0], y: d.pos[1]}))
        .on('drag', function (d:prov.IStateAnnotation, i) {
          const e:any = d3.event;
          d.pos = [e.x, e.y];
          state.setAnnotation(i, d);
          d3.select(this.parentNode).style('left', d.pos[0] + 'px').style('top', d.pos[1] + 'px');
        }));

      //remove
      $anns_enter.append('button').attr('tabindex', -1).attr('class', 'btn btn-default fa fa-remove').on('click', function (d:prov.IStateAnnotation, i) {
        d3.select(this.parentNode).remove();
        state.removeAnnotation(i);
      });
    }

    const updateTransform = (d:prov.IStateAnnotation) => `translate(${d.pos[0]},${d.pos[1]})rotate(${(<any>d).rotation || 0}deg)`;

    //Text
    $anns.filter((d) => d.type === 'text' || !d.hasOwnProperty('type')).call(($texts: d3.selection.Update<prov.ITextStateAnnotation>, $texts_enter: d3.selection.Update<prov.ITextStateAnnotation>) => {

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
      $texts_enter.append('div').classed('text',true).on('click', onEdit);

      $texts.select('div.text').html((d) => this.renderer(d.text)).style({
        width: (d:prov.ITextStateAnnotation) => d.size ? d.size[0] + 'px' : null,
        height: (d:prov.ITextStateAnnotation) => d.size ? d.size[1] + 'px' : null,
        transform: updateTransform
      }).each(function (d) {
        if (d.styles) {
          d3.select(this).style(d.styles);
        }
      });
    }, $anns_enter.filter((d) => d.type === 'text' || !d.hasOwnProperty('type')));


    //Arrow
    $anns.filter((d) => d.type === 'arrow').call(($arrows: d3.selection.Update<prov.IArrowStateAnnotation>, $arrows_enter: d3.selection.Update<prov.IArrowStateAnnotation>) => {
      var $svg_enter = $arrows_enter.append('svg').attr({
          width: (d) => 50+Math.abs(d.at[0]),
          height: (d) => 50+Math.abs(d.at[1])
        });
      $svg_enter.append('defs').append('marker').attr({
          id: (d,i) => 'clue_text_arrow_marker'+i,
          viewBox: '0 0 10 10',
          refX: 0,
          refY: 5,
          markerWidth: 4,
          markerHeight: 3,
          markerUnits: 'strokeWidth',
          orient: 'auto'
        }).append('path').attr('d', 'M 0 0 L 10 5 L 0 10 z');
      $svg_enter.append('g').append('line').classed('arrow',true).attr({
        'marker-end': (d,i) => 'url(#clue_text_arrow_marker'+i+')'
      });

      var $svg = $arrows.select('svg');

      function updateShift() {
        $svg.attr({
          width: (d) => 50+Math.abs(d.at[0]),  //TODO (50) + xminmax[1] - xminmax[0],
          height: (d) => 50+Math.abs(d.at[1]) //TODO yminmax[1] - yminmax[0],
        });
        $svg.select('g').attr('transform', (d) => `translate(${-Math.min(0,d.at[0])+25},${-Math.min(0,d.at[1])+25})`);
      }

      if (editable) {
        $svg_enter.select('g').append('circle').classed('anchor',true).attr('r', 10);
        $svg.select('circle').style({
          cx: (d) => d.at[0],
          cy: (d) => d.at[1]
        }).call(d3.behavior.drag()
          .origin((d:prov.IArrowStateAnnotation) => ({x: d.at[0], y: d.at[1] }))
          .on('drag', function (d:prov.IArrowStateAnnotation, i) {
            const e:any = d3.event;
            d.at = [e.x, e.y];
            state.setAnnotation(i, d);
            d3.select(this).style({
              cx: d.at[0],
              cy: d.at[1]
            });
            $svg.select('line').attr({
              x2: d.at[0],
              y2: d.at[1]
            });
            updateShift();
          }));
      }
      updateShift();
      $svg.select('line').attr({
        x2: (d) => d.at[0],
        y2: (d) => d.at[1]
      }).each(function (d) {
        if (d.styles) {
          d3.select(this).style(d.styles);
        }
      });
    }, $anns_enter.filter((d) => d.type === 'arrow'));

    //FRAME
    $anns.filter((d) => d.type === 'frame').call(($frames: d3.selection.Update<prov.IFrameStateAnnotation>, $frames_enter: d3.selection.Update<prov.IFrameStateAnnotation>) => {
      $frames.style({
        width: (d) => d.size[0] + 'px',
        height: (d) => d.size[1] + 'px'
      }).each(function (d) {
        if (d.styles) {
          d3.select(this).style(d.styles);
        }
      });

      //resize
      $frames_enter.append('button').attr('tabindex',-1).attr('class', 'btn btn-default fa fa-expand fa-flip-horizontal')
        .call(d3.behavior.drag()
          .origin((d:prov.IFrameStateAnnotation) => ({x: d.pos[0], y: d.pos[1]}))
          .on('drag', function (d:prov.IFrameStateAnnotation, i) {
          const e : any = d3.event;
          d.size = [e.x, e.y];
          state.setAnnotation(i, d);
          d3.select(this.parentNode).style({
            width: (d:prov.IFrameStateAnnotation) => d.size ? d.size[0] + 'px' : null,
            height: (d:prov.IFrameStateAnnotation) => d.size ? d.size[1] + 'px' : null
          });
        }));
      //rotate
      $frames_enter.append('button').attr('tabindex', -1).attr('class', 'btn btn-default fa fa-rotate-right').call(d3.behavior.drag()
        .origin(() => ({x : 0, y: 0}))
        .on('drag', function (d:prov.IFrameStateAnnotation, i) {
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
            d3.select(this.parentNode).style('transform', updateTransform);
          }
        }));

    }, $anns_enter.filter((d) => d.type === 'frame'));

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
        var $buttons = this.$main.append('div').attr('class', 'btn-group add-text-annotation').html(`
          <button type="button" class="btn btn-default dropdown-toggle fa fa-plus-square" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"></button>
          <ul class="dropdown-menu">
            <li><a href="#" id="clue_add_text"><i class="fa fa-font fa-fw"></i> Text</a></li>
            <li><a href="#" id="clue_add_arrow"><i class="fa fa-arrow-right fa-fw"></i> Arrow</a></li>
            <li><a href="#" id="clue_add_frame"><i class="fa fa-square-o fa-fw"></i> Frame</a></li>
          </ul>`);
        $buttons.select('#clue_add_text').on('click', () => {
          state.pushAnnotation({
            type: 'text',
            pos: [100, 100],
            text: ''
          });
          this.renderAnnotationsImpl(state);
          d3.event.preventDefault();
        });
        $buttons.select('#clue_add_arrow').on('click', () => {
          state.pushAnnotation({
            type: 'arrow',
            pos: [100, 100],
            at: [200,200]
          });
          this.renderAnnotationsImpl(state);
          d3.event.preventDefault();
        });
        $buttons.select('#clue_add_frame').on('click', () => {
          state.pushAnnotation({
            type: 'frame',
            pos: [100, 100],
            size: [200,200]
          });
          this.renderAnnotationsImpl(state);
          d3.event.preventDefault();
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
      const $div = this.$main.selectAll('div.annotation, div.text-overlay, div.add-text-annotation');
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
