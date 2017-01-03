/**
 * Created by sam on 09.02.2015.
 */


import * as C from 'phovea_core/src/index';
import * as $ from 'jquery';
import * as ranges from 'phovea_core/src/range';
import * as idtypes from 'phovea_core/src/idtype';
import * as provenance from 'phovea_core/src/provenance';
import * as cmode from './mode';
import * as dialogs from 'phovea_ui/src/dialogs';
import * as d3 from 'd3';
import * as vis from 'phovea_core/src/vis';

import * as utils from './utils';


function extractTags(text: string) {
  var regex = /(?:^|\s)(?:#)([a-zA-Z\d]+)/gm;
  var match;
  const matches = [];
  while (match = regex.exec(text)) {
    matches.push(match[1]);
  }
  return matches;
}

enum LevelOfDetail {
  ExtraSmall = 0,
  Small = 1,
  Medium = 2,
  Large = 3
}

const DOI_LARGE = 0.9;
const DOI_MEDIUM = 0.7;
const DOI_SMALL = 0.4;

function getLevelOfDetail() {
  const mode = cmode.getMode();
  //if (mode.exploration >= 0.8) {
  //  return LevelOfDetail.Small;
  //}
  if (mode.presentation > 0.3) {
    return LevelOfDetail.ExtraSmall;
  }
  if (mode.authoring >= 0.8) {
    return LevelOfDetail.Large;
  }
  return LevelOfDetail.Medium;
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
    return this.xy[0] + 2;
  }

  get cy() {
    return this.xy[1] + 13;
  }

  get lod_local() {
    if (this.doi >= DOI_LARGE) {
      return LevelOfDetail.Large;
    }
    if (this.doi >= DOI_MEDIUM) {
      return LevelOfDetail.Medium;
    }
    if (this.doi >= DOI_SMALL) {
      return LevelOfDetail.Small;
    }
    return LevelOfDetail.ExtraSmall;
  }

  get lod() {
    const global = getLevelOfDetail();
    const local = this.lod_local;
    return global < local ? global: local;
  }

  get size() {
    switch (this.lod) {
      case LevelOfDetail.Large:
        return [50, 40];
      case LevelOfDetail.Medium:
        return [30, 18];
      case LevelOfDetail.Small:
        return [30, 18];
      default:
        return [10, 7];
    }
  }

  get name() {
    return this.s.name;
  }


  static toRepr(graph : provenance.ProvenanceGraph, highlight: any, options : any = {}) {
    //assign doi
    const lookup : any = {};

    //mark selected
    const selected = graph.act;
    const selected_path = selected.path.reverse();

    const lod = getLevelOfDetail();

    const size = graph.states.length;

    const toState = (s) => {
      var r = new StateRepr(s, graph);
      var a = s.creator;
      var meta = a ? a.meta : provenance.meta('No','none','none');

      const category = highlight.category[meta.category] ? 1 : 0;
      const operation = highlight.operation[meta.operation] ? 1 : 0;
      const bookmark = (s.getAttr('starred', false) ? 1: 0);
      const tags = (highlight.tags.length > 0 ? (s.getAttr('tags', []).some((d) => highlight.tags.indexOf(d) >= 0) ? 1: 0) : 0);
      const is_selected = s === selected ? 3: 0;
      const inpath = selected_path.indexOf(s) >= 0 ? Math.max(-2.5,6-selected_path.indexOf(s)) : -2.5;

      const sizePenality = Math.max(-1, -size/10);
      //combine to a doi value
      const sum = 6 + is_selected + inpath + sizePenality;
      r.doi = d3.round(Math.max(0,Math.min(10,sum))/10,1);

      if ((category + operation + bookmark + tags) > 0) {
        //boost to next level if any of the filters apply
        r.doi = Math.max(r.doi, DOI_SMALL);
      }

      if (!utils.areThumbnailsAvailable(graph) || options.thumbnails === false) {
        r.doi = Math.min(r.doi, DOI_LARGE-0.01); //border for switching to thumbnails
      }
      r.selected = s === selected;

      lookup[s.id] = r;
      return r;
    };
    const states = (lod < LevelOfDetail.Medium ? selected_path : graph.states).map(toState);

    //route to path = 1
    const line = selected.path.map((p) => lookup[p.id]);
    //build tree
    states.forEach((s) => s.build(lookup, line));

    this.layout(states, line);

    //boost all on the right side if they are small to medium


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

    byLevel = byLevel.filter((d) => d.length > 0);
    //boost all states that are on the left side to medium if they are small
    byLevel.forEach((level) => {
      let s = level[0];
      if (s && s.lod === LevelOfDetail.Small) {
        s.doi = 0.8; //boost to medium
      }
    });



    //we have a bread first with the line at the first position

    //align all columns by their max width
    const colwidths = [], rowheights = [];
    states.forEach((s) => {
      colwidths[s.xy[0]] = Math.max(colwidths[s.xy[0]] || 0, s.size[0]);
      rowheights[s.xy[1]] = Math.max(rowheights[s.xy[1]] || 0, s.size[1]);
    });

    //convert indices to real positions
    const acccolwidths = colwidths.reduce((arr, b, i) => {
        arr[i+1] = arr[arr.length - 1] + b;
        return arr;
      }, [0]),
      accrowheights = rowheights.reduce((arr, b, i) => {
        arr[i+1] = arr[arr.length - 1] + b;
        return arr;
      }, [0]);
    acccolwidths.shift();

    states.forEach((s) => {
      const xy = s.xy;
      const x = acccolwidths[acccolwidths.length-1] -acccolwidths[xy[0]] + 5; // + (colwidths[xy[0]]);
      const y = accrowheights[xy[1]];
      s.xy = [x,y];
    });
  }

  static toIcon(repr: StateRepr) {
    if (!repr.a) {
      return ''; //`<i class="fa fa-circle" title="${repr.s.name}"></i>`;
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
      .classed('doi-xs', (d) => d.lod === LevelOfDetail.ExtraSmall)
      .classed('doi-sm', (d) => d.lod === LevelOfDetail.Small)
      .classed('doi', (d) => d.lod === LevelOfDetail.Medium)
      .classed('doi-lg', (d) => d.lod === LevelOfDetail.Large)
      .classed('phovea-select-selected', (d) => d.selected)
      .classed('bookmarked', (d) => d.s.getAttr('starred',false))
      .attr('data-doi',(d) => d.doi)
      .attr('title', (d) => d.name);

    $elem.select('span.icon').html(StateRepr.toIcon);
    $elem.select('span.slabel').text((d) => d.name);
    $elem.select('i.bookmark')
      .classed('fa-bookmark-o',(d) => !d.s.getAttr('starred', false))
      .classed('fa-bookmark',(d) => d.s.getAttr('starred', false));

    $elem.select('div.sthumbnail')
      .style('background-image', (d) => d.lod === LevelOfDetail.Large ? d.thumbnail : null);
    $elem.transition().style({
      'padding-left': (d) => (d.xy[0]+4)+'px',
      top: (d) => d.xy[1]+'px'
    });
  }

  showDialog() {
    const d = this;
    const icon = StateRepr.toIcon(d);
    const title = d.s.name;
      const dia = dialogs.generateDialog(`<span class="icon">${icon}</span>${title}`);

    const thumbnail = utils.thumbnail_url(d.graph, d.s, { width: 512, format: 'png' });
    const notes = d.s.getAttr('note', '');
    const starred = d.s.getAttr('starred', false);
    const $body = d3.select(dia.body);
    $body.html(`
    <form class="state_info" onsubmit="return false">
      <span class="star fa fa-${starred ? 'bookmark-o' : 'bookmark-o'}" title="bookmark this state for latter use"></span>
      <div class="img"><img src="${thumbnail}"></div>
      <div class="form-group">
        <label>Name</label>
        <input type="text" class="form-control" placeholder="name" value="${title}">
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="form-control" placeholder="place for notes... (#tags will be automatically extracted)">${notes}</textarea>
      </div>
      <div class="form-group">
        <label>Extracted Tags</label>
        <input type="text" class="form-control readonly" readonly="readonly" value="${extractTags(notes).join(' ')}">
      </div>
    </form>`);
    $body.select('span.star').on('click', function() {
      d.s.setAttr('starred',!d.s.getAttr('starred',false));
      $(this).toggleClass('fa-bookmark-o').toggleClass('fa-bookmark');
      return false;
    });
    $body.select('textarea').on('input', function() {
      $body.select('input.readonly').property('value', extractTags(this.value).join(' '));
    });

    dia.onHide(() => {
      const name = $body.select('input').property('value');
      d.s.name = name;
      const val =  $body.select('textarea').property('value');
      d.s.setAttr('tags', extractTags(val));
      d.s.setAttr('note', val);
    });
    dia.show();
  }
}

export class LayoutedProvVis extends vis.AVisInstance implements vis.IVisInstance {
  private $node:d3.Selection<any>;
  private trigger = C.bind(this.update, this);
  private triggerStoryHighlight = C.bind(this.updateStoryHighlight, this);
  private onStateAdded = (event:any, state:provenance.StateNode) => {
    state.on('setAttr', this.trigger);
  };
  private onSelectionChanged = (event: any, type: string, act: ranges.Range) => {
    const selectedStates = this.data.selectedStates(type);
    this.$node.selectAll('div.state').classed('phovea-select-'+type, function (d: StateRepr) {
      const isSelected = selectedStates.indexOf(d.s) >= 0;
      if (isSelected && type === idtypes.defaultSelectionType) {
        this.scrollIntoView();
      }
      return isSelected;
    });
  };

  private line = d3.svg.line<{ cx: number; cy : number}>().interpolate('step-after').x((d) => d.cx).y((d) => d.cy);

  private dim : [number, number] = [200, 100];

  private highlight = {
    category: {
      data: false,
      visual: false,
      selection: false,
      logic: false,
      layout: false,
      none: false
    },
    operation: {
      create: false,
      remove: false,
      update: false,
      none: false
    },
    tags: []
  };

  constructor(public data:provenance.ProvenanceGraph, public parent:Element, private options:any) {
    super();
    this.options = C.mixin({
      thumbnails: true,
      provVisCollapsed: false
    }, options);
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
    var $p = $parent.append('aside')
      .classed('provenance-layout-vis', true)
      .classed('collapsed', this.options.provVisCollapsed)
      .style('transform', 'rotate(' + this.options.rotate + 'deg)');

    $p.html(`
      <a href="#" class="btn-collapse"><i class="fa ${(this.options.provVisCollapsed) ? 'fa-arrow-circle-o-left' : 'fa-arrow-circle-o-right'}"></i></a>
      <div>
        <h2>
          <i class="fa fa-code-fork fa-rotate-180"></i> Provenance
          <a href="#" class="btn-filter"><i class="fa fa-filter"></i></a>
        </h2>
        <form class="form-inline toolbar" style="display:none" onsubmit="return false;">
        <div class="btn-group" data-toggle="buttons">
          <label class="btn btn-default btn-xs" title="data actions">
            <input type="checkbox" autocomplete="off" name="category" value="data" > <i class="fa fa-database"></i>
          </label>
          <label class="btn btn-default btn-xs" title="visual actions">
            <input type="checkbox" autocomplete="off" name="category" value="visual"> <i class="fa fa-bar-chart"></i>
          </label>
          <label class="btn btn-default btn-xs" title="selection actions">
            <input type="checkbox" autocomplete="off" name="category" value="selection"> <i class="fa fa-pencil-square"></i>
          </label>
          <label class="btn btn-default btn-xs" title="layout actions">
            <input type="checkbox" autocomplete="off" name="category" value="layout"> <i class="fa fa-desktop"></i>
          </label>
          <label class="btn btn-default btn-xs" title="logic actions">
            <input type="checkbox" autocomplete="off" name="category" value="logic"> <i class="fa fa-gear"></i>
          </label>
        </div>

        <div class="btn-group" data-toggle="buttons">
          <label class="btn btn-default btn-xs" title="create actions">
            <input type="checkbox" autocomplete="off" name="operation" value="create"> <i class="fa fa-plus"></i>
          </label>
          <label class="btn btn-default btn-xs" title="update actions">
            <input type="checkbox" autocomplete="off" name="operation" value="update"> <i class="fa fa-refresh"></i>
          </label>
          <label class="btn btn-default btn-xs" title="remove actions">
            <input type="checkbox" autocomplete="off" name="operation" value="remove"> <i class="fa fa-remove"></i>
          </label>
        </div>

        <div class="btn-group" data-toggle="buttons">
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
      </div>
      <div style="position: relative">
        <svg>
          <g transform="translate(1,1)" class="edges"></g>
          <g transform="translate(1,1)" class="storyhighlights" style="display:none">
            <path class="story"></path>
          </g>
        </svg>
        <div class="states"></div>
      </div>
      <div class="legend">
        <div class="btn-group-vertical" data-toggle="buttons">
          <label class="btn btn-default btn-xs" title="data actions">
            <input type="checkbox" autocomplete="off" name="category" value="data"> <i class="fa fa-database"></i> Data
          </label>
          <label class="btn btn-default btn-xs" title="visual actions">
            <input type="checkbox" autocomplete="off" name="category" value="visual"> <i class="fa fa-bar-chart"></i> Visual
          </label>
          <label class="btn btn-default btn-xs" title="selection actions">
            <input type="checkbox" autocomplete="off" name="category" value="selection" > <i class="fa fa-pencil-square"></i> Selections
          </label>
          <label class="btn btn-default btn-xs" title="layout actions">
            <input type="checkbox" autocomplete="off" name="category" value="layout"> <i class="fa fa-desktop"></i> Layout
          </label>
          <label class="btn btn-default btn-xs" title="logic actions">
            <input type="checkbox" autocomplete="off" name="category" value="logic"> <i class="fa fa-gear"></i> Analysis
          </label>
        </div>
      </div>
    `);

    //init the toolbar filter options
    const jp = $($p.node());
    const that = this;
    //must use bootstrap since they are manually triggered
    jp.find('form.toolbar input, .legend input').on('change', function() {
      if (this.type==='text') {
        that.highlight.tags = this.value.split(' ');
        jp.find('button[data-toggle="dropdown"]').toggleClass('active', that.highlight.tags.length > 0);
      } else {
        that.highlight[this.name][this.value] = this.checked;
      }
      that.update();
    });
    //initialize bootstrap
    (<any>jp.find('*[data-toggle="buttons"],.btn[data-toggle="button"]')).button();

    jp.find('.btn-filter').on('click', () => {
      jp.find('form.toolbar').toggle('fast');
      return false;
    });

    jp.find('.btn-collapse').on('click', (evt) => {
      evt.preventDefault();
      $p.select('.btn-collapse > i').classed('fa-arrow-circle-o-right', $p.classed('collapsed')).classed('fa-arrow-circle-o-left', !$p.classed('collapsed'));
      $p.classed('collapsed', !$p.classed('collapsed'));
    });

    return $p;
  }

  private onStateClick(d: StateRepr) {
    (<Event>d3.event).stopPropagation();
    this.data.selectState(d.s, idtypes.toSelectOperation(d3.event));
    this.data.jumpTo(d.s);
  }

  update() {
    const that = this;
    const graph = this.data;

    const lod = getLevelOfDetail();
    this.$node.classed('large', lod  === LevelOfDetail.Large);
    this.$node.classed('medium', lod  === LevelOfDetail.Medium);
    this.$node.classed('small', lod  === LevelOfDetail.Small);
    this.$node.classed('xsmall', lod  === LevelOfDetail.ExtraSmall);

    const states = StateRepr.toRepr(graph, this.highlight, { thumbnails: this.options.thumbnails });
    const $states = this.$node.select('div.states').selectAll('div.state').data(states, (d) => ''+d.s.id);
    const $states_enter = $states.enter().append('div')
      .classed('state', true)
      .attr('data-id', (d) => d.s.id)
      .append('div')
      .on('click', this.onStateClick.bind(this))
      .on('mouseenter', (d) => {
        graph.selectState(d.s, idtypes.SelectOperation.SET, idtypes.hoverSelectionType);
      })
      .on('mouseleave', (d) => {
        graph.selectState(d.s, idtypes.SelectOperation.REMOVE, idtypes.hoverSelectionType);
      })
      .attr('draggable',true)
      .on('dragstart', (d) => {
        const e = <DragEvent>(<any>d3.event);
        e.dataTransfer.effectAllowed = 'copy'; //none, copy, copyLink, copyMove, link, linkMove, move, all
        e.dataTransfer.setData('text/plain', d.s.name);
        e.dataTransfer.setData('application/phovea-prov-state',String(d.s.id));
      })
      .on('dragenter', function () {
        if (C.hasDnDType(d3.event, 'application/phovea-prov-state')) {
          d3.select(this).classed('hover', true);
          return false;
        }
      }).on('dragover', () => {
        if (C.hasDnDType(d3.event, 'application/phovea-prov-state')) {
          (<Event>d3.event).preventDefault();
          C.updateDropEffect(d3.event);
          return false;
        }
      }).on('dragleave', function () {
        d3.select(this).classed('hover', false);
      }).on('drop', function (d) {
        d3.select(this).classed('hover', false);
        var e = <DragEvent>(<any>d3.event);
        e.preventDefault();
        const state = that.data.getStateById(parseInt(e.dataTransfer.getData('application/phovea-prov-state'),10));
        that.data.fork(state.creator, d.s);
        return false;
    });


    const $inner = $states_enter;
    $inner.append('i').attr('class', 'fa fa-circle glyph');
    $inner.append('span').classed('icon', true);
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
    $inner.append('span').classed('slabel',true);
    $inner.append('div').classed('sthumbnail', true);
    const $toolbar_enter = $states_enter.append('div').classed('toolbar', true);
    $toolbar_enter.append('i').attr('class', 'fa bookmark fa-bookmark-o').on('click', function(d) {
      const v = !d.s.getAttr('starred',false);
      let e = <Event>d3.event;
      d.s.setAttr('starred', v);
      d3.select(this).classed('fa-bookmark', v).classed('fa-bookmark-o', !v);
      e.stopPropagation();
      e.preventDefault();
    });
    $toolbar_enter.append('i').attr('class', 'fa fa-edit').on('click', (d) => {
      let e = <Event>d3.event;
      d.showDialog();
      e.stopPropagation();
      e.preventDefault();
    });

    $states.call(StateRepr.render);

    $states.exit().remove();


    //just for the entered ones
    //(<any>$($states_enter[0][0]).find('> span.icon')).popover(StateRepr.popover)
    //  .parent().on({
    //    mouseenter: function () {
    //      var $icon = $(this).find('> span.icon');
    //      $icon.addClass('popping');
    //      $icon.data('popup', setTimeout(function () {
    //        (<any>$icon).popover('show');
    //      }, 200));
    //    },
    //    mouseleave: function () {
    //      var $icon = $(this).find('> span.icon');
    //      const id = +$icon.data('popoup');
    //      clearTimeout(id);
    //      $icon.removeData('popup');
    //      const d:StateRepr = d3.select(this).datum();
    //      if (d && $icon.has('textarea')) {
    //        const val = $(this).find('textarea').val();
    //        d.s.setAttr('tags', extractTags(val));
    //        d.s.setAttr('note', val);
    //      }
    //      (<any>$icon).popover('hide');
    //    }
    //  });

    var edges = [];
    states.forEach((s) => {
      edges.push.apply(edges, s.children.map((c) => ({s : s, t : c})));
    });

    this.dim = [
      d3.max(states, (s) => s.xy[0]+s.size[0]) + (lod >= LevelOfDetail.Medium ? 200 : 0), //for label
      d3.max(states, (s) => s.xy[1]+s.size[1])
    ];

    this.$node.select('svg')
      .attr('width', this.dim[0])
      .attr('height', this.dim[1]);

    const $edges = this.$node.select('svg g.edges').selectAll('path').data(edges, (d) => d.s.s.id+'-'+d.t.s.id);
    $edges.enter().append('path');
    $edges.transition().attr('d', (d) => this.line([d.s, d.t]));
    $edges.exit().remove();

    this.updateStoryHighlight();
  }

  private updateStoryHighlight() {
    //TODO hide if not needed
    const $g = this.$node.select('svg g.storyhighlights');
    const $states = this.$node.select('div.states').selectAll<StateRepr>('div.state');
    const states = $states.data();
    const lookup : any = {};
    states.forEach((s) => lookup[s.s.id] = s);
    var firstSlide = this.data.selectedSlides()[0] || this.data.getSlideChains()[0];
    if (firstSlide) {
      $g.style('display', null);
      while(firstSlide.previous) {
        firstSlide = firstSlide.previous;
      }
      const line = provenance.toSlidePath(firstSlide).map((s) => s.state ? lookup[s.state.id] : null).filter((d) => !!d);
      $states.classed('story_member', (d) => line.indexOf(d) >= 0);
      $g.select('path').attr('d', this.line.interpolate('linear')(line));
      this.line.interpolate('step-after');
    } else {
      $g.style('display', 'none');
    }
  }
}

export function create(data:provenance.ProvenanceGraph, parent:Element, options = {}) {
  return new LayoutedProvVis(data, parent, options);
}
