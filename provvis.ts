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
  var path = state.path.slice(),
    n = null;
  //compute the first path to the end
  while ((n = state.nextState) != null) {
    path.push(n);
  }
  return path;
}

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


export class SimpleProvVis extends vis.AVisInstance implements vis.IVisInstance {
  private $node:d3.Selection<any>;
  private trigger = C.bind(this.update, this);
  private layouts:any = {};
  private add = (event, node) => {
    this.layouts[node.id] = {
      _: node
    };
  };

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
    return [130, 800];
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

    return $svg;
  }

  private layout(states:provenance.StateNode[], space:number):(s:provenance.StateNode) => number {
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

  private update() {
    var graph = this.data,
      path = findLatestPath(graph.act); //just the active path to the root
    //actions = path.slice(1).map((s) => s.resultsFrom[0]);

    var $root = this.$node.select('g');

    var dgraph = toDagreGraph(graph);
    dagre.layout(dgraph);
    console.log(dgraph);

    var nodes = dgraph.nodes().map((d) => dgraph.node(d));
    var $states = $root.selectAll('circle.state').data(nodes);

    $states.enter().append('circle').classed('state', true).attr({
      r: 5
    }).append('title');
    $states.attr({
      cx: (d) => d.x,
      cy: (d) => d.y
    }).classed('act', (d) => d.v === graph.act)
      .select('title').text((d) => d.v.name);
    $states.exit().remove();

    /*var $lines = $root.selectAll('line.action').data(actions);
     $lines.enter().append('line').classed('action', true).attr({
     x1 : 20,
     x2 : 20
     }).append('title');
     $lines.attr({
     y1 : (d: provenance.ActionNode) => scale(d.previous),
     y2 : (d: provenance.ActionNode) => scale(d.resultsIn),
     'class': (d: provenance.ActionNode) => 'action '+d.meta.category
     }).select('title').text((d: provenance.ActionNode) => d.meta.name);
     $lines.exit().remove();
     */
  }
}

export function create(data:provenance.ProvenanceGraph, parent:Element, options = {}) {
  return new SimpleProvVis(data, parent, options);
}
