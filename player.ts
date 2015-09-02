/**
 * Created by Samuel Gratzl on 27.08.2015.
 */

import provenance = require('../caleydo_provenance/main');
import C = require('../caleydo_core/main');
import d3 = require('d3');

export class Player {
  private route:provenance.StateNode[] = null;
  private act = 0;
  private anim = -1;

  private options = {
    step: 1000
  };

  private $play:d3.Selection<any>;

  constructor(private graph:provenance.ProvenanceGraph, controls:Element, options:any = {}) {
    C.mixin(this.options, options);

    var $controls = d3.select(controls);
    var that = this;
    this.$play = $controls.select('[data-player="play"]').on('click', function () {
      var $i = d3.select(this).select('i');
      if ($i.classed('fa-play')) {
        that.start();
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
  }

  start() {
    this.route = this.graph.act.path;
    this.act = 0;
    this.graph.jumpTo(this.route[this.act]);
    this.anim = setInterval(this.next.bind(this), this.options.step);
  }

  stop() {
    if (this.anim >= 0) {
      clearInterval(this.anim);
      this.anim = -1;
      this.act = 0;
      this.route = null;
      this.$play.select('i').classed('fa-play', true).classed('fa-pause', false);
    }
  }

  pause() {
    if (this.anim >= 0) {
      clearTimeout(this.anim);
      this.anim = -1;
    } else {
      this.anim = setInterval(this.next.bind(this), this.options.step);
    }
  }

  private next() {
    this.act += 1;
    if (this.act < this.route.length) {
      this.graph.jumpTo(this.route[this.act]);
    } else {
      this.stop();
    }
  }

  forward() {
    if (this.route !== null) {
      this.next();
    } else {
      var n = this.graph.act.nextState;
      if (n) {
        this.graph.jumpTo(n);
      }
    }
  }

  backward() {
    if (this.route !== null) {
      this.act -= 1;
      if (this.act >= 0) {
        this.graph.jumpTo(this.route[this.act]);
      }
    } else {
      var n = this.graph.act.previousState;
      if (n) {
        this.graph.jumpTo(n);
      }
    }
  }
}
