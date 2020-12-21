/**
 * provides a template wrapper around an application for including CLUE. Includes the common frame for switching modes, provenance, and story visualizations
 *
 * Created by Samuel Gratzl on 27.08.2015.
 */
import * as tslib_1 from "tslib";
import { mixin } from 'phovea_core/src/index';
import { create as createHeader, AppHeaderLink } from 'phovea_ui/src/header';
import { MixedStorageProvenanceGraphManager } from 'phovea_core/src/provenance';
import { select } from 'd3';
import { create as createSelection } from './selection';
import * as cmode from './mode';
import { loadProvenanceGraphVis, loadStoryVis } from './vis_loader';
import CLUEGraphManager from './CLUEGraphManager';
import ProvenanceGraphMenu from './menu/ProvenanceGraphMenu';
import LoginMenu from './menu/LoginMenu';
export { default as CLUEGraphManager } from './CLUEGraphManager';
import ACLUEWrapper from './ACLUEWrapper';
import { create as createProvRetrievalPanel } from './provenance_retrieval/ProvRetrievalPanel';
var ClueSidePanelEvents = /** @class */ (function () {
    function ClueSidePanelEvents() {
    }
    ClueSidePanelEvents.OPEN = 'open';
    ClueSidePanelEvents.CLOSE = 'close';
    ClueSidePanelEvents.TOGGLE = 'toggle';
    return ClueSidePanelEvents;
}());
export { ClueSidePanelEvents };
var CLUEWrapper = /** @class */ (function (_super) {
    tslib_1.__extends(CLUEWrapper, _super);
    function CLUEWrapper(body, options) {
        if (options === void 0) {
            options = {};
        }
        var _this = _super.call(this) || this;
        _this.options = {
            app: 'CLUE',
            application: '/clue',
            id: 'clue',
            recordSelectionTypes: 'selected',
            animatedSelections: false,
            thumbnails: true,
            appLink: new AppHeaderLink('CLUE'),
            provVisCollapsed: false,
            headerOptions: {}
        };
        mixin(_this.options, options);
        _this.build(body, options);
        _this.on('jumped_to,loaded_graph', function () { return _this.header.ready(); });
        return _this;
    }
    CLUEWrapper.prototype.buildImpl = function (body) {
        var _this = this;
        //create the common header
        var headerOptions = mixin(this.options.headerOptions, {
            showOptionsLink: true,
            appLink: this.options.appLink
        });
        this.header = createHeader(body.querySelector('div.box'), headerOptions);
        //load all available provenance graphs
        var manager = new MixedStorageProvenanceGraphManager({
            prefix: this.options.id,
            storage: sessionStorage,
            application: this.options.application
        });
        var clueManager = new CLUEGraphManager(manager);
        this.header.wait();
        var _ = new LoginMenu(this.header, {
            loginForm: this.options.loginForm,
            insertIntoHeader: true
        });
        var provenanceMenu = new ProvenanceGraphMenu(clueManager, body, false);
        this.header.insertCustomRightMenu(provenanceMenu.node);
        var modeSelector = body.querySelector('header');
        modeSelector.className += 'clue-modeselector';
        cmode.createButton(modeSelector, {
            size: 'sm'
        });
        this.$main = select(body).select('main');
        var graph = clueManager.list().then(function (graphs) {
            provenanceMenu.build(graphs);
            return clueManager.choose(graphs);
        });
        graph.then(function (graph) {
            provenanceMenu.setGraph(graph);
            _this.$mainRef = graph.findOrAddObject(_this.$main, 'Application', 'visual');
            graph.on('sync_start,sync', function (event) {
                select('nav span.glyphicon-cog').classed('fa-spin', event.type !== 'sync');
            });
            if (_this.options.recordSelectionTypes) {
                //record selections of the given type
                createSelection(graph, _this.options.recordSelectionTypes, {
                    filter: function (idtype) {
                        return idtype && idtype.name[0] !== '_';
                    },
                    animated: _this.options.animatedSelections
                });
            }
        });
        graph.then(function (graph) {
            // `set_application` is fired in ACLUEWrapper
            _this.on('set_application', function (evt, app) {
                createProvRetrievalPanel(graph, body.querySelector('div.content'), {
                    app: app
                })
                    .on(ClueSidePanelEvents.OPEN, function () {
                    _this.fire(ClueSidePanelEvents.OPEN);
                    _this.fire(ClueSidePanelEvents.TOGGLE);
                })
                    .on(ClueSidePanelEvents.CLOSE, function () {
                    _this.fire(ClueSidePanelEvents.CLOSE);
                    _this.fire(ClueSidePanelEvents.TOGGLE);
                });
            });
        });
        var provVis = loadProvenanceGraphVis(graph, body.querySelector('div.content'), {
            thumbnails: this.options.thumbnails,
            provVisCollapsed: this.options.provVisCollapsed
        });
        var storyVis = loadStoryVis(graph, body.querySelector('div.content'), this.$main.node(), {
            thumbnails: this.options.thumbnails
        });
        return { graph: graph, manager: clueManager, storyVis: storyVis, provVis: provVis };
    };
    CLUEWrapper.prototype.reset = function () {
        var _this = this;
        this.graph.then(function (graph) {
            graph.jumpTo(graph.states[0]).then(function () {
                graph.clear();
                _this.$mainRef = graph.findOrAddObject(_this.$main, 'Application', 'visual');
                cmode.setMode(cmode.modes.Exploration);
            });
        });
    };
    return CLUEWrapper;
}(ACLUEWrapper));
export { CLUEWrapper };
export default CLUEWrapper;
/**
 * factory method creating a CLUEWrapper instance
 * @param body
 * @param options
 * @returns {CLUEWrapper}
 */
export function create(body, options) {
    if (options === void 0) {
        options = {};
    }
    return new CLUEWrapper(body, options);
}
//# sourceMappingURL=template.js.map
//# sourceMappingURL=template.js.map