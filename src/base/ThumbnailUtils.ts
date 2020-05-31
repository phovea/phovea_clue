/**
 * Created by sam on 09.02.2015.
 */


import {BaseUtils, AppContext, ProvenanceGraph, StateNode, SlideNode} from 'phovea_core';

import * as not_available from '../assets/not_available.png';

export class ThumbnailUtils {

  static thumbnail_url(graph: ProvenanceGraph, state: StateNode, options= {}) {
    const o = {
      width: 128,
      format: 'jpg'
    };
    BaseUtils.mixin(o, options);
    if (state.hasAttr('thumbnail')) {
      return state.getAttr('thumbnail');
    }

    const d = (<any>graph.desc);
    if (d.attrs && d.attrs.of && !(d.local)) {
      return AppContext.getInstance().api2absURL(`/clue/thumbnail${d.attrs.of}/${graph.desc.id}/${state.id}.${o.format}`, {
        width: o.width
      });
    }
    return not_available;
  }

  static preview_thumbnail_url(graph: ProvenanceGraph, state: SlideNode, options= {}) {
    const o = {
      width: 128,
      format: 'jpg'
    };
    if (state.hasAttr('thumbnail')) {
      return state.getAttr('thumbnail');
    }

    const d = (<any>graph.desc);
    if (d.attrs && d.attrs.of && !(d.local)) {
      return AppContext.getInstance().api2absURL(`/clue/preview_thumbnail${d.attrs.of}/${graph.desc.id}/${state.id}.${o.format}`, {
        width: o.width
      });
    }
    return not_available;
  }

  static screenshot_url(graph: ProvenanceGraph, state: StateNode, options= {}) {
    const o = {
      width: 128,
      format: 'jpg'
    };
    if (state.hasAttr('screenshot')) {
      return state.getAttr('screenshot');
    }

    const d = (<any>graph.desc);
    if (d.attrs && d.attrs.of && !(d.local)) {
      return AppContext.getInstance().api2absURL(`screnshot${d.attrs.of}/${graph.desc.id}/${state.id}.${o.format}`, {
        width: o.width
      });
    }
    return not_available;
  }

  static areThumbnailsAvailable(graph: ProvenanceGraph) {
    const d = (<any>graph.desc);
    return (d.attrs && d.attrs.of && !(d.local));
  }
}
