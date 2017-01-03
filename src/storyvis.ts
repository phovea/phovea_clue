/**
 * Created by sam on 09.02.2015.
 */


import * as C from 'phovea_core/src/index';
import * as ranges from 'phovea_core/src/range';
import * as provenance from 'phovea_core/src/provenance';
import * as idtypes from 'phovea_core/src/idtype';
import * as cmode from './mode';
import * as dialogs from 'phovea_ui/src/dialogs';
import * as d3 from 'd3';
import * as vis from 'phovea_core/src/vis';
import * as utils from './utils';
import * as marked from 'marked';
import * as player from './player';
import * as $ from 'jquery';


interface ISlideNodeRepr {
  id: string;
  i: number;
  isPlaceholder?: boolean;
  isLastPlaceholder?: boolean;
  name?: string;
  state?: provenance.StateNode;
  to?: provenance.SlideNode;
}

function to_duration(d: number) {
  var mm_ss = d3.time.format('%M:%S');
  return mm_ss(new Date(d));
}

function to_starting_time(d: provenance.SlideNode, story: provenance.SlideNode[]) {
  if (!d) {
    return d3.sum(story, (d) => d.duration + d.transition);
  }
  const i = story.indexOf(d);
  return story.slice(0,i).reduce((a,b) => a+b.duration+b.transition, d.transition);
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
  private trigger = C.bind(this.update, this);

  private onSelectionChanged = (event: any, slide: provenance.SlideNode, type: string, op: any, extras) => {
    this.$node.selectAll('div.story:not(.placeholder)').classed('phovea-select-'+type,function (d: provenance.SlideNode) {
      const isSelected = d === slide;
      if (isSelected && type === idtypes.defaultSelectionType) {
        this.scrollIntoView();
      }
      return isSelected;
    });

    if (type === idtypes.defaultSelectionType) {
      this.updateInfo(slide);
      this.updateTimeIndicator(slide, extras.withTransition !== false);
    }
  };
  private onStateSelectionChanged = (event: any, state: provenance.StateNode, type: string, op, extras) => {
    if (!state || extras.slideSelected === true) {
      return;
    }
    const slide = cmode.getMode().exploration < 0.8 ? this.findSlideForState(state) : null;
    const selected = this.data.selectedSlides(type);
    if ((slide && selected.indexOf(slide) >= 0) || (!slide && selected.length === 0)) {
      return;
    }
    if (type === idtypes.defaultSelectionType) {
      this.data.selectSlide(slide, idtypes.SelectOperation.SET, idtypes.defaultSelectionType, { withTransition : false });
    } else {
      this.data.selectSlide(slide, idtypes.SelectOperation.SET, type);
    }
  };

  private options = {
    scale: [1, 1],
    rotate: 0,

    class: 'vertical',
    xy: 'y',
    wh: 'height',
    topleft: 'top',

    thumbnails: true
  };

  static MIN_HEIGHT = 20;
  private duration2pixel = d3.scale.linear().domain([0,10000]).range([VerticalStoryVis.MIN_HEIGHT, 200]);

  story: provenance.SlideNode = null;

  player : player.Player = null;

  constructor(public data:provenance.ProvenanceGraph, public parent:Element, options:any= {}) {
    super();
    this.options = C.mixin(this.options,options);
    if (this.options.class === 'horizontal') {
      this.options.xy = 'x';
      this.options.wh = 'width';
      this.options.topleft = 'left';
    }
    this.$node = this.build(d3.select(parent));
    C.onDOMNodeRemoved(this.node, this.destroy, this);

    this.player = new player.Player(data, this.node.querySelector('#player_controls'));

    this.bind();

    this.story = this.data.selectedSlides()[0] || this.data.getSlideChains()[0];

    this.update();
  }

  private findSlideForState(state: provenance.StateNode) {
    if (!this.story) {
      return null;
    }
    return C.search( provenance.toSlidePath(this.story), (s) => s.state === state);
  }

  private bind() {
    this.data.on('select_slide', this.onSelectionChanged);
    this.data.on('select_state', this.onStateSelectionChanged);
    this.data.on('start_slide,destroy_slide', this.trigger);
    cmode.on('modeChanged', this.trigger);
  }

  destroy() {
    super.destroy();
    this.data.off('select_slide', this.onSelectionChanged);
    this.data.off('select_state', this.onStateSelectionChanged);
    this.data.off('start_slide,destroy_slide', this.trigger);
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

  switchTo(story: provenance.SlideNode) {
    if (story) {
      let story_start = story;
      while(story_start.previous) {
        story_start = story_start.previous;
      }
      this.story = story_start;
      this.data.selectSlide(story);
    } else {
      this.story = null;
    }
    this.update();
  }


  private build($parent:d3.Selection<any>) {
    var $node = $parent.append('aside').attr({
      'class': 'provenance-story-vis '+this.options.class
    }).style('transform', 'rotate(' + this.options.rotate + 'deg)');
    $node.html(`
      <div>
        <h2><i class="fa fa-video-camera"></i> Story <span id="player_controls">
            <i data-player="backward" class="btn btn-xs btn-default fa fa-step-backward" title="Step Backward"></i>
            <i data-player="play" class="btn btn-xs btn-default fa fa-play" title="Play"></i>
            <i data-player="forward" class="btn btn-xs btn-default fa fa-step-forward" title="Step Forward"></i>
          </span>
          <i class="fa fa-plus-circle"></i></h2>
        <form class="form-inline toolbar" style="display: none" onsubmit="return false;">
        <div class="btn-group btn-group-xs" role="group">
          <button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown" aria-haspopup="true"
                  aria-expanded="false">
            Select<span class="caret"></span>
          </button>
          <ul class="dropdown-menu" id="story_list">
            <!--<li><a href="#">A</a></li>-->
          </ul>
        </div>
        <div class="btn-group btn-group-xs" data-toggle="buttons">
          <button class="btn btn-default btn-xs" data-create="plus" title="create a new story"><i class="fa fa-plus"></i> New Story</button>
          <button class="btn btn-default btn-xs" data-create="clone" title="create a new story by extracting the current path"><i class="fa fa-files-o"></i> Extract</button>
          <button class="btn btn-default btn-xs" data-create="bookmark" title="create a new story by extracting all bookmarked ones"><i class="fa fa-bookmark"></i> Bookmarked</button>
        </div>
        </form>
      </div>
      <div class="current">
        <input type="text" class="form-control" placeholder="slide name" disabled="disabled">
        <div class="name"></div>
        <textarea class="form-control" placeholder="slide description" disabled="disabled"></textarea>
        <div class="description"></div>
      </div>
      <div class="stories ${this.options.class}">
        <div class="line"></div>
        <div class="time_marker"><i class="fa fa-circle"></i></div>
      </div>
    `);

    const that = this;

    $node.selectAll('button[data-create]').on('click', function() {
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
      return false;
    });
    const jp = $($node.node());
    (<any>jp.find('.dropdown-toggle')).dropdown();
    jp.find('h2 i.fa-plus-circle').on('click', () => {
      jp.find('form.toolbar').toggle('fast');
    });

    {
      let $base = $node.select('div.current');
      $base.select('input').on('change', function() {
        const d = that.data.selectedSlides()[0];
        if (d) {
          d.name = this.value;
        }
        $base.select('div.name').html(marked(d.name));
        that.update();
      });
      $base.select('textarea').on('change', function() {
        const d = that.data.selectedSlides()[0];
        if (d) {
          d.description = this.value;
        }
        $base.select('div.description').html(marked(d.description));
        //that.update();
      });
    }


    if (this.data.getSlideChains().length === 0) {
      jp.find('form.toolbar').toggle('fast');
    }

    return $node;
  }

  private updateInfo(slide: provenance.SlideNode) {
    const $base = this.$node.select('div.current').datum(slide);
    $base.select('input').property('value', slide ? slide.name : '').attr('disabled', slide ? null : 'disabled');
    $base.select('div.name').html(slide ? marked(slide.name) : '');
    $base.select('textarea').property('value', slide ? slide.description: '').attr('disabled', slide ? null : 'disabled');
    $base.select('div.description').html(slide ? marked(slide.description) : '');
  }

  pushAnnotation(ann: provenance.IStateAnnotation) {
    var selected = this.data.selectedSlides()[0];
    if (selected) {
      selected.pushAnnotation(ann);
    }
  }

  onSlideClick(d: provenance.SlideNode) {
    this.data.selectSlide(d, idtypes.SelectOperation.SET, idtypes.defaultSelectionType, { withTransition : false });
    if (d && d.state) {
      this.data.selectState(d.state, idtypes.SelectOperation.SET, idtypes.defaultSelectionType, {slideSelected: true});
    }
  }

  private dndSupport(elem : d3.Selection<ISlideNodeRepr>) {
    const that = this;
    elem
      .on('dragenter', function (d) {
        if (C.hasDnDType(d3.event, 'application/phovea-prov-state') || C.hasDnDType(d3.event, 'application/phovea-prov-story') || C.hasDnDType(d3.event, 'application/phovea-prov-story-text')) {
          d3.select(this).classed('hover', true);
          return false;
        }
      }).on('dragover', (d) => {
      if (C.hasDnDType(d3.event, 'application/phovea-prov-state') || C.hasDnDType(d3.event, 'application/phovea-prov-story') || C.hasDnDType(d3.event, 'application/phovea-prov-story-text')) {
        (<Event>d3.event).preventDefault();
        C.updateDropEffect(d3.event);
        return false;
      }
    }).on('dragleave', function (d) {
      d3.select(this).classed('hover', false);
    }).on('drop', function (d) {
      d3.select(this).classed('hover', false);
      var e = <DragEvent>(<any>d3.event);
      e.preventDefault();
      const full_story =  provenance.toSlidePath(that.story);
      const d_story = d.isPlaceholder ? d.to : <provenance.SlideNode>(<any>d);
      const insertIntoStory = (new_:provenance.SlideNode) => {
        if (d_story == null) { //at the beginning
          let bak = that.story;
          that.story = new_;
          if (bak) {
            that.data.insertIntoSlide(new_, bak, true);
          }
        } else {
          that.data.insertIntoSlide(new_, d_story, false);
        }
        that.update();
      };
      if (C.hasDnDType(e, 'application/phovea-prov-state')) {
        const state = that.data.getStateById(parseInt(e.dataTransfer.getData('application/phovea-prov-state'), 10));
        insertIntoStory(that.data.wrapAsSlide(state));

      } else if (C.hasDnDType(e, 'application/application/phovea-prov-story-text')) {
        insertIntoStory(that.data.makeTextSlide());
      } else if (C.hasDnDType(e, 'application/phovea-prov-story')) {
        const story = that.data.getSlideById(parseInt(e.dataTransfer.getData('application/phovea-prov-story'), 10));
        if (full_story.indexOf(story) >= 0 && e.dataTransfer.dropEffect !== 'copy') { //internal move
          if (d_story == null) { //no self move
            if (story !== that.story) {
              let bak = that.story;
              that.story = story;
              that.data.moveSlide(story, bak, true);
              that.update();
            }
          } else {
            let ref = d_story;
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

  private changeDuration($elem: d3.Selection<provenance.SlideNode>) {
    const that = this;
    $elem.call(d3.behavior.drag()
      .origin(() => ({ x : 0, y : 0}))
      .on('drag', function(d: provenance.SlideNode, i) {
        //update the height of the slide node
        const e : any = d3.event;
        const $elem = d3.select((<Element>this).parentElement);
        const height = Math.max(that.duration2pixel.range()[0],that.duration2pixel(d.duration)+e[that.options.xy]);
        $elem.style(that.options.wh, height+'px');
        const change = that.duration2pixel.invert(height) - d.duration;
        const durations = that.$node.selectAll('div.story').filter((d) => !d.isPlaceholder);
        const stories = provenance.toSlidePath(that.story);
        durations.select('div.duration span').text((k) => {
          let index = stories.indexOf(k);
          return to_duration(to_starting_time(k, stories) + (index > i ? change : 0));
        });
        that.$node.select('div.story.placeholder div.duration span').text(to_duration(to_starting_time(null, stories) + change));
      }).on('dragend', function(d: provenance.SlideNode) {
        //update the stored duration just once
        const h = parseInt(d3.select((<Element>this).parentElement).style(that.options.wh),10);
        d.duration = that.duration2pixel.invert(h);
      }));
  }

  private changeTransition($elem: d3.Selection<provenance.SlideNode>) {
    const that = this;
    $elem.call(d3.behavior.drag()
      .origin(() => ({ x : 0, y : 0}))
      .on('drag', function(d: provenance.SlideNode, i) {
        //update the height of the slide node
        const e : any = d3.event;
        const $elem = d3.select((<Element>this).parentElement);
        const offset = Math.max(0,that.duration2pixel(d.transition)-VerticalStoryVis.MIN_HEIGHT+e[that.options.xy]);
        $elem.style('margin-'+that.options.topleft, offset+'px');
        const change = that.duration2pixel.invert(offset+VerticalStoryVis.MIN_HEIGHT) - d.transition;
        const durations = that.$node.selectAll('div.story').filter((d) => !d.isPlaceholder);
        const stories =  provenance.toSlidePath(that.story);
        durations.select('div.duration span').text((k) => {
          let index = stories.indexOf(k);
          return to_duration(to_starting_time(k, stories) + (index >= i ? change : 0));
        });
        that.$node.select('div.story.placeholder div.duration span').text(to_duration(to_starting_time(null, stories) + change));
      }).on('dragend', function(d: provenance.SlideNode) {
        //update the stored duration just once
        const h = parseInt(d3.select((<Element>this).parentElement).style('margin-'+that.options.topleft),10);
        d.transition = that.duration2pixel.invert(h+VerticalStoryVis.MIN_HEIGHT);
      }));
  }

  private storyInteraction(elem: d3.Selection<ISlideNodeRepr>) {
    const graph = this.data;

    elem.attr('draggable',true)
      .on('dragstart', (d) => {
        if (!isEditAble()) {
          (<Event>d3.event).preventDefault();
          return;
        }
        const e = <DragEvent>(<any>d3.event);
        e.dataTransfer.effectAllowed = 'copyMove'; //none, copy, copyLink, copyMove, link, linkMove, move, all
        e.dataTransfer.setData('text/plain', d.name);
        e.dataTransfer.setData('application/phovea-prov-story',String(d.id));
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

  private createToolbar($elem: d3.Selection<provenance.SlideNode>) {

    const $toolbar_enter = $elem.append('div').classed('toolbar', true);
    $toolbar_enter.append('i').attr('class', 'fa fa-edit').on('click', (d) => {
      let e = <Event>d3.event;
      //remove me
      e.stopPropagation();
      e.preventDefault();
      dialogs.prompt(d.name, {
        title: 'Edit name',
        placeholder: 'Markdown supported...',
        multiline: true
      }).then((text) => {
        d.name = text;
        this.update();
        this.updateInfo(d);
      });
      return false;
    });

    $toolbar_enter.append('i').attr('class', 'fa fa-copy').attr('title','clone slide').on('click', (d) => {
      let e = <Event>d3.event;
      //remove me
      e.stopPropagation();
      e.preventDefault();
      this.data.moveSlide(this.data.cloneSingleSlideNode(d), d, false);
      this.update();
      return false;
    });

    /*$toolbar_enter.append('i').attr('class', 'fa fa-camera').attr('title','force update of preview').on('click', (d) => {
      //remove me
      d3.event.stopPropagation();
      d3.event.preventDefault();
      this.data.moveSlide(this.data.cloneSingleSlideNode(d), d, false);
      this.update();
      return false;
    });
    */
    $toolbar_enter.append('i').attr('class', 'fa fa-remove').attr('title','remove slide').on('click', (d) => {
      let e = <Event>d3.event;
      //remove me
      e.stopPropagation();
      e.preventDefault();
      if (d === this.story) {
        this.story = this.story.next;
        if (this.story === null) {
          this.data.removeFullSlide(d);
          return;
        }
      }
      this.data.removeSlideNode(d);
      this.update();
    });
  }

  private createLastPlaceholder($p: d3.Selection<ISlideNodeRepr>) {
    const that = this;
    $p.html(`<div>
       <button class="btn btn-default btn-xs" data-add="text" title="add text slide"><i class="fa fa-file-text-o"></i></button>
       <button class="btn btn-default btn-xs" data-add="extract" title="add current state"><i class="fa fa-file-o"></i></button>
       <button class="btn btn-default btn-xs" data-add="extract_all" title="add path to current state"><i class="fa fa-files-o"></i></button>
       </div>
       <div class="duration"><span>00:00</span><i class="fa fa-circle"></i></div>
      `);
    $p.selectAll('button[data-add]').on('click', function() {
      var create = this.dataset.add;
      const path =  provenance.toSlidePath(that.story);
      const last = path[path.length-1];
      switch(create) {
        case 'text':
          if (last) {
            that.data.moveSlide(that.data.makeTextSlide('Unnamed'), last, false);
          } else {
            that.story = that.data.startNewSlide('Welcome');
          }
          break;
        case 'extract':
          var state = that.data.selectedStates()[0] || that.data.act;
          let new_ = that.data.extractSlide([state], false);
          if (last) {
            that.data.moveSlide(new_, last, false);
          } else {
            that.story = new_;
          }
          break;
        case 'extract_all':
          var state2 = that.data.selectedStates()[0] || that.data.act;
          let new2_ = that.data.extractSlide(state2.path, false);
          if (last) {
            that.data.moveSlide(new2_, last, false);
          } else {
            that.story = new2_;
          }
          break;
      }
      that.update();
    });
  }

  private updateSelection() {
    const stories = this.data.getSlideChains();
    const $stories = this.$node.select('.dropdown-menu').selectAll('li').data(stories);
    $stories.enter().insert('li').append('a')
      .attr('href', '#').on('click', (d) => {
      this.switchTo(d);
      (<Event>d3.event).preventDefault();
    });
    $stories.select('a').text((d) => d.name);

    $stories.exit().remove();
  }


  update() {
    this.updateSelection();


    const story_raw =  provenance.toSlidePath(this.story);


    const story : ISlideNodeRepr[] = story_raw.length > 0 ? [{ id: 'f-1', i: -1, isPlaceholder: true, to: null}] : [];
    story_raw.forEach((s,i) => {
      story.push(s);
    });
    //duplicate the last placeholder
    story.push({ id: 'l'+(story_raw.length-1), i: story_raw.length-1, isPlaceholder: true, to: story_raw[story_raw.length-1], isLastPlaceholder: true});

    //this.$node.attr('width', (story.length * 70+4)*1.2);

    const to_id = (d) => String(d.id);

    const lod = getLevelOfDetail();

    this.$node
      .classed('large', lod  === LevelOfDetail.Large)
      .classed('medium', lod  === LevelOfDetail.Medium)
      .classed('small', lod  === LevelOfDetail.Small);
    this.$node.select('div.stories')
      .classed('large', lod  === LevelOfDetail.Large)
      .classed('medium', lod  === LevelOfDetail.Medium)
      .classed('small', lod  === LevelOfDetail.Small)
      .classed('no-thumbnails', !this.options.thumbnails);

    //var levelShift = [];
    //nodes.forEach((n: any) => levelShift[n.depth] = Math.min(levelShift[n.depth] || 10000, n.x));
    //nodes.forEach((n: any) => n.x -= levelShift[n.depth]);

    const $states = this.$node.select('div.stories').selectAll('div.story').data(story, to_id);

    const $states_enter = $states.enter().append('div').classed('story', true);
    const $story_enter = $states_enter.filter((d) => !d.isPlaceholder);
    const $placeholder_enter = $states_enter.filter((d) => d.isPlaceholder).classed('placeholder',true);

    $story_enter.call(this.storyInteraction.bind(this));
    $story_enter.append('div').classed('preview', true);
    $story_enter.append('div').classed('slabel', true);

    $story_enter.call(this.createToolbar.bind(this));
    $story_enter.append('div').classed('duration', true).html('<span></span><i class="fa fa-circle"></i>');
    $story_enter.append('div').classed('dragger', true)
      .call(this.changeDuration.bind(this))
      .call(this.dndSupport.bind(this));
    $story_enter.append('div').classed('dragger-transition', true)
      .call(this.changeTransition.bind(this));

    $placeholder_enter.call(this.dndSupport.bind(this));
    {
      let p = $placeholder_enter.filter((d) => d.isLastPlaceholder);
      p.call(this.createLastPlaceholder.bind(this));
    }
    $states.order();

    const $stories = $states.filter((d) => !d.isPlaceholder);
    $stories.classed('text', (d) => d.isTextOnly);
    $stories.attr('data-id', (d) => d.id);
    $stories.attr('title', (d) => d.name+'\n'+(d.transition > 0 ? '('+to_duration(d.transition)+')' : '')+'('+to_duration(d.duration)+')');
    //$stories.attr('data-toggle', 'tooltip');
    $stories.select('div.preview').style('background-image', lod < LevelOfDetail.Medium || !this.options.thumbnails ? null : ((d) => d.isTextOnly ? 'url(phovea_clue/assets/src/text.png)' : `url(${utils.thumbnail_url(this.data, d.state)})`));
    $stories.select('div.slabel').html((d) => d.name ? marked(d.name) : '');
    $stories.select('div.duration span').text((d, i) => `${to_duration(to_starting_time(d,story_raw))}`);
    $stories.style(this.options.wh, (d) => this.duration2pixel(d.duration)+'px');
    $stories.style('margin-'+this.options.topleft, (d) => this.duration2pixel(d.transition)-VerticalStoryVis.MIN_HEIGHT+'px');

    //const $placeholders = $states.filter((d) => d.isPlaceholder);

    $states.filter((d) => d.isLastPlaceholder).select('div.duration span').text(to_duration(to_starting_time(null, story_raw)));

    $states.exit().remove();
  }

  private updateTimeIndicator(slide: provenance.SlideNode, withTransition : boolean) {
    var $marker = this.$node.select('div.time_marker');
    if (!slide) {
      $marker.style('display','none');
      return;
    }
    const bounds = C.bounds(<any>(<Element>this.$node.node()).querySelector('div.story[data-id="'+slide.id+'"]'));
    const base = C.bounds(<any>(<Element>this.$node.node()).querySelector('div.stories'));
    //console.log(bounds, base, bounds.y - base.y);
    var t : any = $marker
      .transition().ease('linear')
      .duration(slide.transition < 0 || !withTransition ? player.MIN_TRANSITION : slide.transition*player.FACTOR)
      .style('top', (bounds.y-base.y) + 'px');

    t.transition().ease('linear')
      .duration(slide.duration < 0 || !withTransition ? player.MIN_DURATION : slide.duration*player.FACTOR)
      .style('top', (bounds.y-base.y+bounds.h-4) + 'px');


  }
}


export function create(data:provenance.ProvenanceGraph, parent: Element, options = {}) {
  return new VerticalStoryVis(data, parent, options);
}
