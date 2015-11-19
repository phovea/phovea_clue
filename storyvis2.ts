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


function toPath(s?: provenance.StoryNode) {
  var r = [];
  while (s) {
    r.push(s);
    s = s.next;
  }
  return r;
}

export class VerticalStoryVis extends vis.AVisInstance implements vis.IVisInstance {
  private $node:d3.Selection<any>;
  private trigger = C.bind(this.update, this);

  private onSelectionChanged = (event: any, type: string, act: ranges.Range) => {
    const selectedStates = act.dim(<number>provenance.ProvenanceGraphDim.Story).filter(this.data.stories);
    this.$node.selectAll('div.story').classed('select-'+type,(d: provenance.StoryNode) => selectedStates.indexOf(d) >= 0);
  };

  private options = {
    scale: [1, 1],
    rotate: 0,
    render: (state: provenance.StoryNode) => Promise.resolve(null)
  };

  constructor(public data:provenance.ProvenanceGraph, public story: provenance.StoryNode, public parent:Element, options:any= {}) {
    super();
    this.options = C.mixin(this.options,options);
    this.$node = this.build(d3.select(parent));
    C.onDOMNodeRemoved(this.node, this.destroy, this);
    this.bind();

    this.update();
  }

  private bind() {
    this.data.on('select', this.onSelectionChanged);
    cmode.on('modeChanged', this.trigger);
  }

  destroy() {
    super.destroy();
    this.data.off('select', this.onSelectionChanged);
    cmode.off('modeChanged', this.trigger);
  }

  get rawSize():[number, number] {
    return [300, 500];
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
    var $node = $parent.append('div').attr({
      'class': 'provenance-vertical-story-vis'
    }).style('transform', 'rotate(' + this.options.rotate + 'deg)');
    return $node;
  }

  private onStateClick(d: provenance.StoryNode) {
    this.data.selectStory(d);
    this.options.render(d);
  }

  update() {
    const that = this;
    const graph = this.data;
    const story_raw = toPath(this.story);

    const story = story_raw.length > 0 ? [{ id: 'f-1', i: -1, isPlaceholder: true}] : [];
    story_raw.forEach((s,i) => {
      story.push(s);
      story.push({ id: 'f'+i, i: i, isPlaceholder: true});
    });

    //this.$node.attr('width', (story.length * 70+4)*1.2);

    const to_id = (d) => String(d.id);

    //var levelShift = [];
    //nodes.forEach((n: any) => levelShift[n.depth] = Math.min(levelShift[n.depth] || 10000, n.x));
    //nodes.forEach((n: any) => n.x -= levelShift[n.depth]);

    const $states = this.$node.selectAll('div.story').data(story, to_id);

    const $states_enter = $states.enter().append('div').classed('story', true);
    const $story_enter = $states_enter.filter((d) => !d.isPlaceholder);
    const $placeholder_enter = $states_enter.filter((d) => d.isPlaceholder).classed('placeholder',true);

    $story_enter
      .attr('draggable',true)
      .on('dragstart', (d) => {
        const e = <DragEvent>(<any>d3.event);
        e.dataTransfer.effectAllowed = 'copyMove'; //none, copy, copyLink, copyMove, link, linkMove, move, all
        e.dataTransfer.setData('text/plain', d.name);
        e.dataTransfer.setData('application/caleydo-prov-story',String(d.id));
      })
      .on('click', this.onStateClick.bind(this))
      .on('mouseenter', (d) =>  {
        if (d.state != null) {
          graph.selectState(d.state, idtypes.SelectOperation.SET, idtypes.hoverSelectionType);
        }
        graph.selectStory(d, idtypes.SelectOperation.SET, idtypes.hoverSelectionType);
      })
      .on('mouseleave', (d) => {
        if (d.state != null) {
          graph.selectState(d.state, idtypes.SelectOperation.REMOVE, idtypes.hoverSelectionType);
        }
        graph.selectStory(d, idtypes.SelectOperation.REMOVE, idtypes.hoverSelectionType);
      });

    $story_enter.append('span').classed('slabel', true);
    $story_enter.append('div').attr('class', 'fa fa-remove').on('click', (d) => {
      //remove me
      d3.event.stopPropagation();
      d3.event.preventDefault();
      if (d === this.story) {
        this.story = this.story.next;
        if (this.story === null) {
          this.data.removeFullStory(d);
          return;
        }
      }
      graph.removeStoryNode(d);
      this.update();
    });
    var mm_ss = d3.time.format('%M:%S:%L');
    $story_enter.append('div').attr({
      'class': 'duration justauthor'
    }).on('click', function(d) {
      d.duration = +(prompt('Enter new duration', d.duration));
      d3.select(this).text(mm_ss(new Date(d.duration)));
    });

    $placeholder_enter
      .on('dragenter', function() {
        if (C.hasDnDType(d3.event, 'application/caleydo-prov-state') || C.hasDnDType(d3.event, 'application/caleydo-prov-story') || C.hasDnDType(d3.event, 'application/caleydo-prov-story-text')) {
          d3.select(this).classed('hover', true);
          return false;
        }
      }).on('dragover', () => {
      if (C.hasDnDType(d3.event, 'application/caleydo-prov-state') || C.hasDnDType(d3.event, 'application/caleydo-prov-story') || C.hasDnDType(d3.event, 'application/caleydo-prov-story-text')) {
        d3.event.preventDefault();
          C.updateDropEffect(d3.event);
          return false;
        }
    }).on('dragleave', function () {
      d3.select(this).classed('hover', false);
    }).on('drop', function(d) {
      d3.select(this).classed('hover', false);
      var e = <DragEvent>(<any>d3.event);
      e.preventDefault();
      const insertIntoStory = (new_: provenance.StoryNode) => {
        if (d.i < 0) {
          let bak = that.story;
          that.story = new_;
          that.data.insertIntoStory(new_, bak, true);
        } else {
          that.data.insertIntoStory(new_, story_raw[d.i], false);
        }
      };
      if (C.hasDnDType(e, 'application/caleydo-prov-state')) {
        const state = that.data.getStateById(parseInt(e.dataTransfer.getData('application/caleydo-prov-state'),10));
        insertIntoStory(that.data.wrapAsStory(state));

      } else if (C.hasDnDType(e, 'application/application/caleydo-prov-story-text')) {
        insertIntoStory(that.data.makeTextStory());
      }else if (C.hasDnDType(e, 'application/caleydo-prov-story')) {
        const story = that.data.getStoryById(parseInt(e.dataTransfer.getData('application/caleydo-prov-story'),10));
        if (story_raw.indexOf(story) >= 0 && e.dataTransfer.dropEffect !== 'copy') { //internal move
          if (d.i < 0) {
            let bak = that.story;
            that.story = story;
            that.data.moveStory(story, bak, true);
          } else {
            that.data.moveStory(story, story_raw[d.i], false);
          }
        } else { //multi story move
          insertIntoStory(that.data.cloneSingleStoryNode(story));
        }
      }
      that.update();
      return false;
    });

    $states.order();

    const $stories = $states.filter((d) => !d.isPlaceholder);
    $stories.classed('text', (d) => d.isTextOnly);
    $stories.style('background-image', (d) => d.isTextOnly ? 'url(text.png)' : (d.state.hasAttr('thumbnail') ?  `url(${d.state.getAttr('thumbnail')})` : 'url(/assets/caleydo_c_gray.svg)'));
    $stories.select('span.slabel').text((d) => d.name);

    const $placeholders = $states.filter((d) => d.isPlaceholder);
    $placeholders
      .classed('last', (d) => d.i === (story_raw.length-1))
      .text((d) => d.i === (story_raw.length-1) ? 'drop state here' : null);

    $states.exit().remove();
  }
}

