/**
 * Created by sam on 09.02.2015.
 */
/// <reference path="../../tsd.d.ts" />

import C = require('../caleydo_core/main');
import $ = require('jquery');
import ranges = require('../caleydo_core/range');
import idtypes = require('../caleydo_core/idtype');
import provenance = require('../caleydo_provenance/main');
import cmode = require('../caleydo_provenance/mode');
import dialogs = require('../wrapper_bootstrap_fontawesome/dialogs');
import d3 = require('d3');
import vis = require('../caleydo_core/vis');

import utils = require('./utils');


function extractTags(text: string) {
  const matches = /\S*#(?:\[[^\]]+\]|\S+)/.exec(text);
  if (matches && matches.length > 0) {
    return matches.map((m) => m);
  }
  return [];
}

class StateRepr {
  doi: number;
  xy: [number, number] = [0,0];

  selected = false;
  parent: StateRepr = null;
  children: StateRepr[] = [];

  a : provenance.ActionNode = null;

  constructor(public s: provenance.StateNode, public graph: provenance.ProvenanceGraph) {
    this.doi = 0.1;
    this.a = s.creator;
  }

  get thumbnail() {
    return `url(${utils.thumbnail_url(this.graph, this.s)})`;
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

  get doi_lg() {
    return this.doi >= 0.9;
  }
  get doi_() {
    return this.doi >= 0.7 && this.doi < 0.9;
  }
  get doi_sm() {
    return this.doi >= 0.4 && this.doi < 0.7;
  }
  get doi_xs() {
    return this.doi < 0.4;
  }

  get size() {
    if (this.doi_lg) {
      return [50,50];
    } else if (this.doi_) {
      return [30, 30];
    } else if (this.doi_sm) {
      return [20,20];
    } else {
      return  [10,10];
    }
  }


  static toRepr(graph : provenance.ProvenanceGraph, filter: any) {
    //assign doi
    const lookup : any = {};

    //mark selected
    const selected = graph.act;
    const selected_path = selected.path.reverse();

    const states = graph.states.map((s) => {
      var r = new StateRepr(s, graph);
      var a = s.creator;
      var meta = a ? a.meta : provenance.meta('No','none','none');

      const category = filter.category[meta.category] ? 0 : -1;
      const operation = filter.operation[meta.operation] ? 0 : -1;
      const bookmark = (filter.bookmark ? (s.getAttr('starred', false) ? 2: -2) : 0);
      const tags = (filter.tags.length > 0 ? (s.getAttr('tags', []).some((d) => filter.tags.indexOf(d) >= 0) ? 2: -2) : 0);
      const is_selected = s === selected ? 3: 0;
      const inpath = selected_path.indexOf(s) >= 0 ? Math.max(0,4-selected_path.indexOf(s)) : -2;
      //combine to a doi value
      const sum = 7 + category + operation + bookmark + tags + is_selected + inpath;

      r.doi = d3.round(Math.max(0,Math.min(10,sum))/10,1);
      r.selected = s === selected;

      lookup[s.id] = r;
      return r;
    });

    //route to path = 1
    const line = selected.path.map((p) => lookup[p.id]);
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
      selection: 'pencil-square'
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
      .classed('doi-xs', (d) => d.doi_xs)
      .classed('doi-sm', (d) => d.doi_sm)
      .classed('doi', (d) => d.doi_)
      .classed('doi-lg', (d) => d.doi_lg)
      .classed('select-selected', (d) => d.selected)
      .classed('bookmarked', (d) => d.s.getAttr('starred',false))
      .attr('data-doi',(d) => d.doi);
    $elem.select('span.icon').html(StateRepr.toIcon);
    $elem.select('span.slabel').text((d) => d.a ? d.a.name : d.s.name);
    $elem.select('div.sthumbnail')
      .style('background-image', (d) => d.doi_lg ? d.thumbnail : null);
    $elem.transition().style({
      left: (d) => d.xy[0]+'px',
      top: (d) => d.xy[1]+'px'
    });
  }

  static popover = {
      trigger: 'manual',
      placement: 'left',
      delay: 300,
      title: function () {
        const d : StateRepr = d3.select(this).datum();
        const icon = StateRepr.toIcon(d);
        const title = d.a ? d.a.name : d.s.name;
        return `<span class="icon">${icon}</span>${title}`;
      },
      html: true,
      content: function () {
        const d : StateRepr = d3.select(this).datum();
        const thumbnail = utils.thumbnail_url(d.graph, d.s);
        const notes = d.s.getAttr('note', '');
        const starred = d.s.getAttr('starred', false);
        const content = $(`
        <div class="preview">
          <span class="star fa fa-${starred ? 'bookmark-o' : 'bookmark-o'}" title="bookmark this state for latter use"></span>
          <img src="${thumbnail}">
          <textarea placeholder="place for notes...">${notes}</textarea>
        </div>`);
        content.find('span.star').on('click', function() {
          d.s.setAttr('starred',!d.s.getAttr('starred',false));
          $(this).toggleClass('fa-bookmark-o').toggleClass('fa-bookmark');
          return false;
        });
        content.find('textarea').on('change', function() {
          const val = this.value;
          d.s.setAttr('tags', extractTags(val));
          d.s.setAttr('note', val);
          return false;
        }).on('click', function(event) {
          event.stopPropagation();
        });
        return content;
      }
    };
}

export class LayoutedProvVis extends vis.AVisInstance implements vis.IVisInstance {
  private $node:d3.Selection<any>;
  private trigger = C.bind(this.update, this);
  private triggerStoryHighlight = C.bind(this.updateStoryHighlight, this);
  private onStateAdded = (event:any, state:provenance.StateNode) => {
    state.on('setAttr', this.trigger);
  };
  private onSelectionChanged = (event: any, type: string, act: ranges.Range) => {
    const selectedStates = act.dim(<number>provenance.ProvenanceGraphDim.State).filter(this.data.states);
    this.$node.selectAll('div.state').classed('select-'+type,(d: StateRepr) => selectedStates.indexOf(d.s) >= 0);
  };

