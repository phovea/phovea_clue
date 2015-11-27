/**
 * Created by Samuel Gratzl on 27.08.2015.
 */

import template = require('./template');
import cmds = require('./cmds');
import databrowser = require('../caleydo_d3/databrowser');
import selection = require('../caleydo_d3/selectioninfo');
import cmode = require('../caleydo_provenance/mode');
import $ = require('jquery');

const elems = template.create(document.body);

{
  $(`<aside class="left" style="width: 12vw">
    <section id="selectioninfo">
      <h2>Selection Info</h2>
    </section>
    <section id="databrowser">
      <h2Data Browser</h2>
    </section>
    </aside>`).prependTo('div.content');

  selection.create(document.querySelector('#selectioninfo'), {
    useNames: true,
    filter: (idtype) => {
      return idtype && idtype.name[0] !== '_';
    }
  });


  const databrowserElem = document.querySelector('#databrowser');
  databrowser.create(databrowserElem);

  elems.$main.classed('clue_demo',true);

  const $left = $('aside.left');
  const $left_data = $(databrowserElem);

  function updateMode(new_) {
    if (new_.exploration < 0.8) {
      $left_data.hide(); //.animate({height: 'hide'});
    } else {
      $left_data.show(); //animate({height: 'show'});
    }
    if (new_.exploration < 0.8) {
      $left.hide(); //({width: 'hide'});
    } else {
      $left.show(); //({width: 'show'});
    }
  }

  elems.on('modeChanged', (event, new_) => {
    updateMode(new_);
  });
  updateMode(cmode.getMode());

  databrowser.makeDropable(<Element>elems.$main.node(), (data, op, pos) => {
    elems.graph.then((graph) => {
      graph.push(cmds.createAddCmd(elems.$main_ref, data.desc.name, pos));
    });
  });
  elems.jumpToStored();
}