export class StoryManager extends vis.AVisInstance implements vis.IVisInstance {
  private $node:d3.Selection<any>;
  private trigger = C.bind(this.update, this);

  private options = {
    scale: [1, 1],
    rotate: 0
  };

  private stories : VerticalStoryVis[] = [];

  constructor(public data:provenance.ProvenanceGraph, public parent:Element, options:any = {}) {
    super();
    this.options = C.mixin(this.options,options);
    this.$node = this.build(d3.select(parent));
    C.onDOMNodeRemoved(this.node, this.destroy, this);

    this.bind();

    this.update();
  }

  private bind() {
    this.data.on('start_story,destroy_story', this.trigger);
    cmode.on('modeChanged', this.trigger);
  }

  destroy() {
    super.destroy();
    this.data.off('start_story,destroy_story', this.trigger);
    cmode.off('modeChanged', this.trigger);
  }

  get rawSize():[number, number] {
    return [this.stories.length * 200, 500];
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
    var $node = $parent.append('div').attr({
      'class': 'provenance-multi-story-vis'
    }).style('transform', 'rotate(' + this.options.rotate + 'deg)');
    const $toolbar = $node.append('div').classed('toolbar', true);
    $toolbar.append('h2').text('Story Editor').style('display','inline-block');
    $toolbar.append('button').attr('class', 'btn btn-default fa fa-plus').attr('title','create a new story').on('click', () => {
      this.data.startNewStory('Welcome');
    });
    $toolbar.append('button').attr('class', 'btn btn-default fa fa-clone').attr('title','create a new story by extracting the current path').on('click', () => {
      var state = this.data.selectedStates()[0] || this.data.act;
      this.data.startNewStory('My story to '+(state ? state.name : 'heaven'), state ? state.path : []);
    });
    $toolbar.append('button').attr('class', 'btn btn-default fa fa-bookmark').attr('title','create a new story by extracting all starred one in a ').on('click', () => {
      var states = this.data.states.filter((d) => d.getAttr('starred',false));
      this.data.startNewStory('My favorite findings', states);
    });
    $node.append('div').classed('stories', true);
    return $node;
  }

  update() {
    const stories = this.data.getStoryChains();
    const colors = d3.scale.category10();
    this.stories = this.stories.filter((s) => {
      const i = stories.indexOf(s.story);
      if (i < 0) {
        s.node.parentNode.removeChild(s.node);
        return false;
      }
      return true;
    });
    stories.forEach((story, i) => {
      var s = C.search(this.stories, (s) => s.story === story);
      if (!s) {
        s = new VerticalStoryVis(this.data, story, <Element>this.$node.select('div.stories').node(), this.options);
        this.stories.push(s);
      }
      const c = d3.rgb(colors(String(i)));
      d3.select(s.node).style('background-color',`rgba(${c.r},${c.g},${c.b},0.1)`);
    });
  }
}

export function createSingle(data:provenance.ProvenanceGraph, story: provenance.StoryNode, parent:Element, options = {}) {
  return new VerticalStoryVis(data, story, parent, options);
}

export function create(data:provenance.ProvenanceGraph, parent: Element, options = {}) {
  return new StoryManager(data, parent, options);
}
