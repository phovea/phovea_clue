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

  private onSelectionChanged = (event: any, type: string, act: ranges.Range) => {
    const selectedStates = act.dim(<number>provenance.ProvenanceGraphDim.Story).filter(this.data.stories);
    this.$node.selectAll('div.story').classed('select-'+type,(d: provenance.AStoryNode) => selectedStates.indexOf(d) >= 0);
  };

  private options = {
    scale: [1, 1],
    rotate: 0,
    render: (state: provenance.AStoryNode) => Promise.resolve(null)
  };

  private story: provenance.AStoryNode;


  private chooseStory = (event: any, story: provenance.AStoryNode) => {
    this.story = story;
    this.update();
  };

  constructor(public data:provenance.ProvenanceGraph, public parent:Element, options:any) {
    super();
    this.options = C.mixin(this.options,options);
    this.$node = this.build(d3.select(parent));
    C.onDOMNodeRemoved(this.node, this.destroy, this);
    this.bind();
    const s = data.getStoryChains();
    this.story = s[s.length-1];
    this.update();
  }

  private bind() {
    this.data.on('extract_story', this.chooseStory);
    this.data.on('add_story,clear', this.trigger);
    this.data.on('select', this.onSelectionChanged);
    cmode.on('modeChanged', this.trigger);
  }

  destroy() {
    super.destroy();
    this.data.off('extract_story', this.chooseStory);
    this.data.off('add_story,clear', this.trigger);
    this.data.off('select', this.onSelectionChanged);
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
    var $svg = $parent.append('div').attr({
      'class': 'provenance-simple-story-vis'
    }).style('transform', 'rotate(' + this.options.rotate + 'deg)');
    $svg.append('div').classed('time',true);
    return $svg;
  }

  private onStateClick(d: provenance.AStoryNode) {
    this.data.selectStory(d);
    this.options.render(d);
  }

  update() {
    const graph = this.data;
    const story = toPath(this.story);

    //this.$node.attr('width', (story.length * 70+4)*1.2);

    const to_id = (d) => String(d.id);

    //var levelShift = [];
    //nodes.forEach((n: any) => levelShift[n.depth] = Math.min(levelShift[n.depth] || 10000, n.x));
    //nodes.forEach((n: any) => n.x -= levelShift[n.depth]);

    const $states = this.$node.selectAll('div.story').data(story, to_id);

    var $states_enter = $states.enter().append('div').classed('story', true).style({
    });
    var $glyph_enter = $states_enter.append('div')
      .attr('class', (d) => `glyph fa fa-lg fa-${d instanceof provenance.TextStoryNode ? 'file-text' : 'circle'}`)
      .on('click', this.onStateClick.bind(this))
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
    $glyph_enter
      .append('span').attr('class',(d) => `fa ${d.annotations.length > 0 ? 'fa-comments': ''}`);
    var mm_ss = d3.time.format('%M:%S:%L');
    $states_enter.append('div').attr({
      'class': 'duration'
    }).on('click', function(d) {
      d.duration = +(prompt('Enter new duration', d.duration));
      d3.select(this).text(mm_ss(new Date(d.duration)));
    });
    $states.select('div.glyph')
      .attr('title', (d) => (d instanceof provenance.TextStoryNode) ? d.title : null)
      .select('span').attr('class',(d) => `fa ${d.annotations.length > 0 ? 'fa-comments': ''}`);
    $states.attr({
    }).select('div.duration').text((d) => mm_ss(new Date(d.duration)));

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
