/**
 * Created by Samuel Gratzl on 28.02.2017.
 */
import { hash } from 'phovea_core/src';
import * as cmode from './mode';
/**
 * injection for headless support
 * @param wrapper
 */
function injectHeadlessSupport(wrapper) {
    var w = window;
    w.__caleydo = w.__caleydo || {};
    w.__caleydo.clue = wrapper;
    wrapper.on('jumped_to', function () {
        setTimeout(function () {
            document.body.classList.add('clue_jumped');
            // prompt('clue_done_magic_key', 'test');
        }, 5000);
    });
}
function injectParentWindowSupport(wrapper) {
    var w = window;
    w.__caleydo = w.__caleydo || {};
    w.__caleydo.clue = wrapper;
    //initial jump
    var jumpListener = function (s) {
        window.top.postMessage({ type: 'caleydo', clue: 'jumped_to_initial' }, '*');
        wrapper.off('jumped_to', jumpListener);
    };
    wrapper.on('jumped_to', jumpListener);
    window.addEventListener('message', function (event) {
        var s = event.source, d = event.data;
        if (d.type !== 'caleydo' || !d.clue) {
            return;
        }
        if (d.clue === 'jump_to') {
            wrapper.jumpToState(d.state).then(function () {
                s.postMessage({ type: 'caleydo', clue: 'jumped_to', state: d.state, ref: d.ref }, '*');
            }).catch(function () {
                s.postMessage({ type: 'caleydo', clue: 'jump_to_error', state: d.state, ref: d.ref }, '*');
            });
        }
        else if (d.clue === 'show_slide') {
            wrapper.jumpToStory(d.slide).then(function () {
                s.postMessage({ type: 'caleydo', clue: 'show_slide', slide: d.slide, ref: d.ref }, '*');
            }).catch(function () {
                s.postMessage({ type: 'caleydo', clue: 'show_slide_error', slide: d.slide, ref: d.ref }, '*');
            });
        }
        else if (d.clue === 'next_slide') {
            wrapper.nextSlide().then(function () {
                s.postMessage({ type: 'caleydo', clue: 'next_slide', ref: d.ref }, '*');
            });
        }
        else if (d.clue === 'previous_slide') {
            wrapper.previousSlide().then(function () {
                s.postMessage({ type: 'caleydo', clue: 'previous_slide', ref: d.ref }, '*');
            });
        }
    });
}
export function handleMagicHashElements(body, manager) {
    //special flag for rendering server side screenshots
    if (hash.has('clue_headless')) {
        console.log('init headless mode');
        injectHeadlessSupport(manager);
        body.classList.add('headless');
    }
    if (hash.has('clue_contained')) {
        console.log('init contained mode');
        injectParentWindowSupport(manager);
        body.classList.add('headless');
    }
}
export function useInMemoryGraph() {
    return hash.has('clue_headless') || hash.getProp('clue_graph', '') === 'memory';
}
function triggeredByInputField(evt) {
    var src = evt.srcElement;
    var elem = evt.target;
    var inputTypes = ['input', 'select', 'textarea'];
    return (src && inputTypes.includes(src.nodeName.toLowerCase())) || (elem.nodeName && inputTypes.includes(elem.nodeName.toLowerCase()));
}
/**
 * enables keyboard shortcuts to undo and change mode
 * @param graph
 */
export function enableKeyboardShortcuts(graph) {
    //undo using ctrl-z
    document.addEventListener('keydown', function (k) {
        if (triggeredByInputField(k)) {
            return;
        }
        if (k.keyCode === 90 && k.ctrlKey) {
            //ctrl-z
            k.preventDefault();
            graph.undo();
        }
        else if (k.keyCode === 37 && k.ctrlKey) {
            //left arrow 	37
            cmode.setMode(cmode.modes.Exploration);
        }
        else if ((k.keyCode === 38 || k.keyCode === 40) && k.ctrlKey) {
            //up arrow 	38
            //down arrow 	40
            cmode.setMode(cmode.modes.Authoring);
        }
        else if (k.keyCode === 39 && k.ctrlKey) {
            //right arrow 	39
            cmode.setMode(cmode.modes.Presentation);
        }
    });
}
//# sourceMappingURL=internal.js.map
//# sourceMappingURL=internal.js.map