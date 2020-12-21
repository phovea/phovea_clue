/**
 * Created by sam on 03.03.2017.
 */
import * as tslib_1 from "tslib";
import * as cmode from './mode';
import { EventHandler } from 'phovea_core/src/event';
import CLUEGraphManager from './CLUEGraphManager';
import { handleMagicHashElements, enableKeyboardShortcuts } from './internal';
import { resolveImmediately } from 'phovea_core/src';
import { list } from 'phovea_core/src/plugin';
import { EP_PHOVEA_CLUE_PROVENANCE_GRAPH } from './extensions';
var TEMPLATE = "<div class=\"box\">\n  <header>\n\n  </header>\n  <div class=\"content\">\n    <main data-anchor=\"main\"></main>\n    <!--annotation toolbar-->\n    <div class=\"asides\">\n      <div class=\"panel-selector\"></div>\n      <aside class=\"annotations\" style=\"display:none\">\n        <div>\n          <h2>Annotations</h2>\n        </div>\n        <div class=\"btn-group\" role=\"group\" aria-label=\"annotations\">\n          <button class=\"btn btn-default btn-xs\" title=\"add text annotation\" data-ann=\"text\"><i class=\"fa fa-font\"></i>\n          </button>\n          <button class=\"btn btn-default btn-xs\" title=\"add arrow\" data-ann=\"arrow\"><i class=\"fa fa-arrow-right\"></i>\n          </button>\n          <button class=\"btn btn-default btn-xs\" title=\"add frame\" data-ann=\"frame\"><i class=\"fa fa-square-o\"></i>\n          </button>\n        </div>\n      </aside>\n    </div>\n  </div>\n</div>";
var EUrlTracking;
(function (EUrlTracking) {
    EUrlTracking[EUrlTracking["ENABLE"] = 0] = "ENABLE";
    EUrlTracking[EUrlTracking["DISABLE_JUMPING"] = 1] = "DISABLE_JUMPING";
    EUrlTracking[EUrlTracking["DISABLE_RESTORING"] = 2] = "DISABLE_RESTORING";
})(EUrlTracking || (EUrlTracking = {}));
var ACLUEWrapper = /** @class */ (function (_super) {
    tslib_1.__extends(ACLUEWrapper, _super);
    function ACLUEWrapper() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.urlTracking = EUrlTracking.ENABLE;
        return _this;
    }
    ACLUEWrapper.prototype.setApplication = function (app) {
        this.visStateApp = app;
        this.fire('set_application', this.visStateApp);
    };
    ACLUEWrapper.prototype.build = function (body, options) {
        var _this = this;
        if (options.replaceBody !== false) {
            body.innerHTML = TEMPLATE;
        }
        else {
            body.insertAdjacentHTML('afterbegin', TEMPLATE);
        }
        handleMagicHashElements(body, this);
        var _a = this.buildImpl(body), graph = _a.graph, storyVis = _a.storyVis, manager = _a.manager, provVis = _a.provVis;
        this.graph = graph;
        this.clueManager = manager;
        this.storyVis = storyVis;
        this.provVis = provVis;
        this.graph.then(function (graph) {
            // load registered extensions and pass the ready graph to extension
            list(EP_PHOVEA_CLUE_PROVENANCE_GRAPH).map(function (desc) {
                desc.load().then(function (plugin) { return plugin.factory(graph); });
            });
            graph.on('run_chain', function () {
                if (_this.urlTracking === EUrlTracking.ENABLE) {
                    _this.urlTracking = EUrlTracking.DISABLE_JUMPING;
                }
            });
            graph.on('ran_chain', function (event, state) {
                if (_this.urlTracking === EUrlTracking.DISABLE_JUMPING) {
                    manager.storedState = state ? state.id : null;
                    _this.urlTracking = EUrlTracking.ENABLE;
                }
            });
            graph.on('switch_state', function (event, state) {
                if (_this.urlTracking === EUrlTracking.ENABLE) {
                    manager.storedState = state ? state.id : null;
                }
            });
            graph.on('select_slide_selected', function (event, state) {
                if (_this.urlTracking === EUrlTracking.ENABLE) {
                    manager.storedSlide = state ? state.id : null;
                }
            });
            manager.on(CLUEGraphManager.EVENT_EXTERNAL_STATE_CHANGE, function (_, state) {
                if (state.graph !== graph.desc.id) {
                    // switch to a completely different graph -> reload page
                    CLUEGraphManager.reloadPage();
                }
                var slide = graph.selectedSlides()[0];
                var currentSlide = slide ? slide.id : null;
                if (state.slide != null && currentSlide !== state.slide) {
                    return _this.jumpToStory(state.slide, false);
                }
                var currentState = graph.act ? graph.act.id : null;
                if (state.state != null && currentState !== state.state) {
                    return _this.jumpToState(state.state);
                }
            });
            enableKeyboardShortcuts(graph);
            _this.handleModeChange();
            _this.fire('loaded_graph', graph);
        });
    };
    ACLUEWrapper.prototype.handleModeChange = function () {
        var _this = this;
        var $right = document.querySelector('aside.provenance-layout-vis');
        var $rightStory = document.querySelector('aside.provenance-story-vis');
        this.propagate(cmode, 'modeChanged');
        var update = function (newMode) {
            document.body.dataset.clue = newMode.toString();
            // lazy jquery
            System.import('jquery').then(function ($) {
                //$('nav').css('background-color', d3.rgb(255 * new_.exploration, 255 * new_.authoring, 255 * new_.presentation).darker().darker().toString());
                if (newMode.presentation > 0.8) {
                    $($right).animate({ width: 'hide' }, 'fast');
                }
                else {
                    $($right).animate({ width: 'show' }, 'fast');
                    if (_this.provVis) {
                        _this.provVis();
                    }
                }
                if (newMode.exploration > 0.8) {
                    $($rightStory).animate({ width: 'hide' }, 'fast');
                }
                else {
                    $($rightStory).animate({ width: 'show' }, 'fast');
                    if (_this.storyVis) {
                        _this.storyVis();
                    }
                }
            });
        };
        cmode.on('modeChanged', function (event, newMode) { return update(newMode); });
        this.fire(ACLUEWrapper.EVENT_MODE_CHANGED, cmode.getMode());
        {
            var mode = cmode.getMode();
            document.body.dataset.clue = mode.toString();
            //$('nav').css('background-color', d3.rgb(255 * new_.exploration, 255 * new_.authoring, 255 * new_.presentation).darker().darker().toString());
            if (mode.presentation > 0.8) {
                $right.style.display = 'none';
            }
            else {
                $right.style.display = null;
                if (this.provVis) {
                    this.provVis();
                }
            }
            if (mode.exploration > 0.8) {
                $rightStory.style.display = 'none';
            }
            else {
                $rightStory.style.display = null;
                if (this.storyVis) {
                    this.storyVis();
                }
            }
        }
    };
    ACLUEWrapper.prototype.nextSlide = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var story;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.storyVis) {
                            return [2 /*return*/, Promise.reject('no player available')];
                        }
                        return [4 /*yield*/, this.storyVis()];
                    case 1:
                        story = _a.sent();
                        return [2 /*return*/, story.player.forward()];
                }
            });
        });
    };
    ACLUEWrapper.prototype.previousSlide = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var story;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.storyVis) {
                            return [2 /*return*/, Promise.reject('no player available')];
                        }
                        return [4 /*yield*/, this.storyVis()];
                    case 1:
                        story = _a.sent();
                        return [2 /*return*/, story.player.backward()];
                }
            });
        });
    };
    ACLUEWrapper.prototype.jumpToStory = function (story, autoPlay) {
        if (autoPlay === void 0) {
            autoPlay = this.clueManager.isAutoPlay;
        }
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var graph, storyVis, s;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('jump to stored story', story);
                        if (!this.storyVis) {
                            return [2 /*return*/, Promise.reject('no player available')];
                        }
                        return [4 /*yield*/, this.graph];
                    case 1:
                        graph = _a.sent();
                        return [4 /*yield*/, this.storyVis()];
                    case 2:
                        storyVis = _a.sent();
                        s = graph.getSlideById(story);
                        if (!s)
                            return [3 /*break*/, 6];
                        console.log('jump to stored story', s.id);
                        this.urlTracking = EUrlTracking.DISABLE_RESTORING;
                        storyVis.switchTo(s);
                        if (!autoPlay)
                            return [3 /*break*/, 3];
                        storyVis.player.start();
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, storyVis.player.render(s)];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5:
                        this.urlTracking = EUrlTracking.ENABLE;
                        this.clueManager.storedState = graph.act.id;
                        this.clueManager.storedSlide = s.id;
                        this.fire(ACLUEWrapper.EVENT_JUMPED_TO, s);
                        return [2 /*return*/, this];
                    case 6:
                        this.fire(ACLUEWrapper.EVENT_JUMPED_TO, null);
                        return [2 /*return*/, Promise.reject('story not found')];
                }
            });
        });
    };
    ACLUEWrapper.prototype.jumpToState = function (state) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var graph, s;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('jump to stored state', state);
                        return [4 /*yield*/, this.graph];
                    case 1:
                        graph = _a.sent();
                        s = graph.getStateById(state);
                        if (!s)
                            return [3 /*break*/, 3];
                        console.log('jump to stored', s.id);
                        this.urlTracking = EUrlTracking.DISABLE_RESTORING;
                        return [4 /*yield*/, graph.jumpTo(s)];
                    case 2:
                        _a.sent();
                        this.urlTracking = EUrlTracking.ENABLE;
                        this.clueManager.storedState = graph.act.id;
                        console.log('jumped to stored', s.id);
                        this.fire(ACLUEWrapper.EVENT_JUMPED_TO, s);
                        return [2 /*return*/, this];
                    case 3:
                        this.fire(ACLUEWrapper.EVENT_JUMPED_TO, null);
                        return [2 /*return*/, Promise.reject('state not found')];
                }
            });
        });
    };
    ACLUEWrapper.prototype.jumpToStored = function () {
        //jump to stored state
        var targetStory = this.clueManager.storedSlide;
        if (targetStory !== null) {
            return this.jumpToStory(targetStory);
        }
        var targetState = this.clueManager.storedState;
        if (targetState !== null) {
            return this.jumpToState(targetState);
        }
        this.fire(ACLUEWrapper.EVENT_JUMPED_TO, null);
        //no stored state nothing to jump to
        return resolveImmediately(this);
    };
    ACLUEWrapper.prototype.jumpToStoredOrLastState = function () {
        var _this = this;
        //jump to stored state
        var targetStory = this.clueManager.storedSlide;
        if (targetStory !== null) {
            return this.jumpToStory(targetStory);
        }
        var targetState = this.clueManager.storedState;
        if (targetState !== null) {
            return this.jumpToState(targetState);
        }
        return this.graph.then(function (graph) {
            var maxId = Math.max.apply(Math, graph.states.map(function (s) { return s.id; }));
            return _this.jumpToState(maxId);
        });
    };
    ACLUEWrapper.EVENT_MODE_CHANGED = 'modeChanged';
    ACLUEWrapper.EVENT_JUMPED_TO = 'jumped_to';
    return ACLUEWrapper;
}(EventHandler));
export { ACLUEWrapper };
export default ACLUEWrapper;
//# sourceMappingURL=ACLUEWrapper.js.map
//# sourceMappingURL=ACLUEWrapper.js.map