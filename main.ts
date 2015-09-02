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

var a = 5;

var graph = prov.create({
  type: 'provenance_graph',
  name: 'CLUE',
  fqname: 'c.CLUE',
  id: 'clue'
});

graph.on('switch_state', (event: any, state: prov.StateNode) => {
  C.hash.setProp('clue_state', String(state.id));
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
  });
})();


new player.Player(graph, document.querySelector('#player_controls'));

var $main = d3.select('main');
var $main_ref =  graph.addObject($main, 'Board', 'visual');

function addElem(inputs, parameter) {
    var $main = inputs[0].v,
      data = inputs[1].v,
      pos = parameter.pos;
  var $div = $main.append('div').classed('block', true).datum(data).style({
    left: pos.x+'px',
    top: pos.y+'px'
  });
  var $toolbar = $div.append('div').classed('toolbar', true);
  var $body = $div.append('div').classed('body', true);
  /*vis.list(data)[0].load().then((p) => {
    p.factory(data, $body.node());
  });*/
  $body.text(data.desc.name);
  var $div_ref = prov.ref($div, 'Block '+data.desc.name, prov.cat.visual);

  $toolbar.append('i').attr('class', 'fa fa-close').on('click',() => {
    graph.push(createRemoveCmd($div_ref));
  });
  return {
    created: [$div_ref],
    inverse: createRemoveCmd($div_ref)
  }
}
function removeElem(inputs) {
  var $div = inputs[0].v,
    inv = createAddCmd($main_ref, graph.findObject($div.datum()), {
      x : parseInt($div.style('left')),
      y : parseInt($div.style('top'))
    });
  $div.remove();
  return {
    removed: [inputs[0]],
    inverse: inv
  };
}

interface ID3Ref extends prov.IObjectRef<d3.Selection<any>> {

}

function createAddCmd($main_ref: ID3Ref, data: prov.IObjectRef<datatypes.IDataType>, pos: {x: number; y:number}) {
  return prov.action(prov.meta('Block for '+data.v.desc.name, prov.cat.visual, prov.op.create), 'addElem', addElem, [$main_ref, data], {
    pos: pos
  });
}
function createRemoveCmd($div_ref: ID3Ref) {
  return prov.action(prov.meta('Remove Block', prov.cat.visual, prov.op.remove), 'removeColumn', removeElem, [$div_ref]);
}

databrowser.makeDropable(<Element>$main.node(), (data, op, pos) => {
  var data_ref = graph.findOrAddObject(data, data.desc.name, 'data');
  graph.push(createAddCmd($main_ref, data_ref, pos));
});

export function dummy() {
  return a;
}