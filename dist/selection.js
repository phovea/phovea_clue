/**
 * Created by sam on 10.02.2015.
 */
import * as idtypes from 'phovea_core/src/idtype';
import * as events from 'phovea_core/src/event';
import * as provenance from 'phovea_core/src/provenance';
import * as C from 'phovea_core/src/index';
import * as ranges from 'phovea_core/src/range';
import { lastOnly } from './compress';
import { resolveImmediately } from 'phovea_core/src';
var disabler = new events.EventHandler();
export function select(inputs, parameter, graph, within) {
    var idtype = idtypes.resolve(parameter.idtype), range = ranges.parse(parameter.range), type = parameter.type;
    var bak = parameter.old ? ranges.parse(parameter.old) : idtype.selections(type);
    if (C.hash.has('debug')) {
        console.log('select', range.toString());
    }
    disabler.fire('disable-' + idtype.id);
    idtype.select(type, range);
    disabler.fire('enable-' + idtype.id);
    return createSelection(idtype, type, bak, range, parameter.animated).then(function (cmd) { return ({ inverse: cmd, consumed: parameter.animated ? within : 0 }); });
}
function meta(idtype, type, range, old) {
    var l = range.dim(0).length;
    var promise;
    if (l === 0) {
        promise = resolveImmediately("No " + idtype.names + " Selected");
    }
    else if (l === 1) {
        promise = idtype.unmap(range).then(function (r) {
            return "Selected " + r[0];
        });
    }
    else {
        promise = Promise.all([idtype.unmap(range.without(old)), idtype.unmap(old.without(range))]).then(function (names) {
            // name select/deselect <item>, since the previously added item remains unclear
            var name = (names[0].length > 0) ? 'Selected ' + names[0][0] : 'Deselected ' + names[1][0];
            return name + " (" + l + " " + idtype.names + ")";
        });
    }
    return promise.then(function (title) {
        return provenance.meta(title, provenance.cat.selection);
    });
}
/**
 * create a selection command
 * @param idtype
 * @param type
 * @param range
 * @param old optional the old selection for inversion
 * @returns {Cmd}
 */
export function createSelection(idtype, type, range, old, animated) {
    if (old === void 0) {
        old = null;
    }
    if (animated === void 0) {
        animated = false;
    }
    return meta(idtype, type, range, old).then(function (meta) {
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
export function compressSelection(path) {
    return lastOnly(path, 'select', function (p) { return p.parameter.idtype + '@' + p.parameter.type; });
}
/**
 * utility class to record all the selections within the provenance graph for a specific idtype
 */
var SelectionTypeRecorder = /** @class */ (function () {
    function SelectionTypeRecorder(idtype, graph, type, options) {
        if (options === void 0) {
            options = {};
        }
        var _this = this;
        this.idtype = idtype;
        this.graph = graph;
        this.type = type;
        this.options = options;
        this.l = function (event, type, sel, added, removed, old) {
            createSelection(_this.idtype, type, sel, old, _this.options.animated).then(function (cmd) { return _this.graph.push(cmd); });
        };
        this._enable = this.enable.bind(this);
        this._disable = this.disable.bind(this);
        this.typeRecorders = [];
        if (this.type) {
            this.typeRecorders = this.type.split(',').map(function (ttype) {
                var t = function (event, sel, added, removed, old) {
                    return _this.l(event, ttype, sel, added, removed, old);
                };
                return t;
            });
        }
        this.enable();
        disabler.on('enable-' + this.idtype.id, this._enable);
        disabler.on('disable-' + this.idtype.id, this._disable);
    }
    SelectionTypeRecorder.prototype.disable = function () {
        var _this = this;
        if (this.type) {
            this.type.split(',').forEach(function (ttype, i) {
                _this.idtype.off('select-' + ttype, _this.typeRecorders[i]);
            });
        }
        else {
            this.idtype.off('select', this.l);
        }
    };
    SelectionTypeRecorder.prototype.enable = function () {
        var _this = this;
        if (this.type) {
            this.type.split(',').forEach(function (ttype, i) {
                _this.idtype.on('select-' + ttype, _this.typeRecorders[i]);
            });
        }
        else {
            this.idtype.on('select', this.l);
        }
    };
    SelectionTypeRecorder.prototype.destroy = function () {
        this.disable();
        disabler.off('enable-' + this.idtype.id, this._enable);
        disabler.off('disable-' + this.idtype.id, this._disable);
    };
    return SelectionTypeRecorder;
}());
/**
 * utility class to record all the selections within the provenance graph
 */
var SelectionRecorder = /** @class */ (function () {
    function SelectionRecorder(graph, type, options) {
        if (options === void 0) {
            options = {};
        }
        var _this = this;
        this.graph = graph;
        this.type = type;
        this.options = options;
        this.handler = [];
        this.adder = function (event, idtype) {
            if (_this.options.filter(idtype)) {
                _this.handler.push(new SelectionTypeRecorder(idtype, _this.graph, _this.type, _this.options));
            }
        };
        this.options = C.mixin({
            filter: C.constantTrue,
            animated: false
        }, this.options);
        events.on('register.idtype', this.adder);
        idtypes.list().forEach(function (d) {
            _this.adder(null, d);
        });
    }
    SelectionRecorder.prototype.destroy = function () {
        events.off('register.idtype', this.adder);
        this.handler.forEach(function (h) { return h.destroy(); });
        this.handler.length = 0;
    };
    return SelectionRecorder;
}());
export { SelectionRecorder };
export function create(graph, type, options) {
    if (options === void 0) {
        options = {};
    }
    return new SelectionRecorder(graph, type, options);
}
//# sourceMappingURL=selection.js.map
//# sourceMappingURL=selection.js.map