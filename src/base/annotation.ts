/**
 * Created by Samuel Gratzl on 15.10.2015.
 */

import {ModeWrapper} from './mode';
import * as d3 from 'd3';
import * as marked from 'marked';
import {StoryTransition} from './Player';
import {SlideNode, ProvenanceGraph, SelectionUtils, I18nextManager, IStateAnnotation, IFrameStateAnnotation, ITextStateAnnotation, IArrowStateAnnotation, ResolveNow} from 'phovea_core';
import {BaseUtils, AppContext} from 'phovea_core';

const modeFeatures = {
  isEditable: () => ModeWrapper.getInstance().getMode().authoring > 0.8
};

/**
 * place where the annotation is attached to an anchor
 */
enum EAnchorDirection {
  EAST, NORTH, WEST, SOUTH, NORTH_EAST, NORTH_WEST, SOUTH_EAST, SOUTH_WEST, CENTER
}

const anchor2string = (() => {
  const r = [];
  r[EAnchorDirection.EAST] = 'e';
  r[EAnchorDirection.NORTH] = 'n';
  r[EAnchorDirection.WEST] = 'w';
  r[EAnchorDirection.SOUTH] = 's';
  r[EAnchorDirection.NORTH_EAST] = 'ne';
  r[EAnchorDirection.NORTH_WEST] = 'nw';
  r[EAnchorDirection.SOUTH_EAST] = 'se';
  r[EAnchorDirection.SOUTH_WEST] = 'sw';
  r[EAnchorDirection.CENTER] = 'c';
  return r;
})();

const string2anchor = {
  e: EAnchorDirection.EAST,
  n: EAnchorDirection.NORTH,
  w: EAnchorDirection.WEST,
  s: EAnchorDirection.SOUTH,
  ne: EAnchorDirection.NORTH_EAST,
  nw: EAnchorDirection.NORTH_WEST,
  se: EAnchorDirection.SOUTH_EAST,
  sw: EAnchorDirection.SOUTH_WEST,
  c: EAnchorDirection.CENTER
};

/**
 * An anchor is a flexible position at a DOM element
 */
class Anchor {
  /**
   * position of the anchor
   * @type {null}
   * @private
   */
  private _pos: [number, number] = null;

  constructor(private elem: Element, private anchor: EAnchorDirection, lazy = false) {
    if (!lazy) {
      this._pos = this.compute();
    }
  }

  /**
   * returns the square distance of this anchor point to the given point
   * @param pos the current point
   * @returns {number} the square distance
   */
  distance(pos: [number, number]) {
    const p = this.pos;
    const dx = pos[0] - p[0];
    const dy = pos[1] - p[1];
    return dx * dx + dy * dy;
  }

  get pos() {
    return this._pos !== null ? this._pos : this.compute();
  }

  /**
   * checks wether the anchor position has changed and updates its position accordingly
   * @returns {boolean} true if there was a change
   */
  checkForPositionChange() {
    const old = this.pos;
    const newValue = this._pos = this.compute();
    return Math.abs(old[0] - newValue[0]) > 1 || Math.abs(old[1] - newValue[1]) > 1;
  }

  compute(): [number, number] {
    //start with the bounds
    const o = BaseUtils.bounds(this.elem);
    //add offset
    o.x += window.pageXOffset;
    o.y += window.pageYOffset;

    //select direction
    switch (this.anchor) {
      case EAnchorDirection.EAST:
        return [o.x, o.y + o.h / 2 - 3];
      case EAnchorDirection.NORTH:
        return [o.x + o.w / 2 - 3, o.y];
      case EAnchorDirection.WEST:
        return [o.x + o.w - 5, o.y + o.h / 2 - 3];
      case EAnchorDirection.SOUTH:
        return [o.x + o.w / 2 - 3, o.y + o.h - 5];
      case EAnchorDirection.NORTH_EAST:
        return [o.x, o.y];
      case EAnchorDirection.NORTH_WEST:
        return [o.x + o.w - 6, o.y];
      case EAnchorDirection.SOUTH_EAST:
        return [o.x, o.y + o.h - 5];
      case EAnchorDirection.SOUTH_WEST:
        return [o.x + o.w - 5, o.y + o.h - 5];
      default:
        return [o.x + o.w / 2 - 3, o.y + o.h / 2 - 3];
    }
  }

