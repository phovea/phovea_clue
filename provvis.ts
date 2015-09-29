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
import $ = require('jquery');

function translate(x = 0, y = 0) {
  return 'translate(' + (x || 0) + ',' + (y || 0) + ')';
}

interface INode {
  x : number;
  y: number;
  v: provenance.StateNode;
}
interface IEdge {
  s: INode;
  t: INode;
  v: provenance.ActionNode;
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

function layoutGraph(path:provenance.StateNode[]): { nodes: INode[]; edges: IEdge[] } {
  var nodes = [], edges= [], last = null;
  path.forEach((p, i) => {
    var n = { x: 0, y: i * 20, v : p };
    nodes.push(n);
    if (last) {
      var actions = last.v.next.filter((a) => a.inverses == null);
      actions = actions.sort((a,b) => a.resultsIn === p ? -1 : (b.resultsIn === p ? 1 : a.name.localeCompare(b.name)));
      edges = edges.concat(actions.map((a, j) => {
        if (j > 0) {
          var n2 = {x: j * 20, y: i * 20, v: a.resultsIn};
          nodes.push(n2);
        }
        return ({ s: last, t : (j > 0 ? n2 : n), v: a});
      }));
    }
    last = n;
  });
  return {
    nodes: nodes,
    edges: edges
  };
}

export class SimpleProvVis extends vis.AVisInstance implements vis.IVisInstance {
  private $node:d3.Selection<any>;
  private trigger = C.bind(this.update, this);
  private onStateAdded = (event: any, state: provenance.StateNode) => {
    state.on('setAttr', this.trigger);
  };

  private line = d3.svg.line<{ x: number; y : number}>().interpolate('step-after').x((d) => d.x).y((d) => d.y);

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
    this.data.on('add_state', this.onStateAdded);
    this.data.states.forEach((s) => {
      s.on('setAttr', this.trigger);
    });
    cmode.on('modeChanged', this.trigger);
  }

  destroy() {
    super.destroy();
    this.data.off('switch_state,clear', this.trigger);
    this.data.off('add_state', this.onStateAdded);
    this.data.states.forEach((s) => {
      s.off('setAttr', this.trigger);
    });
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
    var $g = $svg.append('g').attr('transform', 'scale('+this.options.scale[0]+','+this.options.scale[1]+')').append('g').attr('transform','translate(20,20)');

    $g.append('g').classed('actions', true);
    $g.append('g').classed('states', true);

    return $svg;
  }

  update() {
    const graph = this.data,
      path = provenance.findLatestPath(graph.act); //just the active path to the root
    //actions = path.slice(1).map((s) => s.resultsFrom[0]);



    this.$node.attr('width', this.width);

    const root = graph.states[0];
    const cluster = d3.layout.tree<{ v : provenance.StateNode }>()
      .nodeSize([15,15])
      //.separation(() => 1)
      .sort((a,b) => (path.indexOf(a.v) >= 0 ? -1 : (path.indexOf(b.v) >= 0 ? 1 : a.v.name.localeCompare(b.v.name))))
      .children((n) => n.v.next.filter((a) => a.inverses == null).map((a) => ({ v : a.resultsIn })));

    //const layout = layoutGraph(path);
    const nodes = cluster({ v : root });
    const edges = cluster.links(nodes);

    //move all nodes according to their breath
    //var min = 1000;
    //nodes.forEach((n: any) => min = Math.min(n.x, min));
    //nodes.forEach((n: any) => n.x -= min);
    var levelShift = [];
    nodes.forEach((n: any) => levelShift[n.depth] = Math.min(levelShift[n.depth] || 10000, n.x));
    //nodes.forEach((n: any) => n.x -= levelShift[n.depth]);

    const $states = this.$node.select('g.states')
      .selectAll('g.state').data(nodes, (d) => String(d.v.id));

    var $states_enter = $states.enter().append('g').classed('state', true).attr({
      transform: (d) => translate((<any>d).x, (<any>d).y)
    });
    $states_enter.append('circle').attr({
      r: 5,
    }).on('click', (d) => graph.jumpTo(d.v));
    $states
      .classed('act', (d) => d.v === graph.act)
      .classed('past', (d) => {
        var r = path.indexOf(d.v);
        return r >= 0 && r < path.indexOf(graph.act);
      })
      .classed('future', (d) => {
        var r = path.indexOf(d.v);
        return r > path.indexOf(graph.act);
      });

    $states.transition().attr({
      transform: (d) => translate((<any>d).x, (<any>d).y)
    });

    //this.renderNode($states, cmode.getMode(), nodes);

    $states.exit().remove();

    var $lines = this.$node.select('g.actions').selectAll('path.action').data(edges, (d) => d.source.v.id + '_'+d.target.v.id);
    $lines.enter().append('path').classed('action', true).attr({}).append('title');
    $lines.transition().attr({
      d: (d: any) => this.line([d.source, d.target]),
      'class': (d) => 'action ' //+d.v.meta.category
    }); //.select('title').text((d) => ''); //d.v.meta.name);
    //$lines.delay(100).attr('opacity', 1);
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
    const $labels_enter = $label.enter().append('text').attr({
      dx: 10,
      dy: 3,
      'class': 'label'
    });
    $labels_enter.append('tspan');
    $labels_enter.append('tspan')
      .attr('class', 'fa flags');

    $label.classed('flagged', (d) => (d.v.hasAttr('note') || d.v.hasAttr('screenshot')));
    $label.select('tspan').text((d) => d.v.name);
    $label.select('tspan.flags').text((d: INode) => (d.v.hasAttr('note') ? '\uf24a' : '') + (d.v.hasAttr('screenshot') ? '\uf030' : ''));

    $label.exit().style('opacity', 0.8).transition().style('opacity', 0).remove();

    var Jbase = $((<Element>$states.node()).parentNode);
    (<any>Jbase.find('text.flagged')).popover({
      trigger: 'hover',
      placement: 'bottom',
      title: function() {
        return d3.select(this).datum().v.name;
      },
      container: 'body',
      html: true,
      content: function() {
        const state : provenance.StateNode = d3.select(this).datum().v;
        var r = '<div class="preview">';
        if (state.hasAttr('screenshot')) {
          r += `<img src="${state.getAttr('screenshot')}">`;
        }
        if (state.hasAttr('note')) {
          r += `<pre>${state.getAttr('note')}</pre>`;
        }
        return r+'</div>';
      }
    });
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
