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

function addElem(inputs, parameter, graph) {
  var $main : d3.Selection<any> = inputs[0].value,
    pos = parameter.pos;

  return inputs[1].v.then((data) => {
    var $div = $main.append('div').classed('block', true).datum(data).style({
      left: pos.x + 'px',
      top: pos.y + 'px'
    });
    var $toolbar = $div.append('div').classed('toolbar', true);
    var $body = $div.append('div').classed('body', true);
    /*vis.list(data)[0].load().then((p) => {
     p.factory(data, $body.node());
     });*/
    $body.text(data.desc.name);
    var $div_ref = prov.ref($div, 'Block ' + data.desc.name, prov.cat.visual);

    $toolbar.append('i').attr('class', 'fa fa-close').on('click', () => {
      graph.push(createRemoveCmd($div_ref, inputs[0]));
    });
    return {
      created: [$div_ref],
      inverse: createRemoveCmd($div_ref, inputs[0])
    };
  });
}
function removeElem(inputs, parameter, graph) {
  var $div : d3.Selection<any> = inputs[0].value,
    inv = createAddCmd(inputs[1], graph.findObject($div.datum()), {
      x: parseInt($div.style('left'), 10),
      y: parseInt($div.style('top'), 10)
    });
  $div.remove();
  return {
    removed: [inputs[0]],
    inverse: inv
  };
}

interface ID3Ref extends prov.IObjectRef<d3.Selection<any>> {

}

export function createAddCmd($main_ref:ID3Ref, data:prov.IObjectRef<datatypes.IDataType>, pos:{x: number; y:number}) {
  return prov.action(prov.meta('Block for ' + data.value.desc.name, prov.cat.visual, prov.op.create), 'addClueElem', addElem, [$main_ref, data], {
    pos: pos
  });
}
export function createRemoveCmd($div_ref:ID3Ref, $main_ref:ID3Ref) {
  return prov.action(prov.meta('Remove Block', prov.cat.visual, prov.op.remove), 'removeClueElem', removeElem, [$div_ref, $main_ref]);
}

export function createCmd(id){
  switch(id) {
    case 'addClueElem' : return addElem;
    case 'removeClueElem': return removeElem;
  }
  return null;
}