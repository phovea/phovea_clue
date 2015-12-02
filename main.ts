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
      <div><h2>Selection Info</h2></div>
    </section>
    <section id="databrowser">
      <div><h2>Data Browser</h2></div>
    </section>
    </aside>`).prependTo('div.content');

  selection.create(document.querySelector('#selectioninfo'), {
    useNames: true,
    filter: (idtype) => {
      return idtype && idtype.name[0] !== '_';
    }
  });

  databrowser.create(document.querySelector('#databrowser'));

  elems.$main.classed('clue_demo',true);
  const $left = $('aside.left');

  function updateMode(new_) {
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