  private line = d3.svg.line<{ cx: number; cy : number}>().interpolate('step-after').x((d) => d.cx).y((d) => d.cy);

  private dim : [number, number] = [200, 100];

  private filter = {
    category: {
      data: true,
      visual: true,
      selection: true,
      logic: true,
      layout: true,
      none: false
    },
    operation: {
      create: true,
      remove: true,
      update: true,
      none: false
    },
    bookmark: false,
    tags: []
  };

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
    this.data.on('switch_state,forked_branch,clear', this.trigger);
    this.data.on('add_slide,move_slide,remove_slide', this.triggerStoryHighlight);
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
    this.data.off('add_slide,move_slidey,remove_slide', this.triggerStoryHighlight);
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
    var $p = $parent.append('div').attr({
      'class': 'provenance-layout-vis'
    }).style('transform', 'rotate(' + this.options.rotate + 'deg)');

    $p.html(`
      <form class="form-inline toolbar" onsubmit="return false;">
      <div class="btn-group" data-toggle="buttons">
        <label class="btn btn-default btn-xs active" title="data actions">
          <input type="checkbox" autocomplete="off" name="category" value="data" checked="checked"> <i class="fa fa-database"></i>
        </label>
        <label class="btn btn-default btn-xs active" title="visual actions">
          <input type="checkbox" autocomplete="off" name="category" value="visual" checked="checked"> <i class="fa fa-bar-chart"></i>
        </label>
        <label class="btn btn-default btn-xs active" title="selection actions">
          <input type="checkbox" autocomplete="off" name="category" value="selection" checked="checked"> <i class="fa fa-pencil-square"></i>
        </label>
        <label class="btn btn-default btn-xs active" title="layout actions">
          <input type="checkbox" autocomplete="off" name="category" value="layout" checked="checked"> <i class="fa fa-desktop"></i>
        </label>
        <label class="btn btn-default btn-xs active" title="logic actions">
          <input type="checkbox" autocomplete="off" name="category" value="logic" checked="checked"> <i class="fa fa-gear"></i>
        </label>
      </div>

      <div class="btn-group" data-toggle="buttons">
        <label class="btn btn-default btn-xs active" title="create actions">
          <input type="checkbox" autocomplete="off" name="operation" value="create" checked="checked"> <i class="fa fa-plus"></i>
        </label>
        <label class="btn btn-default btn-xs active" title="update actions">
          <input type="checkbox" autocomplete="off" name="operation" value="update" checked="checked"> <i class="fa fa-refresh"></i>
        </label>
        <label class="btn btn-default btn-xs active" title="remove actions">
          <input type="checkbox" autocomplete="off" name="operation" value="remove" checked="checked"> <i class="fa fa-remove"></i>
        </label>
      </div>

      <div class="btn-group" data-toggle="buttons">
        <label class="btn btn-default btn-xs" title="bookmarked actions">
          <input type="checkbox" autocomplete="off" name="bookmark"> <i class="fa fa-bookmark"></i>
        </label>
        <div class="form-group btn-group">
          <div class="btn-group btn-group-xs" role="group">
            <button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown" aria-haspopup="true"
                    aria-expanded="false">
              <i class="fa fa-tags"></i><span class="caret"></span>
            </button>
            <div class="dropdown-menu dropdown-menu-right">
              <div class="input-group input-group-sm">
                <span class="input-group-addon" title="tagged states"><i class="fa fa-tags"></i></span>
                <input name="tags" type="text" class="form-control input-sm" placeholder="tags">
              </div>
            </div>
          </div>
        </div>
       </div>
      </form>
      <div style="position: relative">
        <svg>
          <g transform="translate(1,1)" class="storyhighlights"></g>
          <g transform="translate(1,1)" class="edges"></g>
        </svg>
        <div class="states"></div>
      </div>
    `);

