/**
 * Created by sam on 10.02.2015.
 */

import * as multiform from 'phovea_core/src/multiform';
import * as provenance from 'phovea_core/src/provenance';
import * as vis from 'phovea_core/src/vis';

const disabled = {};

export class Multiform {

  static transform(inputs: provenance.IObjectRef<any>[], parameter: any): provenance.ICmdResult {
    const v: vis.IVisInstance = inputs[0].value,
      transform = parameter.transform,
      bak = parameter.old || v.transform();

    disabled['transform-' + v.id] = true;
    v.transform(transform.scale, transform.rotate);
    delete disabled['transform-' + v.id];
    return {
      inverse: Multiform.createTransform(inputs[0], bak, transform)
    };
  }
  static createTransform(v: provenance.IObjectRef<vis.IVisInstance>, t: vis.ITransform, old: vis.ITransform = null) {
    return {
      meta: provenance.meta('transform ' + v.toString(), provenance.cat.visual),
      id: 'transform',
      f: Multiform.transform,
      inputs: [v],
      parameter: {
        transform: t,
        old
      }
    };
  }

  static changeVis(inputs: provenance.IObjectRef<any>[], parameter: any): Promise<provenance.ICmdResult> {
    const v: multiform.IMultiForm = inputs[0].value,
      to: string = parameter.to,
      from = parameter.from || v.act.id;
    disabled['switch-' + v.id] = true;
    return v.switchTo(to).then(() => {
      delete disabled['switch-' + v.id];
      return {
        inverse: Multiform.createChangeVis(inputs[0], from, to)
      };
    });
  }
  static createChangeVis(v: provenance.IObjectRef<multiform.IMultiForm>, to: string, from: string = null) {
    return {
      meta: provenance.meta('switch vis ' + v.toString(), provenance.cat.visual),
      id: 'changeVis',
      f: Multiform.changeVis,
      inputs: [v],
      parameter: {
        to,
        from
      }
    };
  }

  static setOption(inputs: provenance.IObjectRef<any>[], parameter: any): provenance.ICmdResult {
    const v: vis.IVisInstance = inputs[0].value,
      name = parameter.name,
      value = parameter.value,
      bak = parameter.old || v.option(name);
    disabled['option-' + v.id] = true;
    v.option(name, value);
    delete disabled['option-' + v.id];
    return {
      inverse: Multiform.createSetOption(inputs[0], name, bak, value)
    };
  }

  static createSetOption(v: provenance.IObjectRef<vis.IVisInstance>, name: string, value: any, old: any = null) {
    return {
      meta: provenance.meta('set option "' + name + +'" of "' + v.toString() + ' to "' + value + '"', provenance.cat.visual),
      id: 'setOption',
      f: Multiform.setOption,
      inputs: [v],
      parameter: {
        name,
        value,
        old
      }
    };
  }

  static attach(graph: provenance.ProvenanceGraph, v: provenance.IObjectRef<vis.IVisInstance>) {
    const m = v.value, id = m.id;
    if (typeof ((<any>m).switchTo) === 'function') {
      m.on('changed', (event, newValue, old) => {
        if (disabled['switch-' + id] !== true) {
          console.log('push switch');
          graph.push(Multiform.createChangeVis(<provenance.IObjectRef<multiform.IMultiForm>>v, newValue.id, old ? old.id : null));
        }
      });
    }
    m.on('transform', (event, newValue, old) => {
      if (disabled['transform-' + id] !== true) {
        console.log('push transform');
        graph.push(Multiform.createTransform(v, newValue, old));
      }
    });
    m.on('option', (event, name, newValue, old) => {
      if (disabled['option-' + id] !== true) {
        console.log('push option');
        graph.push(Multiform.createSetOption(v, name, newValue, old));
      }
    });
  }
}
