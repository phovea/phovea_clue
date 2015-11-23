/**
 * Created by sam on 09.02.2015.
 */
/// <reference path="../../tsd.d.ts" />

import ajax = require('../caleydo_core/ajax');
import provenance = require('../caleydo_provenance/main');

export function thumbnail_url(graph: provenance.ProvenanceGraph, state: provenance.StateNode) {
  if (state.hasAttr('thumbnail')) {
    return state.getAttr('thumbnail');
  }

  const d = (<any>graph.desc);
  if (d.attrs && d.attrs.of) {
    return ajax.api2absURL(`/clue/thumbnail${d.attrs.of}/${graph.desc.id}/${state.id}.jpg`);
  }
  return '/clue_demo/todo.png';
}


export function screenshot_url(graph: provenance.ProvenanceGraph, state: provenance.StateNode) {
  if (state.hasAttr('screnshot')) {
    return state.getAttr('screnshot');
  }

  const d = (<any>graph.desc);
  if (d.attrs && d.attrs.of) {
    return ajax.api2absURL(`screnshot${d.attrs.of}/${graph.desc.id}/${state.id}.jpg`);
  }
  return '/clue_demo/todo.png';
}
