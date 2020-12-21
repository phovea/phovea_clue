/**
 * Created by Samuel Gratzl on 28.02.2017.
 */
import * as tslib_1 from "tslib";
import { hash, HashProperties } from 'phovea_core/src/index';
import { canWrite, isLoggedIn } from 'phovea_core/src/security';
import { useInMemoryGraph } from './internal';
import { EventHandler } from 'phovea_core/src/event';
import { resolveImmediately } from 'phovea_core/src';
var CLUEGraphManager = /** @class */ (function (_super) {
    tslib_1.__extends(CLUEGraphManager, _super);
    function CLUEGraphManager(manager, isReadonly) {
        if (isReadonly === void 0) {
            isReadonly = false;
        }
        var _this = _super.call(this) || this;
        _this.manager = manager;
        _this.isReadonly = isReadonly;
        _this.onHashChanged = function () { return _this.onHashChangedImpl(); };
        return _this;
        //selected by url
    }
    CLUEGraphManager.setGraphInUrl = function (value) {
        hash.removeProp('clue_slide', false);
        hash.removeProp('clue_state', false);
        hash.setProp('clue_graph', value);
    };
    CLUEGraphManager.reloadPage = function () {
        window.location.reload();
    };
    CLUEGraphManager.prototype.onHashChangedImpl = function () {
        var graph = hash.getProp('clue_graph');
        var slide = hash.getInt('clue_slide', null);
        var state = hash.getInt('clue_state', null);
        this.fire(CLUEGraphManager.EVENT_EXTERNAL_STATE_CHANGE, { graph: graph, slide: slide, state: state });
    };
    CLUEGraphManager.prototype.newRemoteGraph = function () {
        if (isLoggedIn()) {
            hash.off(HashProperties.EVENT_HASH_CHANGED, this.onHashChanged);
            CLUEGraphManager.setGraphInUrl('new_remote');
            CLUEGraphManager.reloadPage();
        }
    };
    CLUEGraphManager.prototype.newGraph = function () {
        hash.off(HashProperties.EVENT_HASH_CHANGED, this.onHashChanged);
        CLUEGraphManager.setGraphInUrl('new');
        CLUEGraphManager.reloadPage();
    };
    CLUEGraphManager.prototype.loadGraph = function (desc) {
        // reset
        hash.off(HashProperties.EVENT_HASH_CHANGED, this.onHashChanged);
        CLUEGraphManager.setGraphInUrl(desc.id);
        CLUEGraphManager.reloadPage();
    };
    Object.defineProperty(CLUEGraphManager.prototype, "storedSlide", {
        get: function () {
            return hash.getInt('clue_slide', null);
        },
        set: function (value) {
            if (this.isReadonly) {
                return;
            }
            hash.off(HashProperties.EVENT_HASH_CHANGED, this.onHashChanged);
            if (value !== null) {
                hash.setInt('clue_slide', value, CLUEGraphManager.DEBOUNCE_UPDATE_DELAY);
            }
            else {
                hash.removeProp('clue_slide');
            }
            hash.on(HashProperties.EVENT_HASH_CHANGED, this.onHashChanged);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CLUEGraphManager.prototype, "storedState", {
        get: function () {
            return hash.getInt('clue_state', null);
        },
        set: function (value) {
            if (this.isReadonly) {
                return;
            }
            hash.off(HashProperties.EVENT_HASH_CHANGED, this.onHashChanged);
            if (value !== null) {
                hash.setInt('clue_state', value, CLUEGraphManager.DEBOUNCE_UPDATE_DELAY);
            }
            else {
                hash.removeProp('clue_state');
            }
            hash.on(HashProperties.EVENT_HASH_CHANGED, this.onHashChanged);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CLUEGraphManager.prototype, "isAutoPlay", {
        get: function () {
            return hash.has('clue_autoplay');
        },
        enumerable: true,
        configurable: true
    });
    CLUEGraphManager.prototype.list = function () {
        return this.manager.list();
    };
    CLUEGraphManager.prototype.delete = function (graph) {
        return this.manager.delete(graph);
    };
    CLUEGraphManager.prototype.startFromScratch = function () {
        hash.off(HashProperties.EVENT_HASH_CHANGED, this.onHashChanged);
        hash.removeProp('clue_slide', false);
        hash.removeProp('clue_state', false);
        hash.removeProp('clue_graph');
        window.location.reload();
    };
    CLUEGraphManager.prototype.importGraph = function (dump, remote) {
        var _this = this;
        if (remote === void 0) {
            remote = false;
        }
        (remote ? this.manager.importRemote(dump) : this.manager.importLocal(dump)).then(function (graph) {
            _this.loadGraph(graph.desc);
        });
    };
    CLUEGraphManager.prototype.importExistingGraph = function (graph, extras, cleanUpLocal) {
        var _this = this;
        if (extras === void 0) {
            extras = {};
        }
        if (cleanUpLocal === void 0) {
            cleanUpLocal = false;
        }
        return this.manager.cloneRemote(graph, extras).then(function (newGraph) {
            var p = (graph.local && cleanUpLocal) ? _this.manager.delete(graph) : resolveImmediately(null);
            return p.then(function () { return _this.loadGraph(newGraph.desc); });
        });
    };
    CLUEGraphManager.prototype.migrateGraph = function (graph, extras) {
        var _this = this;
        if (extras === void 0) {
            extras = {};
        }
        var old = graph.desc;
        return this.manager.migrateRemote(graph, extras).then(function (newGraph) {
            return (old.local ? _this.manager.delete(old) : resolveImmediately(true)).then(function () {
                if (!_this.isReadonly) {
                    hash.setProp('clue_graph', newGraph.desc.id); //just update the reference
                }
                return newGraph;
            });
        });
    };
    CLUEGraphManager.prototype.editGraphMetaData = function (graph, extras) {
        if (extras === void 0) {
            extras = {};
        }
        return this.manager.edit(graph, extras);
    };
    CLUEGraphManager.prototype.setGraph = function (graph) {
        if (this.isReadonly) {
            return graph;
        }
        hash.off(HashProperties.EVENT_HASH_CHANGED, this.onHashChanged);
        hash.setProp('clue_graph', graph.desc.id);
        hash.on(HashProperties.EVENT_HASH_CHANGED, this.onHashChanged);
        return graph;
    };
    CLUEGraphManager.prototype.chooseNew = function () {
        var graph = hash.getProp('clue_graph', null);
        if (graph === 'memory') {
            return resolveImmediately(this.manager.createInMemory());
        }
        if (graph === 'new_remote' && isLoggedIn()) {
            return this.manager.createRemote();
        }
        if (graph === null || graph === 'new') {
            if (useInMemoryGraph()) {
                return resolveImmediately(this.manager.createInMemory());
            }
            return this.manager.createLocal();
        }
        return null;
    };
    CLUEGraphManager.prototype.loadChosen = function (graph, desc, rejectOnNotFound) {
        if (rejectOnNotFound === void 0) {
            rejectOnNotFound = false;
        }
        if (desc) {
            if (useInMemoryGraph()) {
                return this.manager.cloneInMemory(desc);
            }
            if (desc.local || (isLoggedIn() && canWrite(desc))) {
                return this.manager.get(desc);
            }
            return this.manager.cloneLocal(desc);
        }
        // not found
        if (rejectOnNotFound) {
            return Promise.reject({ graph: graph, msg: "Provenance Graph with id " + graph + " not found" });
        }
        if (useInMemoryGraph()) {
            return resolveImmediately(this.manager.createInMemory());
        }
        return this.manager.create();
    };
    CLUEGraphManager.prototype.chooseImpl = function (list, rejectOnNotFound) {
        if (rejectOnNotFound === void 0) {
            rejectOnNotFound = false;
        }
        var r = this.chooseNew();
        if (r) {
            return r;
        }
        var graph = hash.getProp('clue_graph', null);
        var desc = list.find(function (d) { return d.id === graph; });
        return this.loadChosen(graph, desc, rejectOnNotFound);
    };
    CLUEGraphManager.prototype.chooseLazyImpl = function (rejectOnNotFound) {
        var _this = this;
        if (rejectOnNotFound === void 0) {
            rejectOnNotFound = false;
        }
        var r = this.chooseNew();
        if (r) {
            return r;
        }
        var graph = hash.getProp('clue_graph', null);
        var locals = this.manager.listLocalSync();
        var desc = locals.find(function (d) { return d.id === graph; });
        if (desc) {
            return this.loadChosen(graph, desc, rejectOnNotFound);
        }
        // also check remote
        return this.manager.listRemote().then(function (remotes) {
            var desc = remotes.find(function (d) { return d.id === graph; });
            return _this.loadChosen(graph, desc, rejectOnNotFound);
        });
    };
    CLUEGraphManager.prototype.chooseLazy = function (rejectOnNotFound) {
        var _this = this;
        if (rejectOnNotFound === void 0) {
            rejectOnNotFound = false;
        }
        return this.chooseLazyImpl(rejectOnNotFound).then(function (g) { return _this.setGraph(g); });
    };
    CLUEGraphManager.prototype.choose = function (list, rejectOnNotFound) {
        var _this = this;
        if (rejectOnNotFound === void 0) {
            rejectOnNotFound = false;
        }
        return this.chooseImpl(list, rejectOnNotFound).then(function (g) { return _this.setGraph(g); });
    };
    CLUEGraphManager.prototype.loadOrClone = function (graph, isSelect) {
        if (isSelect) {
            this.loadGraph(graph);
        }
        else {
            this.cloneLocal(graph);
        }
    };
    CLUEGraphManager.prototype.cloneLocal = function (graph) {
        var _this = this;
        if (useInMemoryGraph()) {
            if (!this.isReadonly) {
                CLUEGraphManager.setGraphInUrl('memory');
            }
            return this.manager.cloneInMemory(graph);
        }
        this.manager.cloneLocal(graph).then(function (graph) { return _this.loadGraph(graph.desc); });
    };
    CLUEGraphManager.EVENT_EXTERNAL_STATE_CHANGE = 'externalStateChanged';
    /**
     * update hash in 100ms to prevent to frequent updates
     * @type {number}
     */
    CLUEGraphManager.DEBOUNCE_UPDATE_DELAY = 100;
    return CLUEGraphManager;
}(EventHandler));
export default CLUEGraphManager;
/**
 * create the provenance graph selection dropdown and handles the graph selection
 * @param manager
 * @returns {Promise<U>}
 */
function choose(manager) {
    return manager.list().then(function (list) { return manager.choose(list); });
}
//# sourceMappingURL=CLUEGraphManager.js.map
//# sourceMappingURL=CLUEGraphManager.js.map