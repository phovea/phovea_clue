/**
 * Created by Samuel Gratzl on 01.09.2015.
 */


import * as d3 from 'd3';
import * as C from 'phovea_core/src/index';
import * as events from 'phovea_core/src/event';

/**
 * normalizes the given coordinates to sum up to one
 * @param arr
 * @returns {any}
 */
function normalize(arr:[number, number, number]):[number, number, number] {
  const sum = arr.reduce((a, b) => a + b, 0);
  return <[number, number, number]>arr.map((i) => i / sum);
}

/**
 * generic version of the CLUE mode, a combination of exploration, authoring, and normalization
 */
export class CLUEMode {
  private coord:[number, number, number];

  constructor(exploration:number, authoring:number, presentation:number) {
    this.coord = normalize([exploration, authoring, presentation]);
  }

  get exploration() {
    return this.coord[0];
  }

  get authoring() {
    return this.coord[1];
  }

  get presentation() {
    return this.coord[2];
  }

  value(index:number|string):number {
    if (typeof index === 'number') {
      return this.coord[index];
    } else if (typeof index === 'string') {
      let lookup = {e: this.coord[0], a: this.coord[1], p: this.coord[2]};
      return lookup[index.charAt(0).toLowerCase()];
    }
    return null;
  }

  /**
   * whether this mode is extreme, i.e., in one corner of the triangle
   * @returns {boolean}
   */
  get isAtomic() {
    return this.exploration === 1.0 || this.authoring === 1.0 || this.presentation === 1.0;
  }

  toString() {
    if (this.exploration === 1) {
      return 'E';
    }
    if (this.authoring === 1) {
      return 'A';
    }
    if (this.presentation === 1) {
      return 'P';
    }
    return '(' + this.coord.map((s) => d3.round(s, 3).toString()).join('-') + ')';
  }
}

/**
 * mode factory by the given components
 * @param exploration
 * @param authoring
 * @param presentation
 * @returns {CLUEMode}
 */
function mode(exploration:number, authoring:number, presentation:number) {
  return new CLUEMode(exploration, authoring, presentation);
}

/**
 * shortcuts for the atomic modes
 * @type {{Exploration: CLUEMode, Authoring: CLUEMode, Presentation: CLUEMode}}
 */
export const modes = {
  Exploration: mode(1, 0, 0),
  Authoring: mode(0, 1, 0),
  Presentation: mode(0, 0, 1)
};

function fromString(s:string) {
  if (s === 'P') {
    return modes.Presentation;
  } else if (s === 'A') {
    return modes.Authoring;
  } else if (s === 'E') {
    return modes.Exploration;
  }
  let coords = s.slice(1, s.length - 1).split('-').map(parseFloat);
  return new CLUEMode(coords[0], coords[1], coords[2]);
}

/**
 * returns the default mode either stored in the hash or by default exploration
 */
function defaultMode():CLUEMode {
  return fromString(C.hash.getProp('clue', 'E'));
}

/**
 * wrapper containing the current mode
 */
class ModeWrapper extends events.EventHandler {
  private _mode = defaultMode();

  constructor() {
    super();
    events.fire('clue.modeChanged', this._mode, this._mode);
  }

  set mode(value:CLUEMode) {
    if (this._mode === value) {
      return;
    }
    if (value.isAtomic) {
      //use the real atomic one for a shared instance
      value = fromString(value.toString());
    }
    var bak = this._mode;
    this._mode = value;
    //store in hash
    C.hash.setProp('clue', value.toString());
    this.fire('modeChanged', value, bak);
    events.fire('clue.modeChanged', value, bak);
  }

  get mode() {
    return this._mode;
  }
}
var _instance = new ModeWrapper();

export var on = ModeWrapper.prototype.on.bind(_instance);
export var off = ModeWrapper.prototype.off.bind(_instance);

/**
 * returns the current mode
 * @returns {CLUEMode}
 */
