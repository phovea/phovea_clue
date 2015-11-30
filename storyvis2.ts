/**
 * Created by sam on 09.02.2015.
 */
/// <reference path="../../tsd.d.ts" />

import C = require('../caleydo_core/main');
import ranges = require('../caleydo_core/range');
import provenance = require('../caleydo_provenance/main');
import idtypes = require('../caleydo_core/idtype');
import cmode = require('../caleydo_provenance/mode');
import dialogs = require('../wrapper_bootstrap_fontawesome/dialogs');
import d3 = require('d3');
import vis = require('../caleydo_core/vis');
import utils = require('./utils');
import marked = require('marked');

function toPath(s?: provenance.SlideNode) {
  var r = [];
  while (s) {
    r.push(s);
    s = s.next;
  }
  return r;
}

interface ISlideNodeRepr {
  id: string;
  i: number;
  isPlaceholder?: boolean;
  name?: string;
  state?: provenance.StateNode;
  to?: provenance.SlideNode;
}

function to_duration(d: number) {
  var mm_ss = d3.time.format('%M:%S:%L');
  return mm_ss(new Date(d));
}

enum LevelOfDetail {
  None = 0,
  Small = 1,
  Medium = 2,
  Large = 3
}

function getLevelOfDetail() {
  const mode = cmode.getMode();
  if (mode.presentation >= 0.8) {
    return LevelOfDetail.Large;
  }
  if (mode.exploration > 0.3) {
    return LevelOfDetail.None;
  }
  if (mode.authoring >= 0.8) {
    return LevelOfDetail.Large;
  }
  return LevelOfDetail.Medium;
}

function isEditAble() {
  return getLevelOfDetail() >= LevelOfDetail.Large;
}

export class VerticalStoryVis extends vis.AVisInstance implements vis.IVisInstance {
  private $node:d3.Selection<any>;
  //private trigger = C.bind(this.update, this);

  private onSelectionChanged = (event: any, type: string, act: ranges.Range) => {
    const selectedStates = act.dim(<number>provenance.ProvenanceGraphDim.Slide).filter(this.data.stories);
    this.$node.selectAll('div.story:not(.placeholder)').classed('select-'+type,(d: provenance.SlideNode) => selectedStates.indexOf(d) >= 0);
  };

  private options = {
    scale: [1, 1],
    rotate: 0,
    render: (state: provenance.SlideNode) => Promise.resolve(null),


    class: 'vertical',
    xy: 'y',
    wh: 'height'
  };

  private duration2pixel = d3.scale.linear().domain([0,10000]).range([20, 220]);

  constructor(public data:provenance.ProvenanceGraph, public story: provenance.SlideNode, public parent:Element, options:any= {}) {
    super();
    this.options = C.mixin(this.options,options);
    if (this.options.class === 'horizontal') {
      this.options.xy = 'x';
      this.options.wh = 'width';
    }
    this.$node = this.build(d3.select(parent));
    C.onDOMNodeRemoved(this.node, this.destroy, this);
    this.bind();

    this.update();
  }

  private bind() {
    this.data.on('select', this.onSelectionChanged);
    //cmode.on('modeChanged', this.trigger);
  }

