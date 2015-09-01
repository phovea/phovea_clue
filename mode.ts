/**
 * Created by Samuel Gratzl on 01.09.2015.
 */
/// <reference path="../../tsd.d.ts" />

import d3 = require('d3');
import C = require('../caleydo_core/main');
import events = require('../caleydo_core/event');

export enum ECLUEMode {
  Exploration = 0,
  Selection = 1,
  Browsing = 2,
  Interactive_Story = 3,
  Presentation = 4
}

const num_modes = 5;

export const modes = {
  E: ECLUEMode.Exploration,
  S: ECLUEMode.Selection,
  B: ECLUEMode.Browsing,
  I: ECLUEMode.Interactive_Story,
  P: ECLUEMode.Presentation
};

function defaultMode(): ECLUEMode {
  var key = C.hash.getProp('clue', 'P');
  return modes[key] || ECLUEMode.Presentation;
}

class ModeWrapper extends events.EventHandler {
  private _mode = defaultMode();

  constructor() {
    super();
    events.fire('clue.modeChanged', this._mode, this._mode);
  }

  set mode(value: ECLUEMode) {
    if (this._mode === value) {
      return;
    }
    var bak = this._mode;
    this._mode = value;
    C.hash.setProp('clue', ECLUEMode[value].substring(0,1));
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

export function getMode() {
  return _instance.mode;
}
export function setMode(value: ECLUEMode) {
  _instance.mode = value;
}

export class ModeSelector {
  private options = {

  };
  private $node:d3.Selection<ModeSelector>;

  constructor(parent:Element, options:any = {}) {
    C.mixin(this.options, options);
    this.$node = d3.select(parent).append('div').classed('clue_modeselector', true).datum(this);
    this.build(this.$node);

    const $input = this.$node.select('input').on('input', function() {
      var new_mode = parseInt(this.value);
      setMode(new_mode);
    });
    const listener = (event: events.IEvent, new_: ECLUEMode) => {
      $input.property('value', new_);
    };
    _instance.on('modeChanged', listener);
    C.onDOMNodeRemoved(<Element>this.$node.node(), () => {
      _instance.off('modeChanged', listener);
    });
  }

  private build($node: d3.Selection<any>) {
    $node.append('input').attr({
      type: 'range',
      min: 0,
      max: num_modes-1,
      value: getMode(),
      list: 'clue_modelist'
    });
    $node.append('span').classed('e',true).text(ECLUEMode[ECLUEMode.Exploration]);
    $node.append('span').classed('p',true).style('float','right').text(ECLUEMode[ECLUEMode.Presentation]);
    let $options = $node.append('datalist').attr({
      id: 'clue_modelist'
    }).selectAll('option').data(d3.range(num_modes));
    $options.enter().append('option');
    $options.attr({
      value: (d, i) => d
    }).text(String);
  }
}

export function create(parent:Element, options:any = {}) {
  return new ModeSelector(parent, options);
}