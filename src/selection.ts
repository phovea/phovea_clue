/**
 * Created by sam on 10.02.2015.
 */

import * as idtypes from 'phovea_core/src/idtype';
import * as events from 'phovea_core/src/event';
import * as provenance from 'phovea_core/src/provenance';
import * as C from 'phovea_core/src/index';
import * as ranges from 'phovea_core/src/range';

const disabler = new events.EventHandler();


function select(inputs:provenance.IObjectRef<any>[], parameter:any, graph, within):provenance.ICmdResult {
  var idtype = idtypes.resolve(parameter.idtype),
    range = ranges.parse(parameter.range),
    type = parameter.type;
  var bak = parameter.old ? ranges.parse(parameter.old) : idtype.selections(type);

  if (C.hash.is('debug')) {
    console.log('select', range.toString());
  }
  disabler.fire('disable-'+idtype.id);
  idtype.select(type, range);
  disabler.fire('enable-'+idtype.id);

  return createSelection(idtype, type, bak, range, parameter.animated).then((cmd) => ({ inverse: cmd, consumed : parameter.animated ? within : 0 }));
}

function capitalize(s: string) {
  return s.split(' ').map((d) => d[0].toUpperCase()+d.slice(1)).join(' ');
}

function meta(idtype:idtypes.IDType, type:string, range:ranges.Range) {
  const l = range.dim(0).length;
  var title = type === idtypes.defaultSelectionType ? '' : (capitalize(type)+' ');
  var p;
  if (l === 0) {
    title += 'no '+idtype.names;
    p = Promise.resolve(title);
  } else if (l === 1) {
    title += idtype.name+' ';

    p = idtype.unmap(range).then((r) => {
      title += r[0];
      return title;
    });
  } else if (l < 3) {
    title += idtype.names+' (';
    p = idtype.unmap(range).then((r) => {
      title += r.join(', ') + ')';
      return title;
    });
  } else {
    title += `${range.dim(0).length} ${idtype.names}`;
    p = Promise.resolve(title);
  }
  return p.then((title) => provenance.meta(title, provenance.cat.selection));
}

/**
 * create a selection command
 * @param idtype
 * @param type
 * @param range
 * @param old optional the old selection for inversion
 * @returns {Cmd}
 */
export function createSelection(idtype:idtypes.IDType, type:string, range:ranges.Range, old:ranges.Range = null, animated = false) {
  return meta(idtype, type, range).then((meta) => {
    return {
      meta: meta,
      id: 'select',
      f: select,
      parameter: {
        idtype: idtype.id,
        range: range.toString(),
        type: type,
        old: old.toString(),
        animated: animated
      }
    };
  });
}

export function compressSelection(path: provenance.ActionNode[]) {
  const lastByIDType : any = {};
  path.forEach((p) => {
    if (p.f_id === 'select') {
      const para = p.parameter;
      lastByIDType[para.idtype+'@'+para.type] = p;
    }
  });
  return path.filter((p) => {
    if (p.f_id !== 'select') {
      return true;
    }
    const para = p.parameter;
    //last one remains
    return lastByIDType[para.idtype+'@'+para.type] === p;
  });
}

/**
 * utility class to record all the selections within the provenance graph for a specific idtype
 */
class SelectionTypeRecorder {
  private l = (event, type, sel, added, removed, old) => {
    createSelection(this.idtype, type, sel, old, this.options.animated).then((cmd) => this.graph.push(cmd));
  };

  private _enable = this.enable.bind(this);
  private _disable = this.disable.bind(this);

  private typeRecorders = [];

  constructor(private idtype:idtypes.IDType, private graph:provenance.ProvenanceGraph, private type?:string, private options : any = {}) {

    if (this.type) {
      this.typeRecorders = this.type.split(',').map((ttype) => {
        const t = (event, sel, added, removed, old) => {
          return this.l(event, ttype, sel, added, removed, old);
        };
        return t;
      });
    }
    this.enable();

    disabler.on('enable-'+this.idtype.id, this._enable);
    disabler.on('disable-'+this.idtype.id, this._disable);
  }

  disable() {
    if (this.type) {
      this.type.split(',').forEach((ttype, i) => {
        this.idtype.off('select-' + ttype, this.typeRecorders[i]);
      });
    } else {
      this.idtype.off('select', this.l);
    }
  }

  enable() {
    if (this.type) {
      this.type.split(',').forEach((ttype, i) => {
        this.idtype.on('select-' + ttype, this.typeRecorders[i]);
      });
    } else {
      this.idtype.on('select', this.l);
    }
  }

  destroy() {
    this.disable();
    disabler.off('enable-'+this.idtype.id, this._enable);
    disabler.off('disable-'+this.idtype.id, this._disable);
  }
}
/**
 * utility class to record all the selections within the provenance graph
 */
export class SelectionRecorder {
  private handler:SelectionTypeRecorder[] = [];
  private adder = (event, idtype) => {
    if (this.options.filter(idtype)) {
      this.handler.push(new SelectionTypeRecorder(idtype, this.graph, this.type, this.options));
    }
  };

  constructor(private graph:provenance.ProvenanceGraph, private type?:string, private options : any = {}) {
    this.options = C.mixin({
      filter: C.constantTrue,
      animated: false
    }, this.options);
    events.on('register.idtype', this.adder);
    idtypes.list().forEach((d) => {
      this.adder(null, d);
    });
  }

  destroy() {
    events.off('register.idtype', this.adder);
    this.handler.forEach((h) => h.destroy());
    this.handler.length = 0;
  }
}


export function create(graph:provenance.ProvenanceGraph, type?:string, options: any = {}) {
  return new SelectionRecorder(graph, type, options);
}

export function createCmd(id:string) {
  switch (id) {
    case 'select':
      return select;
  }
  return null;
}
