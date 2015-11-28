/**
 * Created by sam on 09.02.2015.
 */
/// <reference path="../../tsd.d.ts" />

import C = require('../caleydo_core/main');
import ajax = require('../caleydo_core/ajax');
import provenance = require('../caleydo_provenance/main');

export function thumbnail_url(graph: provenance.ProvenanceGraph, state: provenance.StateNode, options= {}) {
  var o = {
    width: 128,
    format: 'jpg'
  };
  C.mixin(o, options);
  if (state.hasAttr('thumbnail')) {
    return state.getAttr('thumbnail');
  }

  const d = (<any>graph.desc);
  if (d.attrs && d.attrs.of) {
    return ajax.api2absURL(`/clue/thumbnail${d.attrs.of}/${graph.desc.id}/${state.id}.${o.format}`, {
      width: o.width
    });
  }
  return '/clue_demo/todo.png';
}

export function preview_thumbnail_url(graph: provenance.ProvenanceGraph, state: provenance.SlideNode, options= {}) {
  var o = {
    width: 128,
    format: 'jpg'
  };
  if (state.hasAttr('thumbnail')) {
    return state.getAttr('thumbnail');
  }

  const d = (<any>graph.desc);
  if (d.attrs && d.attrs.of) {
    return ajax.api2absURL(`/clue/preview_thumbnail${d.attrs.of}/${graph.desc.id}/${state.id}.${o.format}`, {
      width: o.width
    });
  }
  return '/clue_demo/todo.png';
}

export function screenshot_url(graph: provenance.ProvenanceGraph, state: provenance.StateNode, options= {}) {
  var o = {
    width: 128,
    format: 'jpg'
  };
  if (state.hasAttr('screnshot')) {
    return state.getAttr('screnshot');
  }

  const d = (<any>graph.desc);
  if (d.attrs && d.attrs.of) {
    return ajax.api2absURL(`screnshot${d.attrs.of}/${graph.desc.id}/${state.id}.${o.format}`, {
      width: o.width
    });
  }
  return '/clue_demo/todo.png';
}
