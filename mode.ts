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

export var modes = {
  E : ECLUEMode.Exploration,
  S : ECLUEMode.Selection,
  B: ECLUEMode.Browsing,
  I: ECLUEMode.Interactive_Story,
  P : ECLUEMode.Presentation
};

export var modesByIndex = [ECLUEMode.Exploration, ECLUEMode.Selection, ECLUEMode.Browsing, ECLUEMode.Interactive_Story, ECLUEMode.Presentation];

function defaultMode(): ECLUEMode {
  var key = C.hash.getProp('clue', 'P');
  return modes[key] || ECLUEMode.Presentation;
}

var _mode = defaultMode();

export function getMode() {
  return _mode;
}

export function setMode(value: ECLUEMode) {
  if (_mode === value) {
    return;
  }
  var bak = _mode;
  _mode = value;
  C.hash.setProp('clue', ECLUEMode[value].substring(0,1));
  events.fire('clue.modeChanged', value, bak);
}

export class ModeSelector {
  private options = {

  };
  private $node:d3.Selection<ModeSelector>;

  constructor(parent:Element, options:any = {}) {
    var that = this;
    C.mixin(this.options, options);
    this.$node = d3.select(parent).append('div').classed('clue_modeselector', true).datum(this);
    this.build(this.$node);

    var $input = this.$node.select('input').on('change', function() {
      var new_mode = this.value;
      setMode(modesByIndex[new_mode]);
    });
    var listener = (event: events.IEvent, new_: ECLUEMode) => {
      $input.property('value', new_);
    };
    events.on('clue.modeChanged', listener);
    C.onDOMNodeRemoved(<Element>this.$node.node(), () => {
      events.off('clue.modeChanged', listener);
    });
  }

  private build($node: d3.Selection<any>) {
    $node.append('input').attr({
      type: 'range',
      min: 0,
      max: modesByIndex.length-1,
      value: getMode(),
      list: 'clue_modelist'
    });
    $node.append('span').classed('e',true).text(ECLUEMode[ECLUEMode.Exploration]);
    $node.append('span').classed('p',true).style('float','right').text(ECLUEMode[ECLUEMode.Presentation]);
    var $options = $node.append('datalist').attr({
      id: 'clue_modelist'
    }).selectAll('option').data(modesByIndex);
    $options.enter().append('option');
    $options.attr({
      value: (d, i) => d
    }).text(String);
  }
}

export function create(parent:Element, options:any = {}) {
  return new ModeSelector(parent, options);
}