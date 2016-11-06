/**
 * Created by sam on 09.02.2015.
 */


import * as C from 'phovea_core/src/index';
import * as ajax from 'phovea_core/src/ajax';
import * as provenance from 'phovea_core/src/provenance';

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
  if (d.attrs && d.attrs.of && !(d.local)) {
    return ajax.api2absURL(`/clue/thumbnail${d.attrs.of}/${graph.desc.id}/${state.id}.${o.format}`, {
      width: o.width
    });
  }
  return 'phovea_clue/assets/src/not_available.png';
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
  if (d.attrs && d.attrs.of && !(d.local)) {
    return ajax.api2absURL(`/clue/preview_thumbnail${d.attrs.of}/${graph.desc.id}/${state.id}.${o.format}`, {
      width: o.width
    });
  }
  return 'phovea_clue/assets/src/not_available.png';
}

export function screenshot_url(graph: provenance.ProvenanceGraph, state: provenance.StateNode, options= {}) {
  var o = {
    width: 128,
    format: 'jpg'
  };
  if (state.hasAttr('screenshot')) {
    return state.getAttr('screenshot');
  }

  const d = (<any>graph.desc);
  if (d.attrs && d.attrs.of && !(d.local)) {
    return ajax.api2absURL(`screnshot${d.attrs.of}/${graph.desc.id}/${state.id}.${o.format}`, {
      width: o.width
    });
  }
  return 'phovea_clue/assets/src/not_available.png';
}

export function areThumbnailsAvailable(graph: provenance.ProvenanceGraph) {
  const d = (<any>graph.desc);
  return (d.attrs && d.attrs.of && !(d.local));
}
