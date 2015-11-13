/**
 * Created by Samuel Gratzl on 27.08.2015.
 */

import template = require('./template');
import cmds = require('./cmds');
import databrowser = require('../caleydo_d3/databrowser');
import cmode = require('../caleydo_provenance/mode');
import $ = require('jquery');

const elems = template.create(document.body);

{
  let databrowserElem = document.createElement('section');
  databrowserElem.innerHTML = '<h2>Data Browser</h2>';

  document.querySelector('aside.left').appendChild(databrowserElem);

  databrowser.create(databrowserElem);

  elems.$main.classed('clue_demo',true);

  var $left_data = $(databrowserElem);
  if (cmode.getMode().exploration < 0.8) {
    $left_data.hide();
  } else {
    $left_data.show();
  }

  elems.on('modeChanged', (event, new_) => {
    if (new_.exploration < 0.8) {
      $left_data.hide(); //.animate({height: 'hide'});
    } else {
      $left_data.show(); //animate({height: 'show'});
    }
  });

  databrowser.makeDropable(<Element>elems.$main_ref.value.node(), (data, op, pos) => {
    elems.graph.then((graph) => {
      var data_ref = graph.findOrAddObject(data, data.desc.id, 'data');
      graph.push(cmds.createAddCmd(elems.$main_ref, data_ref, pos));
    });
  });
  elems.jumpToStored();
}
