/**
 * Created by sam on 09.02.2015.
 */
/// <reference path="../../tsd.d.ts" />

import C = require('../caleydo_core/main');
import ranges = require('../caleydo_core/range');
import provenance = require('../caleydo_provenance/main');
import idtypes = require('../caleydo_core/idtype');
import cmode = require('../caleydo_provenance/mode');
import d3 = require('d3');
import vis = require('../caleydo_core/vis');

function translate(x = 0, y = 0) {
  return 'translate(' + (x || 0) + ',' + (y || 0) + ')';
}

interface INode {
  x : number;
  y: number;
  v: provenance.AStoryNode;
}
interface IEdge {
  s: INode;
  t: INode;
  v: provenance.GraphEdge;
}

const modeFeatures = {
  isSmallMode: () => cmode.getMode().authoring < 0.3,
  getHeight: () => {
    const m = cmode.getMode();
    return 40 + Math.round(m.authoring * 300);
  },
  showStorySelection: () => cmode.getMode().authoring > 0.8
};

function toPath(s?: provenance.AStoryNode) {
  var r = [];
  while (s) {
    r.push(s);
    s = s.next;
  }
  return r;
}

export class SimpleStoryVis extends vis.AVisInstance implements vis.IVisInstance {
  private $node:d3.Selection<any>;
  private trigger = C.bind(this.update, this);

  private options = {
    scale: [1, 1],
    rotate: 0
  };

  constructor(public data:provenance.ProvenanceGraph, public parent:Element, options:any) {
    super();
    this.options = C.mixin(this.options,options);
    this.$node = this.build(d3.select(parent));
    C.onDOMNodeRemoved(this.node, this.destroy, this);
    this.bind();
    this.update();
  }

  private bind() {
    this.data.on('extract_story,clear', this.trigger);
    cmode.on('modeChanged', this.trigger);
  }

  destroy() {
    super.destroy();
    this.data.off('extract_story,clear', this.trigger);
    cmode.off('modeChanged', this.trigger);
  }

  get rawSize():[number, number] {
    return [500, modeFeatures.getHeight()];
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
      'class': 'provenance-simple-story-vis',
      height: 40
    }).style('transform', 'rotate(' + this.options.rotate + 'deg)');
    $svg.append('path').classed('time',true).attr('d','M0,20l1000,0');
    return $svg;
  }

  private onStateClick(d: INode) {
    //TODO
  }

  update() {
    const graph = this.data,
      stories = graph.getStoryChains();
    const story = toPath(stories[stories.length-1]);

    this.$node.attr('width', story.length * 50);

    const to_id = (d) => String(d.id);

    var scale = d3.scale.ordinal().domain(story.map(to_id)).rangeRoundPoints([20,story.length * 50-20]);
    //var levelShift = [];
    //nodes.forEach((n: any) => levelShift[n.depth] = Math.min(levelShift[n.depth] || 10000, n.x));
    //nodes.forEach((n: any) => n.x -= levelShift[n.depth]);

    const $states = this.$node.selectAll('circle.story').data(story, to_id);

    var $states_enter = $states.enter().append('circle').classed('story', true).attr({
      cx: (d) => scale(to_id(d)),
      cy: 20,
      r: 5
    }).on('click', this.onStateClick.bind(this))
      .on('mouseenter', (d) =>  {
        if (d instanceof provenance.JumpToStoryNode) {
          graph.selectState(d.state, idtypes.SelectOperation.SET, idtypes.hoverSelectionType);
        }
        graph.selectStory(d, idtypes.SelectOperation.SET, idtypes.hoverSelectionType);
      })
      .on('mouseleave', (d) => {
        if (d instanceof provenance.JumpToStoryNode) {
          graph.selectState(d.state, idtypes.SelectOperation.REMOVE, idtypes.hoverSelectionType);
        }
        graph.selectStory(d, idtypes.SelectOperation.REMOVE, idtypes.hoverSelectionType);
      });

    $states.exit().remove();

    /*var $lines = this.$node.selectAll('path.action').data(edges, (d) => d.source.v.id + '_' + d.target.v.id);
    $lines.enter().append('path').classed('action', true).attr({}).append('title');
    $lines.transition().attr({
      d: (d:any) => this.line([d.source, d.target]),
      'class': (d) => 'action ' //+d.v.meta.category
    }); //.select('title').text((d) => ''); //d.v.meta.name);
    //$lines.delay(100).attr('opacity', 1);
    $lines.exit().remove();
    */
  }
}

export function create(data:provenance.ProvenanceGraph, parent:Element, options = {}) {
  return new SimpleStoryVis(data, parent, options);
}