  /**
   * returns the ids identifying this anchor based on the data-anchor DOM attribute
   * @returns {string}
   */
  toString() {
    return this.elem.getAttribute('data-anchor') + '@' + anchor2string[this.anchor];
  }

  /**
   * converts the given encoded anchor string to its DOM element
   * @param s
   * @returns {Anchor}
   */
  static fromString(s: string, lazy = true) {
    const parts = s.split('@');
    const elem = <Element>document.querySelector('*[data-anchor="' + parts[0] + '"]');
    const anchor = string2anchor[parts[1]];
    return new Anchor(elem, anchor, lazy);
  }
}

class AnchorWatcher {
  private static UPDATE_INTERVALL = 100;

  private anchors: {anchor: Anchor, callback: () => void}[] = [];
  private intervall = -1;

  add(anchor: string, callback: () => void) {
    this.anchors.push({anchor: Anchor.fromString(anchor, false), callback});
    if (this.intervall < 0) {
      this.watch();
    }
  }

  private check() {
    this.anchors.forEach((entry) => {
      if (entry.anchor.checkForPositionChange()) {
        entry.callback();
      }
    });
  }

  private watch() {
    this.intervall = self.setInterval(this.check.bind(this), AnchorWatcher.UPDATE_INTERVALL);
  }

  clear() {
    if (this.intervall >= 0) {
      clearInterval(this.intervall);
      this.intervall = -1;
    }
    this.anchors = [];
  }
}


export class Renderer {
  private options = {
    /**
     * should animations for the annotations being used
     */
    animation: true,
    /**
     * animation duration
     */
    duration: 100,
    /**
     * should text annotations being rendered as markdown
     */
    markdown: true,
    /**
     * render a subtitle annotation containing the predefined content
     */
    renderSubtitle: false,
    /**
     * subtitle content
     */
    subtitlePattern: '${description}'
  };

  private prev = ResolveNow.resolveImmediately(null);

  private l = (event, state, type, op, extras) => this.render(state, extras.withTransition !== false);
  private updateAnnotations = () => this.renderAnnotationsImpl(this.act);
  private rerender = () => this.render(this.act, true, true);

  private act: SlideNode = null;

  private renderer = this.rendererImpl.bind(this);
  private anchorWatcher = new AnchorWatcher();

  constructor(private $main: d3.Selection<any>, private graph: ProvenanceGraph, options = {}) {
    BaseUtils.mixin(this.options, options);
    //update during slide change
    this.graph.on('select_slide_' + SelectionUtils.defaultSelectionType, this.l);
    //and mode change
    ModeWrapper.getInstance().on('modeChanged', this.rerender);

    AppContext.getInstance().onDOMNodeRemoved(<Element>$main.node(), this.destroy.bind(this));
  }