export function getMode() {
  return _instance.mode;
}
/**
 * set the mode
 * @param value
 */
export function setMode(value:CLUEMode) {
  _instance.mode = value;
}

/**
 * utility to select the mode using three buttons to the atomic versions using bootstrap buttons
 */
export class ButtonModeSelector {
  private options = {
    /**
     * button size, i.e. the class btn-{size] will be added
     */
    size: 'xs'
  };
  private $node:d3.Selection<ButtonModeSelector>;

  constructor(parent:Element, options:any = {}) {
    C.mixin(this.options, options);
    this.$node = this.build(d3.select(parent));

    const listener = (event:events.IEvent, new_:CLUEMode) => {
      this.$node.selectAll('label').classed('active', (d) => d === new_).select('input').property('checked', (d) => d === new_);
    };
    _instance.on('modeChanged', listener);
    C.onDOMNodeRemoved(<Element>this.$node.node(), () => {
      _instance.off('modeChanged', listener);
    });
  }

  private build($parent:d3.Selection<any>) {
    var $root = $parent.append('div').classed('clue_buttonmodeselector', true).classed('btn-group', true).attr('data-toggle', 'buttons');
    var $modes = $root.selectAll('label').data([modes.Exploration, modes.Authoring, modes.Presentation]);
    $modes.enter().append('label')
      .attr('class', (d) => 'btn btn-' + this.options.size + ' clue-' + d.toString())
      .classed('active', (d) => d === getMode())
      .html((d, i) => {
        const label = ['Exploration', 'Authoring', 'Presentation'][i];
        return `<input type="radio" name="clue_mode" autocomplete="off" value="${d.toString()}" ${d === getMode() ? 'checked="checked"' : ''}> ${label}`;
      }).on('click', (d) => {
      setMode(d);
    });
    return $root;
  }
}

/**
 * mode selector based on three sliders for each dimensions that are synced
 */
export class SliderModeSelector {
  private options = {};
  private $node:d3.Selection<SliderModeSelector>;

  constructor(parent:Element, options:any = {}) {
    C.mixin(this.options, options);
    this.$node = d3.select(parent).append('div').classed('clue_modeselector', true).datum(this);
    this.build(this.$node);

    const listener = (event:events.IEvent, new_:CLUEMode) => {
      this.$node.select('label.clue-E input').property('value', Math.round(new_.exploration * 100));
      this.$node.select('label.clue-A input').property('value', Math.round(new_.authoring * 100));
      this.$node.select('label.clue-P input').property('value', Math.round(new_.presentation * 100));
    };
    _instance.on('modeChanged', listener);
    C.onDOMNodeRemoved(<Element>this.$node.node(), () => {
      _instance.off('modeChanged', listener);
    });
  }

  private build($parent:d3.Selection<any>) {
    var $root = $parent.append('div').classed('clue_slidermodeselector', true);
    var $modes = $root.selectAll('label').data([modes.Exploration, modes.Authoring, modes.Presentation]);

    function normalize(eap:[number,number,number], driven_by:number) {
      const base = eap[driven_by];
      eap[driven_by] = 0;
      var factor = (1 - base) / d3.sum(eap);
      eap = <[number,number,number]>eap.map((v) => v * factor);
      eap[driven_by] = base;
      return eap;
    }

    function updateMode(driven_by = -1) {
      var e = parseFloat($modes.select('label.clue-E input').property('value')) / 100;
      var a = parseFloat($modes.select('label.clue-A input').property('value')) / 100;
      var p = parseFloat($modes.select('label.clue-P input').property('value')) / 100;
      if (driven_by >= 0) {
        [e, a, p] = normalize([e, a, p], driven_by);
      }
      setMode(mode(e, a, p));
    }

    $modes.enter().append('label')
      .attr('class', (d) => 'clue-' + d.toString())
      .text((d, i) => ['Exploration', 'Authoring', 'Presentation'][i])
      .append('input')
      .attr({
        type: 'range',
        min: 0,
        max: 100,
        value: (d, i) => getMode().value(i) * 100
      }).on('input', (d, i) => {
      updateMode(i);
    });
    return $root;
  }
}