  destroy() {
    super.destroy();
    this.data.off('select', this.onSelectionChanged);
    //cmode.off('modeChanged', this.trigger);
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
      'class': 'provenance-story-vis '+this.options.class
    }).style('transform', 'rotate(' + this.options.rotate + 'deg)');
    return $node;
  }

  pushAnnotation(ann: provenance.IStateAnnotation) {
    var selected = this.data.selectedSlides()[0];
    if (selected) {
      selected.pushAnnotation(ann);
      this.options.render(selected);
    }
  }

  onSlideClick(d: provenance.SlideNode) {
    this.data.selectSlide(d);
    this.options.render(d);
  }


  private dndSupport(elem : d3.Selection<ISlideNodeRepr>) {
    const that = this;
    elem
      .on('dragenter', function () {
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
    }).on('drop', function (d) {
      d3.select(this).classed('hover', false);
      var e = <DragEvent>(<any>d3.event);
      e.preventDefault();
      const full_story = toPath(that.story);
      const insertIntoStory = (new_:provenance.SlideNode) => {
        if (d.i < 0) {
          let bak = that.story;
          that.story = new_;
          that.data.insertIntoSlide(new_, bak, true);
        } else {
          that.data.insertIntoSlide(new_, d.to, false);
        }
        that.update();
      };
      if (C.hasDnDType(e, 'application/caleydo-prov-state')) {
        const state = that.data.getStateById(parseInt(e.dataTransfer.getData('application/caleydo-prov-state'), 10));
        insertIntoStory(that.data.wrapAsSlide(state));

      } else if (C.hasDnDType(e, 'application/application/caleydo-prov-story-text')) {
        insertIntoStory(that.data.makeTextSlide());
      } else if (C.hasDnDType(e, 'application/caleydo-prov-story')) {
        const story = that.data.getSlideById(parseInt(e.dataTransfer.getData('application/caleydo-prov-story'), 10));
        if (full_story.indexOf(story) >= 0 && e.dataTransfer.dropEffect !== 'copy') { //internal move
          if (d.i < 0) { //no self move
            if (story !== that.story) {
              let bak = that.story;
              that.story = story;
              that.data.moveSlide(story, bak, true);
              that.update();
            }
          } else {
            let ref = d.to;
            if (ref !== story) {
              //we might moved the first one
              if (story === that.story) {
                that.story = story.next;
              }
              that.data.moveSlide(story, ref, false);
              that.update();
            }
          }
        } else { //multi story move
          insertIntoStory(that.data.cloneSingleSlideNode(story));
        }
      }
      return false;
    });
  }

  private changeDuration($elem: d3.Selection<ISlideNodeRepr>) {
    const that = this;
    $elem.call(d3.behavior.drag()
      .origin(() => ({ x : 0, y : 0}))
      .on('drag', function(d: ISlideNodeRepr) {
        //update the height of the slide node
        const e : any = d3.event;
        const $elem = d3.select((<Element>this).previousSibling);
        const height = Math.max(that.duration2pixel.range()[0],that.duration2pixel(d.to.duration)+e[that.options.xy]);
        $elem.style(that.options.wh, height+'px');
        $elem.select('div.duration').text(to_duration(that.duration2pixel.invert(height)));
      }).on('dragend', function(d: ISlideNodeRepr) {
        //update the stored duration just once
        const h = parseInt(d3.select((<Element>this).previousSibling).style(that.options.wh),10);
        d.to.duration = that.duration2pixel.invert(h);
      }));
  }

  private storyInteraction(elem: d3.Selection<ISlideNodeRepr>) {
    const graph = this.data;

    elem.attr('draggable',true)
      .on('dragstart', (d) => {
        if (!isEditAble()) {
          d3.event.preventDefault();
          return;
        }
        const e = <DragEvent>(<any>d3.event);
        e.dataTransfer.effectAllowed = 'copyMove'; //none, copy, copyLink, copyMove, link, linkMove, move, all
        e.dataTransfer.setData('text/plain', d.name);
        e.dataTransfer.setData('application/caleydo-prov-story',String(d.id));
      })
      .on('click', this.onSlideClick.bind(this))
      .on('mouseenter', function(d)  {
        if (d.state != null) {
          graph.selectState(d.state, idtypes.SelectOperation.SET, idtypes.hoverSelectionType);
        }
        graph.selectSlide(<provenance.SlideNode><any>d, idtypes.SelectOperation.SET, idtypes.hoverSelectionType);
      })
      .on('mouseleave', function(d) {
        if (d.state != null) {
          graph.selectState(d.state, idtypes.SelectOperation.REMOVE, idtypes.hoverSelectionType);
        }
        graph.selectSlide(<provenance.SlideNode><any>d, idtypes.SelectOperation.REMOVE, idtypes.hoverSelectionType);
      });
  }

  update() {
    const graph = this.data;
    const story_raw = toPath(this.story);

    const story = story_raw.length > 0 ? [{ id: 'f-1', i: -1, isPlaceholder: true, to: null}] : [];
    story_raw.forEach((s,i) => {
      story.push(s);
      story.push({ id: 'f'+i, i: i, isPlaceholder: true, to: s});
    });

    //this.$node.attr('width', (story.length * 70+4)*1.2);

    const to_id = (d) => String(d.id);

    const lod = getLevelOfDetail();
    this.$node.classed('large', lod  === LevelOfDetail.Large);
    this.$node.classed('medium', lod  === LevelOfDetail.Medium);
    this.$node.classed('small', lod  === LevelOfDetail.Small);

    //var levelShift = [];
    //nodes.forEach((n: any) => levelShift[n.depth] = Math.min(levelShift[n.depth] || 10000, n.x));
    //nodes.forEach((n: any) => n.x -= levelShift[n.depth]);

    const $states = this.$node.selectAll('div.story').data(story, to_id);

    const $states_enter = $states.enter().append('div').classed('story', true);
    const $story_enter = $states_enter.filter((d) => !d.isPlaceholder);
    const $placeholder_enter = $states_enter.filter((d) => d.isPlaceholder).classed('placeholder',true);

    $story_enter.call(this.storyInteraction.bind(this));
    $story_enter.append('div').classed('preview', true);
    $story_enter.append('div').classed('slabel', true);
    const $toolbar_enter = $story_enter.append('div').classed('toolbar', true);
    $toolbar_enter.append('i').attr('class', 'fa fa-edit').on('click', (d) => {
      //remove me
      d3.event.stopPropagation();
      d3.event.preventDefault();
      dialogs.prompt(d.name, {
        title: 'Edit name',
        placeholder: 'Markdown supported...',
        multiline: true
      }).then((text) => {
        d.name = text;
        this.update();
      });
      return false;
    });

    $toolbar_enter.append('i').attr('class', 'fa fa-copy').on('click', (d) => {
      //remove me
      d3.event.stopPropagation();
      d3.event.preventDefault();
      this.data.moveSlide(this.data.cloneSingleSlideNode(d), d, false);
      this.update();
      return false;
    });
    $toolbar_enter.append('i').attr('class', 'fa fa-remove').on('click', (d) => {
      //remove me
      d3.event.stopPropagation();
      d3.event.preventDefault();
      if (d === this.story) {
        this.story = this.story.next;
        if (this.story === null) {
          this.data.removeFullSlide(d);
          return;
        }
      }
      graph.removeSlideNode(d);
      this.update();
    });
    $story_enter.append('div').classed('duration', true);

    /*$story_enter.attr('title', 'test');
    (<any>$($story_enter[0][0])).tooltip({
      placement: 'left'
    });
    var popover = {
      html: true,
      placement: 'left',
      trigger: 'hover',
      delay: { "show": 500, "hide": 100 },
      content: function() {
        const d : provenance.SlideNode = d3.select(this).datum();
        const thumbnail = d.isTextOnly ? '/clue_demo/text.png' : utils.preview_thumbnail_url(this.data, d);
        const text = d.name;
        return `<img src="${thumbnail}"><div>${text}</div>`;
      }
    };*/

    $placeholder_enter.call(this.dndSupport.bind(this));
    $placeholder_enter.call(this.changeDuration.bind(this));

    $states.order();

    const $stories = $states.filter((d) => !d.isPlaceholder);
    $stories.classed('text', (d) => d.isTextOnly);
    $stories.attr('title', (d) => `(${to_duration(d.duration)})\n${d.name}`);
    //$stories.attr('data-toggle', 'tooltip');
    $stories.select('div.preview').style('background-image', lod < LevelOfDetail.Medium ? null : ((d) => d.isTextOnly ? 'url(../clue_demo/assets/text.png)' : `url(${utils.preview_thumbnail_url(this.data, d)})`));
    $stories.select('div.slabel').html((d) => d.name ? marked(d.name) : '');
    $stories.select('div.duration').text((d) => to_duration(d.duration));
    $stories.style(this.options.wh, (d) => this.duration2pixel(d.duration)+'px');

    //const $placeholders = $states.filter((d) => d.isPlaceholder);

    $states.exit().remove();
  }
}

