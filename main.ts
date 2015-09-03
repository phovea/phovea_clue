/**
 * Created by Samuel Gratzl on 27.08.2015.
 */
/// <amd-dependency path='font-awesome' />
/// <amd-dependency path='bootstrap' />

import datatypes = require('../caleydo_core/datatype');
import C = require('../caleydo_core/main');
import prov = require('../caleydo_provenance/main');
import player = require('./player');
import d3 = require('d3');
import $ = require('jquery');
import cmds = require('./cmds');

var a = 5;

var graph = prov.create({
  type: 'provenance_graph',
  name: 'CLUE',
  fqname: 'c.CLUE',
  id: 'clue_demo',
  startFromScratch: C.hash.is('clue_clear')
});

graph.on('switch_state', (event: any, state: prov.StateNode) => {
  C.hash.setInt('clue_state', state.id);
});

import prov_sel = require('../caleydo_provenance/selection');
prov_sel.create(graph, 'selected', {
  filter: function (idtype) {
    return idtype && idtype.name[0] !== '_';
  }
});

import databrowser = require('../caleydo_window/databrowser');
databrowser.create(document.querySelector('#databrowser'));

import selection = require('../caleydo_core/selectioninfo');
selection.create(document.querySelector('#selectioninfo'));

import cmode = require('./mode');
cmode.create(document.querySelector('#modeselector'));

import provvis = require('./provvis');
const story = provvis.create(graph, document.querySelector('#clue'), {});
(function () {
  const $right = $('aside.right');
  $right.css('width', story.width + 'px');
  const $left = $('aside.left');
  const $left_data = $('#databrowser');
  if (cmode.getMode() > cmode.ECLUEMode.Exploration) {
    $left_data.hide();
  } else {
    $left_data.show();
  }
  if (cmode.getMode() >= cmode.ECLUEMode.Interactive_Story) {
    $left.hide();
  } else {
    $left.show();
  }
  cmode.on('modeChanged', (event, new_) => {
    $right.animate({ width: story.width + 'px'});
    if (new_ >= cmode.ECLUEMode.Interactive_Story) {
      $left.animate({width: 'hide'});
    } else {
      $left.animate({width: 'show'});
    }
    if (new_ > cmode.ECLUEMode.Exploration) {
      $left_data.animate({height: 'hide'});
    } else {
      $left_data.animate({height: 'show'});
    }
  });
})();


const p = new player.Player(graph, document.querySelector('#player_controls'));

let $main = d3.select('main');
let $main_ref = graph.findOrAddObject($main, 'Board', 'visual');
{

  databrowser.makeDropable(<Element>$main.node(), (data, op, pos) => {
    var data_ref = graph.findOrAddObject(data, data.desc.id, 'data');
    graph.push(cmds.createAddCmd($main_ref, data_ref, pos));
  });
}

{ //jump to stored state
  let target_state = C.hash.getInt('clue_state', null);
  if (target_state !== null) {
    let s = graph.states.filter((s) => s.id === target_state)[0];
    if (s) {
      graph.jumpTo(s);
    }
  }
}

d3.select('#new_workspace').on('click', () => {
  graph.clear();
  $main_ref = graph.findOrAddObject($main, 'Board', 'visual');
});

export function dummy() {
  return a;
}