  /**
   * renders the given text by replacing variables and rendering markdown, then return the HTML code to display
   *
   * variables: usage: `${variable_name}`
   *  * name ... current slide name
   *  * description ... current slide description
   *  * duration ... current slide duration
   *  * slide_number ... current slide Index
   *  * state_name ... if the slide is associated with a state: its name
   *  * state_notes ... if the slide is associated with a state: its notes
   *  * action_name ... if the state was created by some action, its name
   *  * action_category ... the category of the action (data, vis,...)
   *  * action_operation ... the operation (create, update, delete)
   *  * action_user ... the user performed the operation
   *  * action_ts .. the date when the action was executed
   *
   * @param d the text to render
   * @returns {String}
   */
  private rendererImpl(d: string): string {
    if (modeFeatures.isEditable() && d.length === 0) {
      //return placeholder
      return `<i class="placeholder">${I18nextManager.getInstance().i18n.t('phovea:clue.annotationPlaceholder')}</i>`;
    }
    //replace variables within the text
    if (this.act) {
      //vars contains all possible variables
      const vars: any = {
        name: this.act.name,
        description: this.act.description,
        duration: this.act.duration,
        slide_number: this.act.slideIndex
      };
      const s = this.act.state;
      if (s) {
        vars.state_name = s.name;
        vars.state_notes = s.getAttr('notes');
        const a = s.creator;
        if (a) {
          const aa = a.meta;
          vars.action_name = aa.name;
          vars.action_category = aa.category;
          vars.action_operation = aa.operation;
          vars.action_user = aa.user;
          vars.action_ts = new Date(aa.timestamp);
        }
      }
      d = this.replaceVariables(d, vars);
    }
    return (this.options.markdown ? marked(d) : d);
  }

