/**
 * Created by sam on 09.02.2015.
 */
import { mixin } from 'phovea_core/src/index';
import { api2absURL } from 'phovea_core/src/ajax';
import * as not_available from './assets/not_available.png';
export function thumbnail_url(graph, state, options) {
    if (options === void 0) {
        options = {};
    }
    var o = {
        width: 128,
        format: 'jpg'
    };
    mixin(o, options);
    if (state.hasAttr('thumbnail')) {
        return state.getAttr('thumbnail');
    }
    var d = graph.desc;
    if (d.attrs && d.attrs.of && !(d.local)) {
        return api2absURL("/clue/thumbnail" + (d.attrs.of.startsWith('/') ? d.attrs.of : '/' + d.attrs.of) + "/" + graph.desc.id + "/" + state.id + "." + o.format, {
            width: o.width
        });
    }
    return not_available;
}
export function preview_thumbnail_url(graph, state, options) {
    if (options === void 0) {
        options = {};
    }
    var o = {
        width: 128,
        format: 'jpg'
    };
    if (state.hasAttr('thumbnail')) {
        return state.getAttr('thumbnail');
    }
    var d = graph.desc;
    if (d.attrs && d.attrs.of && !(d.local)) {
        return api2absURL("/clue/preview_thumbnail" + (d.attrs.of.startsWith('/') ? d.attrs.of : '/' + d.attrs.of) + "/" + graph.desc.id + "/" + state.id + "." + o.format, {
            width: o.width
        });
    }
    return not_available;
}
export function screenshot_url(graph, state, options) {
    if (options === void 0) {
        options = {};
    }
    var o = {
        width: 128,
        format: 'jpg'
    };
    if (state.hasAttr('screenshot')) {
        return state.getAttr('screenshot');
    }
    var d = graph.desc;
    if (d.attrs && d.attrs.of && !(d.local)) {
        return api2absURL("screnshot" + (d.attrs.of.startsWith('/') ? d.attrs.of : '/' + d.attrs.of) + "/" + graph.desc.id + "/" + state.id + "." + o.format, {
            width: o.width
        });
    }
    return not_available;
}
export function areThumbnailsAvailable(graph) {
    var d = graph.desc;
    return (d.attrs && d.attrs.of && !(d.local));
}
//# sourceMappingURL=utils.js.map
//# sourceMappingURL=utils.js.map