export class StoryManager extends vis.AVisInstance implements vis.IVisInstance {
  private $node:d3.Selection<any>;
  private trigger = C.bind(this.update, this);

  private options = {
    scale: [1, 1],
    rotate: 0,
    class: 'vertical'
  };

  private story : VerticalStoryVis = null;

  constructor(public data:provenance.ProvenanceGraph, public parent:Element, options:any = {}) {
    super();
    this.options = C.mixin(this.options,options);
    this.$node = this.build(d3.select(parent));
    C.onDOMNodeRemoved(this.node, this.destroy, this);

    this.bind();

    this.update();
  }

  private bind() {
    this.data.on('start_slide,destroy_slide', this.trigger);
    cmode.on('modeChanged', this.trigger);
  }

  destroy() {
    super.destroy();
    this.data.off('start_slide,destroy_slide', this.trigger);
    cmode.off('modeChanged', this.trigger);
  }

  get rawSize():[number, number] {
    return [200, 500];
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

  switchTo(story: provenance.SlideNode) {
    if (this.story != null) {
      this.story.destroy();
      this.story = null;
    }
    if (story) {
      let story_start = story;
      while(story_start.previous) {
        story_start = story_start.previous;
      }
      this.story = new VerticalStoryVis(this.data, story_start, <Element>this.$node.select('div.stories').node(), this.options);
      this.data.selectSlide(story);
    }
  }

  private build($parent:d3.Selection<any>) {
    var $node = $parent.append('aside').attr({
      'class': 'provenance-multi-story-vis '+this.options.class
    }).style('transform', 'rotate(' + this.options.rotate + 'deg)');
    const $helper = $node.append('div');
    $helper.append('h2').text('Story');
    const $toolbar = $helper.append('div').classed('toolbar', true);
    $toolbar.html(`
    <div class="btn-group create_story" role="group" aria-label="create_story">
      <button class="btn btn-default btn-xs" data-create="plus" title="create a new story"><i class="fa fa-plus"></i></button>
      <button class="btn btn-default btn-xs" data-create="clone" title="create a new story by extracting the current path"><i
        class="fa fa-files-o"></i></button>
      <button class="btn btn-default btn-xs" data-create="bookmark" title="create a new story by extracting all bookmarked ones"><i
        class="fa fa-bookmark"></i></button>
      <div class="btn-group btn-group-xs" role="group">
        <button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown" aria-haspopup="true"
                aria-expanded="false">
          Select<span class="caret"></span>
        </button>
        <ul class="dropdown-menu" id="story_list">
          <!--<li><a href="#">A</a></li>-->
        </ul>
      </div>
    </div>

    <!--<div class="btn-group" role="group" aria-label="add_story">
      <button class="btn btn-default btn-xs" data-add="text" title="add text slide"><i class="fa fa-file-text-o"></i></button>
      <button class="btn btn-default btn-xs" data-add="extract" title="add current state"><i class="fa fa-file-o"></i></button>
      <button class="btn btn-default btn-xs" data-add="clone" title="clone current slide"><i class="fa fa-copy"></i></button>
    </div>-->

    <div class="btn-group" role="group" aria-label="annotations">
      <button class="btn btn-default btn-xs" title="add text annotation" data-ann="text"><i class="fa fa-font"></i></button>
      <button class="btn btn-default btn-xs" title="add arrow" data-ann="arrow"><i class="fa fa-arrow-right"></i></button>
      <button class="btn btn-default btn-xs" title="add frame" data-ann="frame"><i class="fa fa-square-o"></i></button>
    </div>
    `);

    const that = this;
    $toolbar.selectAll('button[data-create]').on('click', function() {
      var create = this.dataset.create;
      var story;
      switch(create) {
        case 'plus':
          story = that.data.startNewSlide('Welcome');
          break;
        case 'clone':
          var state = that.data.selectedStates()[0] || that.data.act;
          story = that.data.startNewSlide('My story to '+(state ? state.name : 'heaven'), state ? state.path : []);
          break;
        case 'bookmark':
          var states = that.data.states.filter((d) => d.getAttr('starred',false));
          story = that.data.startNewSlide('My favorite findings', states);
          break;
      }
      that.switchTo(story);
    });
    $toolbar.selectAll('button[data-add]').on('click', function() {
      var create = this.dataset.add;
      if (!that.story) {
        return null;
      }
      var current = that.data.selectedSlides()[0] || that.story.story;
      switch(create) {
        case 'text':
          that.data.moveSlide(that.data.makeTextSlide('Unnamed'), current, false);
          break;
        case 'extract':
          var state = that.data.selectedStates()[0] || that.data.act;
          that.data.moveSlide(that.data.extractSlide([state], false), current, false);
          break;
        case 'clone':
          if (current) {
            that.data.moveSlide(that.data.cloneSingleSlideNode(current), current, false);
          }
          break;
      }
      that.story.update();
    });


    $toolbar.selectAll('button[data-ann]').on('click', function() {
      var create = this.dataset.ann;
      var ann;
      switch(create) {
        case 'text':
          ann = {
            type: 'text',
            pos: [10, 10],
            text: ''
          };
          break;
        case 'arrow':
          ann = {
            type: 'arrow',
            pos: [10, 10],
            at: [200,200]
          };
          //that.data.appendToStory(that.story.story, that.data.makeTextStory('Unnamed');
          //this.actStory.addText();
          break;
        case 'frame':
          ann = {
            type: 'frame',
            pos: [10, 10],
            size: [20,20]
          };
          break;
      }
      if (that.story && ann) {
        that.story.pushAnnotation(ann);
      }
    });

    $node.append('div').classed('stories', true);
    $node.append('div').classed('player', true);
    return $node;
  }

  update() {

    const lod = getLevelOfDetail();
    this.$node.classed('large', lod  === LevelOfDetail.Large);
    this.$node.classed('medium', lod  === LevelOfDetail.Medium);
    this.$node.classed('small', lod  === LevelOfDetail.Small);


    const stories = this.data.getSlideChains();
    const colors = d3.scale.category10();
    {
      const $stories = this.$node.select('#story_list').selectAll('li').data(stories);
      const $stories_enter = $stories.enter().append('li').append('a');
      $stories_enter.append('i').attr('class','fa fa-square');
      $stories_enter.append('span').attr('href', '#').on('click', (d) => {
        this.switchTo(d);
      });
      $stories.exit().remove();
      $stories.select('i').style('color', (d, i) => colors(String(i)));
      $stories.select('span').text((d) => d.name);
    }

    if (this.story === null && stories.length > 0) {
      this.switchTo(stories[0]);
    }
    if (this.story) {
      this.story.update();
    }
  }
}

export function createSingle(data:provenance.ProvenanceGraph, story: provenance.SlideNode, parent:Element, options = {}) {
  return new VerticalStoryVis(data, story, parent, options);
}

export function create(data:provenance.ProvenanceGraph, parent: Element, options = {}) {
  return new StoryManager(data, parent, options);
}
