import { ClueSidePanelEvents } from './template';
export function loadProvenanceGraphVis(data, parent, options) {
    var _this = this;
    if (options === void 0) {
        options = {};
    }
    parent.insertAdjacentHTML('beforeend', "<aside class=\"provenance-layout-vis\"></aside>");
    var c;
    return function () {
        if (!c) {
            c = Promise.all([data, System.import('./provvis')])
                .then(function (args) {
                return args[1].create(args[0], parent, options)
                    .on(ClueSidePanelEvents.OPEN, function () {
                    _this.fire(ClueSidePanelEvents.OPEN);
                    _this.fire(ClueSidePanelEvents.TOGGLE);
                })
                    .on(ClueSidePanelEvents.CLOSE, function () {
                    _this.fire(ClueSidePanelEvents.CLOSE);
                    _this.fire(ClueSidePanelEvents.TOGGLE);
                });
            });
        }
        return c;
    };
}
export function loadStoryVis(graph, parent, main, options) {
    parent.insertAdjacentHTML('beforeend', "<aside class=\"provenance-story-vis\"></aside>");
    var c;
    return function () {
        if (!c) {
            c = Promise.all([graph, System.import('./storyvis')]).then(function (args) { return args[1].createStoryVis(args[0], parent, main, options); });
        }
        return c;
    };
}
//# sourceMappingURL=vis_loader.js.map
//# sourceMappingURL=vis_loader.js.map