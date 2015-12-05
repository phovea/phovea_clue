/**
 * Created by Samuel Gratzl on 27.08.2015.
 */

import C = require('../caleydo_core/main');
import prov = require('../caleydo_provenance/main');
import d3 = require('d3');

function addElem(inputs, parameter, graph, within) {
  return C.resolveIn(within).then(() => {
    var $main:d3.Selection<any> = inputs[0].value,
      pos = parameter.pos,
      desc_name = parameter.desc_name;


    var $div = $main.append('div').classed('block', true).datum(desc_name).style({
      left: pos.x + 'px',
      top: pos.y + 'px',
      opacity: within > 0 ? 0 : 1
    });
    var $toolbar = $div.append('div').classed('toolbar', true);
    var $body = $div.append('div').classed('body', true);
    /*vis.list(data)[0].load().then((p) => {
     p.factory(data, $body.node());
     });*/
    $body.text(desc_name);
    var $div_ref = prov.ref($div, desc_name, prov.cat.visual);

    $toolbar.append('i').attr('class', 'fa fa-close').on('click', () => {
      graph.push(createRemoveCmd($div_ref, inputs[0]));
    });
    if (within > 0) {
      $div.transition().duration(within).style('opacity', 1);
    }
    return {
      created: [$div_ref],
      inverse: createRemoveCmd($div_ref, inputs[0]),
      consumed: within
    };
  });
}
function removeElem(inputs, parameter, graph, within) {
  return C.resolveIn(within).then(() => {
    var $div:d3.Selection<any> = inputs[0].value,
      inv = createAddCmd(inputs[1], $div.datum(), {
        x: parseInt($div.style('left'), 10),
        y: parseInt($div.style('top'), 10)
      });

    if (within > 0) {
      $div.transition().duration(within).style('opacity', 0).remove();
    } else {
      $div.remove();
    }

    return {
      removed: [inputs[0]],
      inverse: inv,
      consumed: within
    };
  });
}

interface ID3Ref extends prov.IObjectRef<d3.Selection<any>> {

}

export function createAddCmd($main_ref:ID3Ref, desc_name: string, pos:{x: number; y:number}) {
  return prov.action(prov.meta(desc_name, prov.cat.data, prov.op.create), 'addClueElem', addElem, [$main_ref], {
    pos: pos,
    desc_name: desc_name
  });
}
export function createRemoveCmd($div_ref:ID3Ref, $main_ref:ID3Ref) {
  return prov.action(prov.meta($div_ref.name, prov.cat.data, prov.op.remove), 'removeClueElem', removeElem, [$div_ref, $main_ref]);
}

export function createCmd(id) {
  switch (id) {
    case 'addClueElem' :
      return addElem;
    case 'removeClueElem':
      return removeElem;
  }
  return null;
}
