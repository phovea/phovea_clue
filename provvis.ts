/**
 * Created by sam on 09.02.2015.
 */
/// <reference path="../../tsd.d.ts" />

import C = require('../caleydo_core/main');
import ranges = require('../caleydo_core/range');
import provenance = require('../caleydo_provenance/main');
import d3 = require('d3');
import vis = require('../caleydo_core/vis');

function translate(x = 0, y = 0) {
  return 'translate(' + (x || 0) + ',' + (y || 0) + ')';
}

function findLatestPath(state:provenance.StateNode) {
  var path = state.path.slice();
  //compute the first path to the end
  while ((state = state.nextState) != null && (path.indexOf(state) <0)) {
    path.push(state);
  }
  return path;
}

interface INode {
  x : number;
  y: number;
  v: provenance.StateNode;
}

/*
 import dagre = require('dagre');
 function toDagreGraph(graph:provenance.ProvenanceGraph) {
 var g = new dagre.graphlib.Graph();

 // Set an object for the graph label
 g.setGraph({
 rankdir: 'TB',
 marginx: 10,
 marginy: 10
 });

 // Default to assigning a new object as a label for each new edge.
 g.setDefaultEdgeLabel(function () {
 return {};
 });

 graph.states.forEach((d) => {
 g.setNode('id'+d.id, {key: 'id'+d.id, v: d});
 });
 graph.states.forEach((d) => {
 d.nextStates.forEach((out) => {
 g.setEdge('id'+d.id, 'id'+out.id);
 })
 });
 return g;
 }

 function layoutGraph(graph:provenance.ProvenanceGraph, master: provenance.StateNode[]) : INode[] {
 var dgraph = toDagreGraph(graph);
 dagre.layout(dgraph);
 console.log(dgraph);
 var nodes = dgraph.nodes().map((d) => dgraph.node(d));
 return nodes;
 }
 */


function layout(states:provenance.StateNode[], space:number):(s:provenance.StateNode) => number {
  var scale = d3.scale.ordinal<number>().domain(states.map((s) => String(s.id))),
    l = states.length,
    diff = 30;
  if (l * diff < space) {
    scale.range(d3.range(10, 10 + l * diff, diff));
  } else {
    //some linear stretching
  }
  //target
  //.rangeRoundPoints([0, space]);
  return (s) => scale(String(s.id));
}

function layoutGraph(graph:provenance.ProvenanceGraph, master:provenance.StateNode[], mode: EMode):INode[] {
  var s = layout(master, 500);
  var base = master.map((m) => ({
    x: 0,
    y: s(m),
    v: m
  }));
  if (mode >= EMode.DL2_ALTERNATIVE) {
    master.forEach((m,i) => {
      var ns = m.nextStates;
      if (ns.length > 1) {
        var j = ns.indexOf(master[i+1]);
        ns.splice(j, 1);
        base.push.apply(base, ns.map((m, k) => ({
          x: 8*(k-1),
          y: base[i].y + 5,
          v: m
        })));
      }
    })
  }
  return base;
}

export enum EMode {
  DL0_LINE,
  DL1_LABEL,
  DL2_ALTERNATIVE
}


export class SimpleProvVis extends vis.AVisInstance implements vis.IVisInstance {
  private $node:d3.Selection<any>;
  private trigger = C.bind(this.update, this);
  private layouts:any = {};
  private add = (event, node) => {
    this.layouts[node.id] = {
      _: node
    };
  };

  private _mode = EMode.DL2_ALTERNATIVE;
  private line = d3.svg.line().interpolate('step').x((d) => d.x).y((d) => d.y);

  constructor(public data:provenance.ProvenanceGraph, public parent:Element, private options:any) {
    super();
    this.options = C.mixin({}, options);
    this.options.scale = [1, 1];
    this.options.rotate = 0;
    this.$node = this.build(d3.select(parent));
    C.onDOMNodeRemoved(this.node, this.destroy, this);

    this.data.states.forEach((s) => this.add(null, s));
    this.data.objects.forEach((s) => this.add(null, s));
    this.data.actions.forEach((s) => this.add(null, s));

    this.bind();
    this.update();
  }

