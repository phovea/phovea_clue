/**
 * Created by sam on 09.02.2015.
 */
/// <reference path="../../tsd.d.ts" />

import C = require('../caleydo_core/main');
import ranges = require('../caleydo_core/range');
import provenance = require('../caleydo_provenance/main');
import cmode = require('../caleydo_provenance/mode');
import d3 = require('d3');
import vis = require('../caleydo_core/vis');

function translate(x = 0, y = 0) {
  return 'translate(' + (x || 0) + ',' + (y || 0) + ')';
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

function layoutGraph(graph:provenance.ProvenanceGraph, master:provenance.StateNode[]):INode[] {
  var s = layout(master, 500);
  var base = master.map((m) => ({
    x: cmode.getMode() < cmode.ECLUEMode.Interactive_Story ? 40 : 5,
    y: s(m),
    v: m
  }));
  /*if (cmode.getMode() >= cmode.ECLUEMode.Interactive_Story) {
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
  }*/
  return base;
}

export class SimpleProvVis extends vis.AVisInstance implements vis.IVisInstance {
  private $node:d3.Selection<any>;
  private trigger = C.bind(this.update, this);

  private line = d3.svg.line<{ x: number; y : number}>().interpolate('step').x((d) => d.x).y((d) => d.y);

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

  get width() {
    switch (cmode.getMode()) {
      case cmode.ECLUEMode.Presentation:
        return 20;
      case cmode.ECLUEMode.Interactive_Story:
        return 120;
      default:
        return 300;
    }
  }

  private bind() {
    this.data.on('switch_state,clear', this.trigger);
    cmode.on('modeChanged', this.trigger);
  }

  destroy() {
    super.destroy();
    this.data.off('switch_state,clear', this.trigger);
    cmode.off('modeChanged', this.trigger);
  }

  get rawSize():[number, number] {
    return [this.width, 800];
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
    var $g = $svg.append('g').attr('transform', 'scale('+this.options.scale[0]+','+this.options.scale[1]+')');

    $g.append('g').classed('actions', true);
    $g.append('g').classed('states', true);

    return $svg;
  }

  private update() {
    const graph = this.data,
      path = provenance.findLatestPath(graph.act); //just the active path to the root
    //actions = path.slice(1).map((s) => s.resultsFrom[0]);

    this.$node.attr('width', this.width);

    const nodes = layoutGraph(graph, path);

    const $states = this.$node.select('g.states').selectAll('g.state').data(nodes, (d) => String(d.v.id));

    var $states_enter = $states.enter().append('g').classed('state', true);
    $states_enter.append('circle').attr({
      r: 5
    }).on('click', (d) => graph.jumpTo(d.v));
    $states.attr({
      transform: (d) => translate(d.x, d.y)
    }).classed('act', (d) => d.v === graph.act)
      .classed('past', (d) => {
        var r = path.indexOf(d.v);
        return r >= 0 && r < path.indexOf(graph.act);
      })
      .classed('future', (d) => {
        var r = path.indexOf(d.v);
        return r > path.indexOf(graph.act);
      });

    this.renderNode($states, cmode.getMode(), nodes);

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

  private renderNode($states: d3.Selection<INode>, act: cmode.ECLUEMode, nodes: INode[]) {

    this.renderLabel($states, act);
    this.renderNeighbors($states, act, nodes);
  }

  private renderLabel($states: d3.Selection<INode>, act: cmode.ECLUEMode) {
    const base = $states.selectAll('text.label');
    if (act >= cmode.ECLUEMode.Presentation) {
      base.remove();
      return;
    }
    const $label = base.data((d) => [d]);
    $label.enter().append('text').attr({
      dx: 10,
      dy: 3,
      'class': 'label'
    });
    $label.text((d) => d.v.name);
    $label.exit().style('opacity', 0.8).transition().style('opacity', 0).remove();
  }
  private renderNeighbors($states: d3.Selection<INode>, act: cmode.ECLUEMode, nodes: INode[]) {
    const base = $states.selectAll('g.neighbor');
    if (act >= cmode.ECLUEMode.Interactive_Story) {
      base.remove();
      return;
    }
    const $neighbors = base.data<provenance.StateNode>((d, i) => {
      const ns = d.v.nextStates.slice();
      if (ns.length > 1 && i < nodes.length-1) {
        let j = ns.indexOf(nodes[i + 1].v);
        ns.splice(j, 1);
        return ns;
      }
      return [];
    });
    const $neighbors_enter = $neighbors.enter().append('g').classed('neighbor',true);
    $neighbors_enter.append('path');
    $neighbors_enter.append('circle').attr({
      r: 4
    }).on('click', (d) => this.data.jumpTo(d));

    $neighbors.select('circle').attr({
      cx : (d,i ) => -10 + -(i) * 5,
      cy : 2
    });
    $neighbors.select('path').attr({
      d: (d, i, j?) => this.line([{ x : 0, y: 0}, { x : -10 + -(i) * 5, y : 2}])
    });
    $neighbors.exit().remove();
  }
}

export function create(data:provenance.ProvenanceGraph, parent:Element, options = {}) {
  return new SimpleProvVis(data, parent, options);
}