    //init the toolbar filter options
    const jp = $($p.node());
    const that = this;
    //must use bootstrap since they are manually triggered
    jp.find('form.toolbar input').on('change', function() {
      if (this.type==='text') {
        that.filter.tags = this.value.split(' ');
        jp.find('button[data-toggle="dropdown"]').toggleClass('active', that.filter.tags.length > 0);
      } else {
        if (this.name === 'bookmark') {
          that.filter.bookmark = this.checked;
        } else {
          that.filter[this.name][this.value] = this.checked;
        }
      }
      that.update();
    });
    //initialize bootstrap
    (<any>jp.find('.btn-group[data-toggle="buttons"],.btn[data-toggle="button"]')).button();

    return $p;
  }

  private onStateClick(d: StateRepr) {
    d3.event.stopPropagation();
    this.data.selectState(d.s, idtypes.toSelectOperation(d3.event));
    this.data.jumpTo(d.s);
  }

  update() {
    const that = this;
    const graph = this.data;

    const states = StateRepr.toRepr(graph, this.filter);
    const $states = this.$node.select('div.states').selectAll('div.state').data(states, (d) => ''+d.s.id);
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
        that.data.fork(state.creator, d.s);
        return false;
    });


    $states_enter.append('div').classed('sthumbnail', true);
    $states_enter.append('span').classed('icon', true);
    /*$states_enter.append('span').attr('class','star fa').on('click', (d) => {
      d.s.setAttr('starred',!d.s.getAttr('starred',false));
      d3.event.stopPropagation();
      d3.event.preventDefault();
    });
    $states_enter.append('span').attr('class','fa fa-tags').on('click', (d) => {
      var tags = d.s.getAttr('tags',[]).join(' ');
      dialogs.prompt(tags, 'Tags').then((new_) => {
        d.s.setAttr('tags', new_.split(' '));
      });
      d3.event.stopPropagation();
      d3.event.preventDefault();
    });*/
    $states_enter.append('span').classed('slabel',true).on('click', (d) => {
      dialogs.prompt(d.s.name, 'Comment').then((new_) => {
        d.s.name = new_;
      });
      d3.event.stopPropagation();
      d3.event.preventDefault();
    });

    $states.call(StateRepr.render);

    $states.exit().remove();


    //just for the entered ones
    (<any>$($states_enter[0][0]).find('> span.icon')).popover(StateRepr.popover)
      .parent().on({
        mouseenter: function () {
          var $icon = $(this).find('> span.icon');
          $icon.addClass('popping');
          $icon.data('popup', setTimeout(function () {
            (<any>$icon).popover('show');
          }, 200));
        },
        mouseleave: function () {
          var $icon = $(this).find('> span.icon');
          const id = +$icon.data('popoup');
          clearTimeout(id);
          $icon.removeData('popup');
          const d:StateRepr = d3.select(this).datum();
          if (d && $icon.has('textarea')) {
            const val = $(this).find('textarea').val();
            d.s.setAttr('tags', extractTags(val));
            d.s.setAttr('note', val);
          }
          (<any>$icon).popover('hide');
        }
      });

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
    const areas = this.data.getSlides().map((story) => {
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