  private replaceVariables(d: string, vars: {[key: string]: string}) {
    return d.replace(/\$\{([^}]+)\}/gi, function (match, variable) {
      const r = vars[variable];
      if (r) {
        return r;
      }
      return '${' + variable + '}?';
    });
  }

  private destroy() {
    this.graph.off('select_slide_' + SelectionUtils.defaultSelectionType, this.l);

    ModeWrapper.getInstance().off('modeChanged', this.rerender);
  }

  render(state: SlideNode, withTransition = true, waitBetweenTakeDown = false) {
    if (this.act) {
      //disable annotation update listener
      this.act.off('push-annotations,attr-name,attr-duration', this.updateAnnotations);
    }
    //create full chain
    this.prev = this.prev.then(() => {
      //hide old annotations
      const takedown = this.hideOld();
      this.act = state;
      if (!state) {
        return takedown;
      }
      //listen to annotation changes
      this.act.on('push-annotations,attr-name,attr-duration', this.updateAnnotations);

      //no annotations should be shown
      if (ModeWrapper.getInstance().getMode().exploration > 0.8) {
        return takedown;
      }
      //wait 1sec till the previous annotations are removed
      return takedown.then(() => BaseUtils.resolveIn(waitBetweenTakeDown ? 1000 : 0)).then(() => {
        let next = ResolveNow.resolveImmediately(null);
        if (state.isTextOnly) { //no state jump
          next = this.renderText(state);
        } else {
          //jump to next state
          next = this.graph.jumpTo(state.state, state.transition <= 0 || !withTransition ? StoryTransition.MIN_TRANSITION : state.transition * StoryTransition.FACTOR);
        }
        //wait till next is done before rendering annotations
        return next.then(() => {
          const all = [this.renderAnnotations(state)];
          if (this.options.renderSubtitle) {
            all.push(this.renderSubtitle(state));
          }
          return Promise.all(all);
        });
      });
    });
    return this.prev;
  }

  /**
   * renders anchor hits
   * @param bounds the parent bounds where the anchors are rendered into
   */
  private renderAnchors(bounds: {x: number, y: number, w: number, h: number}) {
    const mainNode = <Element>this.$main.node();
    const anchorElements: Element[] = [].slice.apply(mainNode.querySelectorAll('*[data-anchor]'));
    if (mainNode.getAttribute('data-anchor') != null) {
      anchorElements.push(mainNode);
    }

    const anchors: Anchor[] = [];
    //create anchors
    anchorElements.forEach((a) => {
      const b = BaseUtils.bounds(a);
      if (b.w * b.h < 50 * 50) { //area to small for higher details
        anchors.push(new Anchor(a, EAnchorDirection.CENTER));
      } else {
        anchors.push.apply(anchors, Object.keys(string2anchor).map((s) => new Anchor(a, string2anchor[s])));
      }
    });
    const $anchors = this.$main.selectAll('div.annotation-anchor').data(anchors);
    $anchors.enter().append('div').classed('annotation-anchor', true);

    $anchors.style({
      display: null,
      left: (d) => (d.pos[0] + -bounds.x) + 'px',
      top: (d) => (d.pos[1] - bounds.y) + 'px',
    });
    $anchors.exit().remove();
  }

  /**
   * updates all anchors by computing the one with the minimal distance and highlight it
   * @param pos current position
   * @param bounds bounds of the parent element containing the anchors
   * @returns {any}
   */
  private updateAnchor(pos: [number, number], bounds: {x: number, y: number, w: number, h: number}): any {
    const $anchors = this.$main.selectAll<Anchor>('div.annotation-anchor');
    if ($anchors.empty()) { //no anchors
      return null;
    }
    const abspos: [number, number] = [pos[0] + bounds.x, pos[1] + bounds.y];
    let minV = Number.POSITIVE_INFINITY,
      minAnchor: Anchor = null;
    $anchors.each((d) => {
      const distance = d.distance(abspos);
      if (distance < minV) {
        minAnchor = d;
        minV = distance;
      }
    });
    $anchors.classed('closest', (d, i) => d === minAnchor);
    if (minAnchor) {
      return {
        anchor: minAnchor.toString(),
        offset: [abspos[0] - minAnchor.pos[0], abspos[1] - minAnchor.pos[1]]
      };
    }
    //no anchor relative version
    return [pos[0] * 100 / bounds.w, pos[1] * 100 / bounds.h];
  }

  private removeAnchors() {
    this.$main.selectAll('div.annotation-anchor').style('display', 'none').remove();
  }

  private renderAnnotationsImpl(state: SlideNode) {
    const that = this;
    const editable = modeFeatures.isEditable() && state != null;

    const $anns = this.$main.selectAll('div.annotation').data(state ? state.annotations : [], (d, i) => state.id + '@' + d.type + i);
    const $annsEnter = $anns.enter().append('div')
      .attr('class', (d) => d.type + '-annotation annotation');

    const bounds = BaseUtils.bounds(<Element>this.$main.node());

    function updatePos(d: IStateAnnotation) {
      const elem = <HTMLElement>this;
      const p: any = d.pos;
      if (Array.isArray(p)) { //relative
        elem.style.left = p[0] + '%';
        elem.style.top = p[1] + '%';
      } else { //anchor based
        const anchor = Anchor.fromString(p.anchor);
        const base = anchor.pos;
        elem.style.left = (base[0] - bounds.x) + p.offset[0] + 'px';
        elem.style.top = (base[1] - bounds.y) + p.offset[1] + 'px';
      }
    }

    this.anchorWatcher.clear();

    function watchAnchor(d: IStateAnnotation) {
      const p: any = d.pos;
      if (!Array.isArray(p)) {
        that.anchorWatcher.add(p.anchor, () => updatePos.call(this, d));
      }
    }

    function updateSize(d: IFrameStateAnnotation) {
      const elem = <HTMLElement>this;
      const p: any = d.pos2;
      if (p) { //anchor based
        const base = Anchor.fromString(p.anchor).pos;
        const pos = Anchor.fromString((<any>d.pos).anchor).pos;
        elem.style.width = (base[0] + p.offset[0] - pos[0] - (<any>d.pos).offset[0]) + 'px';
        elem.style.height = (base[1] + p.offset[1] - pos[1] - (<any>d.pos).offset[1]) + 'px';
      } else {
        const size = d.size;
        elem.style.width = size[0] + '%';
        elem.style.height = size[1] + '%';
      }
    }
    function watchSizeAnchor(d: IFrameStateAnnotation) {
      const p: any = d.pos2;
      if (p) {
        that.anchorWatcher.add(p.anchor, () => updateSize.call(this, d));
      }
    }

    //move
    $annsEnter.append('button').attr('tabindex', -1).attr('class', 'btn btn-light btn-sm fas fa-arrows-alt').call(d3.behavior.drag()
      //.origin((d:prov.IStateAnnotation) => ({x: d.pos[0], y: d.pos[1]}))
      .on('dragstart', function (d: IStateAnnotation, i) {
        that.renderAnchors(bounds);
      })
      .on('dragend', that.removeAnchors.bind(that))
      .on('drag', function (d: IStateAnnotation, i) {
        const mouse = d3.mouse(this.parentNode.parentNode);
        d.pos = that.updateAnchor(mouse, bounds);
        state.updateAnnotation(d);
        d3.select(this.parentNode).each(updatePos);
      }));

    //remove
    $annsEnter.append('button').attr('tabindex', -1).attr('class', 'btn btn-light btn-sm fas fa-times')
      .on('click', function (d: IStateAnnotation, i) {
        d3.select(this.parentNode).remove();
        state.removeAnnotationElem(d);
        (<Event>d3.event).preventDefault();
      });


    //Text
    $anns.filter((d) => d.type === 'text' || !d.hasOwnProperty('type')).call(($texts: d3.selection.Update<ITextStateAnnotation>, $textsEnter: d3.selection.Update<ITextStateAnnotation>) => {

      const onEdit = function (d: ITextStateAnnotation, i) {
        const $elem = d3.select(this);
        if (!d3.select(this.parentNode).classed('editable')) {
          return;
        }
        $elem.on('click', null);
        $elem.append('textarea').property('value', d.text).on('blur', function () {
          d.text = this.value;
          state.updateAnnotation(d);
          //update value and enable edit click handler again
          $elem.html(that.renderer(this.value)).on('click', onEdit);
        });
      };
      $textsEnter.append('div').classed('text', true).on('click', onEdit);

      $texts.select('div.text').html((d) => this.renderer(d.text)).style({
        width: (d: ITextStateAnnotation) => d.size ? d.size[0] + 'px' : null,
        height: (d: ITextStateAnnotation) => d.size ? d.size[1] + 'px' : null,
      }).each(function (d) {
        if (d.styles) {
          d3.select(this).style(d.styles);
        }
      });
    }, $annsEnter.filter((d) => d.type === 'text' || !d.hasOwnProperty('type')));


    //Arrow
    $anns.filter((d) => d.type === 'arrow').call(($arrows: d3.selection.Update<IArrowStateAnnotation>, $arrowsEnter: d3.selection.Update<IArrowStateAnnotation>) => {
      const $svgEnter = $arrowsEnter.insert('svg', ':first-child').attr({
        width: (d) => 30 + Math.abs(d.at[0]),
        height: (d) => 30 + Math.abs(d.at[1])
      }).style({
        left: (d) => (-15 + Math.min(0, d.at[0])) + 'px',
        top: (d) => (-15 + Math.min(0, d.at[1])) + 'px'
      });
      $svgEnter.append('defs').append('marker').attr({
        id: (d, i) => 'clue_text_arrow_marker' + i,
        viewBox: '0 0 10 10',
        refX: 6,
        refY: 5,
        markerWidth: 4,
        markerHeight: 3,
        markerUnits: 'strokeWidth',
        orient: 'auto'
      }).append('path').attr('d', 'M 0 0 L 10 5 L 0 10 z');
      $svgEnter.append('g').append('line').classed('arrow', true).attr({
        'marker-end': (d, i) => 'url(#clue_text_arrow_marker' + i + ')'
      });

      const $svg = $arrows.select('svg');

      function updateShift() {
        $svg.attr({
          width: (d) => 30 + Math.abs(d.at[0]),  //TODO (50) + xminmax[1] - xminmax[0],
          height: (d) => 30 + Math.abs(d.at[1]) //TODO yminmax[1] - yminmax[0],
        }).style({
          left: (d) => (-15 + Math.min(0, d.at[0])) + 'px',
          top: (d) => (-15 + Math.min(0, d.at[1])) + 'px'
        });
        $svg.select('g').attr('transform', (d) => `translate(${-Math.min(0, d.at[0]) + 15},${-Math.min(0, d.at[1]) + 15})`);
      }

      $svgEnter.select('g').append('circle').classed('anchor', true).attr('r', 5);
      $svg.select('circle').style({
        cx: (d) => d.at[0],
        cy: (d) => d.at[1]
      }).call(d3.behavior.drag()
        .on('drag', function (d: IArrowStateAnnotation, i) {
          const e: any = d3.event;
          d.at = [e.x, e.y];
          state.updateAnnotation(d);
          d3.select(this).style({
            cx: d.at[0],
            cy: d.at[1]
          });
          $svg.select('line[data-index="' + i + '"]').attr({
            x2: d.at[0],
            y2: d.at[1]
          });
          updateShift();
        }));
      updateShift();
      $svg.select('line').attr({
        'data-index': (d, i) => i,
        x2: (d) => d.at[0],
        y2: (d) => d.at[1]
      }).each(function (d) {
        if (d.styles) {
          d3.select(this).style(d.styles);
        }
      });
    }, $annsEnter.filter((d) => d.type === 'arrow'));

    //FRAME
    $anns.filter((d) => d.type === 'frame').call(($frames: d3.selection.Update<IFrameStateAnnotation>, $framesEnter: d3.selection.Update<IFrameStateAnnotation>) => {
      $frames.each(function (d) {
        updateSize.call(this, d);
        watchSizeAnchor.call(this, d);
        if (d.styles) {
          d3.select(this).style(d.styles);
        }
      });

      //resize
      $framesEnter.append('button').attr('tabindex', -1).attr('class', 'btn btn-light btn-sm fas fa-expand fa-flip-horizontal')
        .call(d3.behavior.drag()
          .on('dragstart', function (d: IStateAnnotation, i) {
            that.renderAnchors(bounds);
          })
          .on('dragend', that.removeAnchors.bind(that))
          .on('drag', function (d: IFrameStateAnnotation, i) {
            const mouse = d3.mouse(this.parentNode.parentNode);
            d.pos2 = that.updateAnchor(mouse, bounds);
            state.updateAnnotation(d);
            d3.select(this.parentNode).each(updateSize);
          }));

    }, $annsEnter.filter((d) => d.type === 'frame'));

    $anns.each(updatePos).each(watchAnchor).classed('editable', editable);

    $anns.exit().remove();

    return $anns;
  }

  renderAnnotations(state: SlideNode) {
    return new Promise((resolve) => {
      const $anns = this.renderAnnotationsImpl(state);
      if (this.options.animation && !$anns.empty() && this.options.duration > 0) {
        $anns.style('opacity', 0).transition().duration(this.options.duration).style('opacity', 1);
        BaseUtils.resolveIn(this.options.duration + 10).then(() => resolve($anns.node()));
      } else {
        $anns.style('opacity', 1);
        resolve($anns.node());
      }
    });
  }


  hideOld() {
    return new Promise((resolve) => {
      this.anchorWatcher.clear();
      const $div = this.$main.classed('hide-all-non-annotations', false).selectAll('div.annotation, div.text-overlay, div.add-text-annotation, div.subtitle-annotation');
      if (this.options.animation && !$div.empty() && this.options.duration > 0) {
        $div.transition().duration(this.options.duration).style('opacity', 0).remove();
        BaseUtils.resolveIn(this.options.duration + 10).then(() => resolve());
      } else {
        $div.remove();
        resolve();
      }
    });
  }

  renderSubtitle(overlay: SlideNode) {
    return new Promise((resolve) => {
      this.$main.append('div').attr('class', 'subtitle-annotation').html(this.renderer(this.options.subtitlePattern));
      resolve(this.$main.node());
    });
  }

  renderText(overlay: SlideNode) {
    const t = overlay.transition * StoryTransition.FACTOR;
    return BaseUtils.resolveIn(t).then(() => {
      this.$main.classed('hide-all-non-annotations', true);
      return this.$main.node();
    });
  }

  static createAnnotation(main: HTMLElement, graph: ProvenanceGraph) {
    const instance = new Renderer(d3.select(main), graph);
    return {
      render: instance.render.bind(instance)
    };
  }
}
