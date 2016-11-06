/**
 * Created by Samuel Gratzl on 27.08.2015.
 */

import * as provenance from 'phovea_core/src/provenance';
import * as C from 'phovea_core/src/index';
import * as d3 from 'd3';

export const FACTOR = 1;
export const MIN_DURATION = -1;
export const MIN_TRANSITION = -1;

/**
 * story player interface and logic
 */
export class Player {
  private anim = -1;

  private options = {
    //default animation step duration
    step: 1000
  };

  private $play:d3.Selection<any>;

  constructor(private graph:provenance.ProvenanceGraph, controls:Element, options:any = {}) {
    C.mixin(this.options, options);

    var $controls = d3.select(controls);
    var that = this;

    this.$play = $controls.select('[data-player="play"]').on('click', function () {
      var $i = d3.select(this);
      if ($i.classed('fa-play') && that.start()) {
        $i.classed('fa-play', false).classed('fa-pause', true);
      } else {
        that.pause();
        $i.classed('fa-play', true).classed('fa-pause', false);
      }
    });

    $controls.select('[data-player="stop"]').on('click', function () {
      that.stop();
    });
    $controls.select('[data-player="forward"]').on('click', function () {
      that.forward();
    });
    $controls.select('[data-player="backward"]').on('click', function () {
      that.backward();
    });

    d3.select(document).on('keydown.playpause', () => {
      let k = <KeyboardEvent>d3.event;
      //pause key
      if (k.keyCode === 19) {
        k.preventDefault();
        //fake a click event
        var event = <MouseEvent>document.createEvent('MouseEvents');
        event.initMouseEvent('click', /* type */
          true, /* canBubble */
          true, /* cancelable */
          window, /* view */
          0, /* detail */
          0, /* screenX */
          0, /* screenY */
          0, /* clientX */
          0, /* clientY */
          false, /* ctrlKey */
          false, /* altKey */
          false, /* shiftKey */
          false, /* metaKey */
          0, /* button */
          null /* relatedTarget */
        );
        this.$play.node().dispatchEvent(event);
      }
    });
  }

  start() {
    const l = this.graph.getSlideChains();
    const act = this.graph.selectedSlides()[0] || l[l.length - 1];
    if (act) {
      this.render(act).then(() => {
        this.anim = setTimeout(this.next.bind(this), act.duration * FACTOR);
      });
      return true;
    } else {
      return false;
    }
  }

  render(story:provenance.SlideNode) {
    //render by selecting the slide
    this.graph.selectSlide(story);
    //TODO transition time
    return Promise.resolve(story);
  }

  private stopAnim() {
    if (this.anim >= 0) {
      clearTimeout(this.anim);
      this.anim = -1;
    }
  }

  stop() {
    this.stopAnim();
    this.render(null).then(() => {
      this.$play.classed('fa-play', true).classed('fa-pause', false);
    });
  }

  pause() {
    this.stopAnim();
  }

  /**
   * renders the next slide in an animated fashion
   */
  private next() {
    var r = this.forward();
    if (r) {
      r.then((act) => {
        this.anim = setTimeout(this.next.bind(this), act.duration * FACTOR);
      });
    }
  }

  /**
   * jumps to the next slide
   * @returns {any}
   */
  forward() {
    this.stopAnim();
    const current = this.graph.selectedSlides()[0];
    const act = current.next;
    if (act == null) {
      this.stop();
      return null;
    } else {
      return this.render(act);
    }
  }

  /**
   * jumps to the previous slide
   * @returns {any}
   */
  backward() {
    this.stopAnim();
    const current = this.graph.selectedSlides()[0];
    const act = current.previous;
    if (act == null) {
      this.stop();
      return null;
    } else {
      return this.render(act);
    }
  }
}
