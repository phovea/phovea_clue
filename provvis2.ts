/**
 * Created by sam on 09.02.2015.
 */
/// <reference path="../../tsd.d.ts" />

import C = require('../caleydo_core/main');
import ranges = require('../caleydo_core/range');
import idtypes = require('../caleydo_core/idtype');
import provenance = require('../caleydo_provenance/main');
import cmode = require('../caleydo_provenance/mode');
import d3 = require('d3');
import vis = require('../caleydo_core/vis');


class StateRepr {
  doi: number;
  xy: [number, number] = [0,0];

  selected = false;
  parent: StateRepr = null;
  children: StateRepr[] = [];

  a : provenance.ActionNode = null;

  constructor(public s: provenance.StateNode) {
    this.doi = 0.1;
    this.a = s.creator;
  }

  build(lookup: { [id:number] :StateRepr }, line: StateRepr[]) {
    const p = this.s.previousState;
    if (p) {
      this.parent = lookup[p.id];
      if (line.indexOf(this) >= 0) {
        //ensure first
        this.parent.children.unshift(this);
      } else {
        this.parent.children.push(this);
      }
    }
  }

  get flatChildren() {
    var r = this.children.slice();
    this.children.forEach((c) => r.push.apply(r, c.flatChildren));
    return r;
  }

  get cx() {
    return this.xy[0] + this.size[0]*0.5;
  }

  get cy() {
    return this.xy[1] + this.size[1]*0.5;
  }

  get size() {
    if (this.doi === 1.0) {
      return [50,50];
    } else if (this.doi >= 0.8) {
      return [50, 50];
    } else if (this.doi >= 0.5) {
      return [20,20];
    } else {
      return  [16,16];
    }
  }

  static toRepr(graph : provenance.ProvenanceGraph) {
    //assign doi
    const maxDoI = 1;
    const lookup : any = {};
    const states = graph.states.map((s) => {
      var r = new StateRepr(s);
      lookup[s.id] = r;
      return r;
    });

    //mark selected
    const selected = graph.act;
    lookup[selected.id].selected = true;

    //route to path = 1
    const line = selected.path.map((p) => {
      const r = lookup[p.id];
      r.doi = maxDoI;
      return r;
    });
    //build tree
    states.forEach((s) => s.build(lookup, line));

    this.layout(states, line);

    return states;
  }

  private static layout(states: StateRepr[], line: StateRepr[]) {
    //horizontally align the line
    var byLevel : StateRepr[][] = [];
    const root = states.filter((s) => s.parent === null)[0];
    byLevel.push([root]);
    byLevel.push(root.children.slice());

    while(byLevel[byLevel.length-1].length > 0) {
      byLevel.push([].concat.apply([],byLevel[byLevel.length - 1].map((c) => c.children.slice())));
    }
    byLevel.forEach((level,i) => {
      if (i < line.length) {
        //resort such that the element will be at the first place
        level.splice(level.indexOf(line[i]),1);
        level.unshift(line[i]);
      }
    });

    var changed = false, loop = 0;
   do {
      changed = false;
     loop++;

      byLevel.forEach((level, i) => {
        //ensure that my children have at least a >= index than me
        for (let j = 0; j < level.length; ++j) {
          let s = level[j];
          if (s) {
            s.xy = [j,i];
            if (s.children.length > 0) {
              var start = byLevel[i+1].indexOf(s.children[0]);
              changed = changed || start !== j;
              if(start < j) {
                byLevel[i+1].splice.apply(byLevel[i+1],[start,0].concat(d3.range(j-start).map((d) => null)));
              } else if (j < start && j > 0) {
                level.splice.apply(level,[j,0].concat(d3.range(start-j).map((d) => null)));
                s.xy[0] = start;
                j = start;
              }
            }
          }
        }
      });

    } while (changed && loop < 5 );



    //we have a bread first with the line at the first position

    //align all columns by their max width
    const colwidths = [], rowheights = [];
    states.forEach((s) => {
      colwidths[s.xy[0]] = Math.max(colwidths[s.xy[0]] || 0, s.size[0]);
      rowheights[s.xy[1]] = Math.max(rowheights[s.xy[1]] || 0, s.size[1]);
    });

    //convert indices to real positions
    const acccolwidths = colwidths.reduce((arr, b) => {
        arr.push(arr[arr.length - 1] + b);
        return arr;
      }, [0]),
      accrowheights = rowheights.reduce((arr, b) => {
        arr.push(arr[arr.length - 1] + b);
        return arr;
      }, [0]);
    acccolwidths.shift();

    states.forEach((s) => {
      const size = s.size;
      const xy = s.xy;
      const x = acccolwidths[acccolwidths.length-1] -acccolwidths[xy[0]] + (colwidths[xy[0]] - size[0]) * 0.5;
      const y = accrowheights[xy[1]] + (rowheights[xy[1]] - size[1]) * 0.5;
      s.xy = [x,y];
    });
  }

