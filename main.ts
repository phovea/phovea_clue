/**
 * Created by Samuel Gratzl on 27.08.2015.
 */
/// <amd-dependency path='font-awesome' />
/// <amd-dependency path='bootstrap' />

import prov = require('../caleydo_provenance/main');
import prov_sel = require('../caleydo_provenance/selection');
import d3 = require('d3');

var a = 5;

var graph = prov.create({
  type: 'provenance_graph',
  name: 'CLUE',
  fqname: 'c.CLUE',
  id: 'clue'
});

prov_sel.create(graph, 'selected', {
  filter: function (idtype) {
    return idtype && idtype.name[0] !== '_';
  }
});

import selection = require('../caleydo_core/selectioninfo');
selection.create(document.querySelector('aside.left'));

import databrowser = require('../caleydo_window/databrowser');
databrowser.create(document.querySelector('aside.left'));

export function dummy() {
  return a;
}