  get width() {
    switch (this._mode) {
      case EMode.DL0_LINE:
        return 20;
      case EMode.DL1_LABEL:
        return 120;
      case EMode.DL2_ALTERNATIVE:
        return 300;
    }
  }

  set mode(value: EMode) {
    this._mode = value;
    this.update();
  }

  get mode() {
    return this._mode;
  }

  private bind() {
    this.data.on('add_node', this.add);
    this.data.on('switch_action', this.trigger);
  }

  destroy() {
    super.destroy();
    this.data.off('add_node', this.add);
    this.data.off('switch_action', this.trigger);
  }

  get rawSize():[number, number] {
    return [300, 800];
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

  transform(scale?:number[], rotate:number = 0) {
    var bak = {
      scale: this.options.scale || [1, 1],
      rotate: this.options.rotate || 0
    };
    if (arguments.length === 0) {
      return bak;
    }
    var dims = this.data.dim;
    var width = 20, height = dims[0];
    this.$node.attr({
      width: width * scale[0],
      height: height * scale[1]
    }).style('transform', 'rotate(' + rotate + 'deg)');
    //this.$node.select('g').attr('transform', 'scale(' + scale[0] + ',' + scale[1] + ')');
    var new_ = {
      scale: scale,
      rotate: rotate
    };
    this.fire('transform', new_, bak);
    this.options.scale = scale;
    this.options.rotate = rotate;
    return new_;
  }


  private build($parent:d3.Selection<any>) {
    var size = this.size;
    //  scale = this.options.scale;
    var $svg = $parent.append('svg').attr({
      width: size[0],
      height: size[1],
      'class': 'provenance-simple-vis'
    }).style('transform', 'rotate(' + this.options.rotate + 'deg)');

    //var $defs = $svg.append('defs');
    var $g = $svg.append('g').attr('transform', 'translate(20,20)scale(1.2,1.2)');
    $g.append('g').classed('states', true);
    $g.append('g').classed('actions', true);

    return $svg;
  }

  private update() {
    var graph = this.data,
      path = findLatestPath(graph.act); //just the active path to the root
    //actions = path.slice(1).map((s) => s.resultsFrom[0]);

    this.$node.attr('width', this.width);

    var nodes = layoutGraph(graph, path, this._mode);

    var $states = this.$node.select('g.states').selectAll('g.state').data(nodes);

    var $states_enter = $states.enter().append('g').classed('state', true).on('click', (d) => graph.jumpTo(d.v));
    $states_enter.append('circle').attr({
      r: 5
    });
    if (this.mode >= EMode.DL1_LABEL) {
      $states_enter.append('text').attr({
        dx: 10,
        dy: 3
      });
    } else {
      $states.select('text').remove();
    }

    $states.attr({
      transform: (d) => translate(d.x, d.y),
    }).classed('act', (d) => d.v === graph.act)
      .classed('past', (d) => {
        var r = path.indexOf(d.v);
        return r >= 0 && r < path.indexOf(graph.act);
      })
      .classed('future', (d) => {
        var r = path.indexOf(d.v);
        return r > path.indexOf(graph.act);
      })
      .select('text').text((d) => d.v.name);
    $states.exit().remove();

    var m = {};
    nodes.forEach((n) => m[n.v.id] = n);

    var actions = graph.actions.map((a: provenance.ActionNode) => {
      var s = a.previous;
      var t = a.resultsIn;
      return { s: m[s.id], t: m[t.id] , v : a};
    }).filter((a) => a.s != null && a.t != null);

    var $lines = this.$node.select('g.actions').selectAll('path.action').data(actions);
     $lines.enter().append('path').classed('action', true).attr({
     }).append('title');
     $lines.attr({
       d: (d) => this.line([d.s, d.t]),
      'class': (d) => 'action '+d.v.meta.category
     }).select('title').text((d) => d.v.meta.name);
     $lines.exit().remove();
  }
}

export function create(data:provenance.ProvenanceGraph, parent:Element, options = {}) {
  return new SimpleProvVis(data, parent, options);
}