  static toIcon(repr: StateRepr) {
    if (!repr.a) {
      return `<i class="fa fa-circle" title="${repr.s.name}"></i>`;
    }
    const meta = repr.a.meta;
    const cat_icons = {
      visual: 'bar-chart',
      data: 'database',
      logic: 'gear',
      layout: 'desktop',
      selection: 'pencil-square',
      annotation: 'sticky-note'
    };
    const type_icons = {
      create: 'plus',
      update: 'refresh',
      remove: 'remove'
    };
    return `<span title="${meta.name} @ ${meta.timestamp} (${meta.user})"><i class="fa fa-${cat_icons[meta.category]}"></i><i class="super fa fa-${type_icons[meta.operation]}"></i></span>`;
  }

  static render($elem: d3.Selection<StateRepr>) {
    $elem
      .classed('small', (d) => d.doi < 0.5)
      .classed('round', (d) => d.doi <= 0.8)
      .classed('full', (d) => d.doi >= 1)
      .classed('select-selected', (d) => d.selected)
      .classed('starred', (d) => d.s.getAttr('starred', false));
    $elem.select('span.icon').html(StateRepr.toIcon);
    $elem.select('span.slabel').text((d) => d.a ? d.a.name : d.s.name);
    $elem.select('div.sthumbnail')
      .style('background-image', (d) => d.doi >= 1.0 ? (d.s.hasAttr('thumbnail') ?  `url(${d.s.getAttr('thumbnail')})` : 'url(/assets/caleydo_c_gray.svg)') : null);
    $elem.select('span.star')
      .classed('fa-bookmark-o', (d) => !d.s.getAttr('starred',false))
      .classed('fa-bookmark', (d) => d.s.getAttr('starred',false));
    $elem.transition().style({
      left: (d) => d.xy[0]+'px',
      top: (d) => d.xy[1]+'px'
    });
  }
}

export class LayoutedProvVis extends vis.AVisInstance implements vis.IVisInstance {
  private $node:d3.Selection<any>;
  private trigger = C.bind(this.update, this);
  private triggerStoryHighlight = C.bind(this.updateStoryHighlight, this);
  private onStateAdded = (event:any, state:provenance.StateNode) => {
    state.on('attr-thumbnail', this.trigger);
  };
  private onSelectionChanged = (event: any, type: string, act: ranges.Range) => {
    const selectedStates = act.dim(<number>provenance.ProvenanceGraphDim.State).filter(this.data.states);
    this.$node.selectAll('div.state').classed('select-'+type,(d: StateRepr) => selectedStates.indexOf(d.s) >= 0);
  };

  private line = d3.svg.line<{ cx: number; cy : number}>().interpolate('step-after').x((d) => d.cx).y((d) => d.cy);

  private dim : [number, number] = [200, 100];

  constructor(public data:provenance.ProvenanceGraph, public parent:Element, private options:any) {
    super();
    this.options = C.mixin({}, options);
    this.options.scale = [1, 1];
    this.options.rotate = 0;
    this.$node = this.build(d3.select(parent));
    C.onDOMNodeRemoved(this.node, this.destroy, this);

    this.bind();
    this.update();
  }

  private bind() {
    this.data.on('switch_state,clear', this.trigger);
    this.data.on('add_story,move_story,remove_story', this.triggerStoryHighlight);
    this.data.on('add_state', this.onStateAdded);
    this.data.on('select', this.onSelectionChanged);
    this.data.states.forEach((s) => {
      s.on('setAttr', this.trigger);
    });
    cmode.on('modeChanged', this.trigger);
  }

  destroy() {
    super.destroy();
    this.data.off('switch_state,clear', this.trigger);
    this.data.off('add_story,move_story,remove_story', this.triggerStoryHighlight);
    this.data.off('add_state', this.onStateAdded);
    this.data.off('select', this.onSelectionChanged);
    this.data.states.forEach((s) => {
      s.off('setAttr', this.trigger);
    });
    cmode.off('modeChanged', this.trigger);
  }

  get rawSize():[number, number] {
    return this.dim;
  }

  get node() {
    return <Element>this.$node.node();
  }

  option(name:string, val?:any) {
    if (arguments.length === 1) {
      return this.options[name];
    } else {
      this.fire('option.' + name, val, this.options[name]);
      this.options[name] = val;

    }
  }

  locateImpl(range:ranges.Range) {
    return Promise.resolve(null);
  }

  private build($parent:d3.Selection<any>) {
    //  scale = this.options.scale;
    var $parent = $parent.append('div').attr({
      'class': 'provenance-layout-vis'
    }).style('transform', 'rotate(' + this.options.rotate + 'deg)');

    var $svg = $parent.append('svg');
    $svg.append('g').attr('transform','translate(1,1)').classed('storyhighlights', true);
    $svg.append('g').attr('transform','translate(1,1)').classed('edges', true);
    $parent.append('div');

    return $parent;
  }

