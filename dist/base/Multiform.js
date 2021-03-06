/**
 * Created by sam on 10.02.2015.
 */
import { ActionMetaData, ObjectRefUtils } from 'phovea_core';
const disabled = {};
export class Multiform {
    static transform(inputs, parameter) {
        const v = inputs[0].value, transform = parameter.transform, bak = parameter.old || v.transform();
        disabled['transform-' + v.id] = true;
        v.transform(transform.scale, transform.rotate);
        delete disabled['transform-' + v.id];
        return {
            inverse: Multiform.createTransform(inputs[0], bak, transform)
        };
    }
    static createTransform(v, t, old = null) {
        return {
            meta: ActionMetaData.actionMeta('transform ' + v.toString(), ObjectRefUtils.category.visual),
            id: 'transform',
            f: Multiform.transform,
            inputs: [v],
            parameter: {
                transform: t,
                old
            }
        };
    }
    static changeVis(inputs, parameter) {
        const v = inputs[0].value, to = parameter.to, from = parameter.from || v.act.id;
        disabled['switch-' + v.id] = true;
        return v.switchTo(to).then(() => {
            delete disabled['switch-' + v.id];
            return {
                inverse: Multiform.createChangeVis(inputs[0], from, to)
            };
        });
    }
    static createChangeVis(v, to, from = null) {
        return {
            meta: ActionMetaData.actionMeta('switch vis ' + v.toString(), ObjectRefUtils.category.visual),
            id: 'changeVis',
            f: Multiform.changeVis,
            inputs: [v],
            parameter: {
                to,
                from
            }
        };
    }
    static setOption(inputs, parameter) {
        const v = inputs[0].value, name = parameter.name, value = parameter.value, bak = parameter.old || v.option(name);
        disabled['option-' + v.id] = true;
        v.option(name, value);
        delete disabled['option-' + v.id];
        return {
            inverse: Multiform.createSetOption(inputs[0], name, bak, value)
        };
    }
    static createSetOption(v, name, value, old = null) {
        return {
            meta: ActionMetaData.actionMeta('set option "' + name + +'" of "' + v.toString() + ' to "' + value + '"', ObjectRefUtils.category.visual),
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
    static attach(graph, v) {
        const m = v.value, id = m.id;
        if (typeof (m.switchTo) === 'function') {
            m.on('changed', (event, newValue, old) => {
                if (disabled['switch-' + id] !== true) {
                    console.log('push switch');
                    graph.push(Multiform.createChangeVis(v, newValue.id, old ? old.id : null));
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
//# sourceMappingURL=Multiform.js.map