/**
 * mode selector based on a triangle
 */
export class TriangleModeSelector {
  private options = {
    /**
     * height of the triangle
     */
    height: 15,
    /**
     * offset bounds
     */
    offset: 5
  };
  private $node:d3.Selection<TriangleModeSelector>;

  private e = [0, 30];
  private a = [30, 0];
  private p = [60, 30];

  constructor(parent:Element, options:any = {}) {
    C.mixin(this.options, options);
    this.e[1] = this.a[0] = this.p[1] = this.options.height;
    this.p[0] = this.options.height * 2;
    this.$node = d3.select(parent).append('div').classed('clue_trianglemodeselector', true).datum(this);
    this.build(this.$node);

    const listener = (event:events.IEvent, new_:CLUEMode) => {
      let c = this.toCoordinates(new_);
      this.$node.select('circle.point').attr({
        cx: c[0],
        cy: c[1]
      });
    };
    _instance.on('modeChanged', listener);
    C.onDOMNodeRemoved(<Element>this.$node.node(), () => {
      _instance.off('modeChanged', listener);
    });
  }

  private toCoordinates(m:CLUEMode) {
    let x = m.exploration * this.e[0] + m.authoring * this.a[0] + m.presentation * this.p[0];
    let y = m.exploration * this.e[1] + m.authoring * this.a[1] + m.presentation * this.p[1];
    return [x, y];
  }

  private fromCoordinates(x:number, y:number) {
    //https://en.wikipedia.org/wiki/Barycentric_coordinate_system
    const x1 = this.e[0], x2 = this.a[0], x3 = this.p[0], y1 = this.e[1], y2 = this.a[1], y3 = this.p[1];
    let e = Math.max(0, Math.min(1, ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / ((y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3))));
    let a = Math.max(0, Math.min(1, ((y3 - y3) * (x - x3) + (x1 - x3) * (y - y3)) / ((y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3))));
    let s = e + a;
    if (s > 1) {
      e /= s;
      a /= s;
    }
    let p = 1 - e - a;
    return mode(e, a, p);
  }

  private build($parent:d3.Selection<any>) {
    var $root = $parent.append('svg').classed('clue_trianglemodeselector', true).attr({
      width: this.p[0] + this.options.offset,
      height: this.p[1] + this.options.offset
    });
    const that = this;
    const $g = $root.append('g').attr('transform', `translate(${this.options.offset / 2},${this.options.offset / 2})`);
    $g.append('path').attr('d', d3.svg.line<number[]>().interpolate('linear-closed')([this.e, this.a, this.p])).on('click', function () {
      const xy = d3.mouse(this);
      var m = that.fromCoordinates(xy[0], xy[1]);
      setMode(m);
    });
    var xy = this.toCoordinates(getMode());
    $g.append('circle').classed('point', true).attr({
      cx: xy[0],
      cy: xy[1],
      r: 2
    }).call(d3.behavior.drag().on('drag', () => {
      var m = this.fromCoordinates((<MouseEvent>d3.event).x, (<MouseEvent>d3.event).y);
      setMode(m);
    }));
    return $root;
  }
}

/**
 * alias for `createTriangle`
 * @param parent the parent dom element
 * @param options
 * @returns {TriangleModeSelector}
 */
export function create(parent:Element, options:any = {}) {
  return createTriangle(parent, options);
}
export function createTriangle(parent:Element, options:any = {}) {
  return new TriangleModeSelector(parent, options);
}
export function createButton(parent:Element, options:any = {}) {
  return new ButtonModeSelector(parent, options);
}
export function createSlider(parent:Element, options:any = {}) {
  return new SliderModeSelector(parent, options);
}