  private onStateClick(d: StateRepr) {
    d3.event.stopPropagation();
    this.data.selectState(d.s, idtypes.toSelectOperation(d3.event));
    this.data.jumpTo(d.s);
  }

  update() {
    const that = this;
    const graph = this.data;

    const states = StateRepr.toRepr(graph);
    const $states = this.$node.select('div').selectAll('div.state').data(states, (d) => ''+d.s.id);
    const $states_enter = $states.enter().append('div')
      .classed('state', true)
      .attr('data-id', (d) => d.s.id)
      .on('click', this.onStateClick.bind(this))
      .on('mouseenter', (d) => graph.selectState(d.s, idtypes.SelectOperation.SET, idtypes.hoverSelectionType))
      .on('mouseleave', (d) => graph.selectState(d.s, idtypes.SelectOperation.REMOVE, idtypes.hoverSelectionType))
      .attr('draggable',true)
      .on('dragstart', (d) => {
        const e = <DragEvent>(<any>d3.event);
        e.dataTransfer.effectAllowed = 'copy'; //none, copy, copyLink, copyMove, link, linkMove, move, all
        e.dataTransfer.setData('text/plain', d.s.name);
        e.dataTransfer.setData('application/caleydo-prov-state',String(d.s.id));
      })
      .on('dragenter', function () {
        if (C.hasDnDType(d3.event, 'application/caleydo-prov-state')) {
          d3.select(this).classed('hover', true);
          return false;
        }
      }).on('dragover', () => {
        if (C.hasDnDType(d3.event, 'application/caleydo-prov-state')) {
          d3.event.preventDefault();
          C.updateDropEffect(d3.event);
          return false;
        }
      }).on('dragleave', function () {
        d3.select(this).classed('hover', false);
      }).on('drop', function (d) {
        d3.select(this).classed('hover', false);
        var e = <DragEvent>(<any>d3.event);
        e.preventDefault();
        const state = that.data.getStateById(parseInt(e.dataTransfer.getData('application/caleydo-prov-state'),10));
        that.data.fork(state, d.s);
        return false;
    });


    $states_enter.append('div').classed('sthumbnail', true);
    $states_enter.append('span').classed('icon', true);
    $states_enter.append('span').attr('class','star fa').on('click', (d) => {
      d.s.setAttr('starred',!d.s.getAttr('starred',false));
      d3.event.stopPropagation();
      d3.event.preventDefault();
    });
    $states_enter.append('span').classed('slabel',true).on('click', (d) => {
      d.s.name = prompt('Comment', d.s.name);
      d3.event.stopPropagation();
      d3.event.preventDefault();
    });

    $states.call(StateRepr.render);

    $states.exit().remove();

    var edges = [];
    states.forEach((s) => {
      edges.push.apply(edges, s.children.map((c) => ({s : s, t : c})));
    });

    this.dim = [
      d3.max(states, (s) => s.xy[0]+s.size[0]) + 200, //for label
      d3.max(states, (s) => s.xy[1]+s.size[1])
    ];

    this.$node.select('svg')
      .attr('width', this.dim[0])
      .attr('height', this.dim[1]);

    const $edges = this.$node.select('svg g.edges').selectAll('path').data(edges, (d) => d.s.s.id+'-'+d.t.s.id);
    $edges.enter().append('path');
    $edges.transition().attr('d', (d) => this.line([d.s, d.t]));

    this.updateStoryHighlight();
  }

  private updateStoryHighlight() {
    //TODO hide if not needed
    const $g = this.$node.select('svg g.storyhighlights');
    const states = this.$node.select('div').selectAll<StateRepr>('div.state').data();
    const lookup : any = {};
    states.forEach((s) => lookup[s.s.id] = s);
    const areas = this.data.getStories().map((story) => {
      const reprs = story.map((s) => s.state ? lookup[s.state.id] : null).filter((d) => !!d);
      var r= [];
      reprs.forEach((repr) => {
        var xy = repr.xy,
          size = repr.size;
        r.push({ x0: xy[0], y0: xy[1]-2, x1: xy[0]+size[0], y1: xy[1]-2});
        r.push({ x0: xy[0], y0: xy[1]+size[1]+2, x1: xy[0]+size[0], y1: xy[1]+size[1]+2});
      });
      return r;
    });
    const $areas = $g.selectAll('path.story').data(areas);
    $areas.enter().append('path').classed('story', true);
    const area = d3.svg.area<{ x0: number; y0: number; x1: number, y1: number}>().interpolate('basis')
      .x0((d) => d.x0)
      .x1((d) => d.x1)
      .y0((d) => d.y0)
      .y1((d) => d.y1);
    const colors = d3.scale.category10();
    $areas.transition().attr('d',area).style('fill', (d,i) => colors(String(i)));
    $areas.exit().remove();
  }
}

export function create(data:provenance.ProvenanceGraph, parent:Element, options = {}) {
  return new LayoutedProvVis(data, parent, options);
}
