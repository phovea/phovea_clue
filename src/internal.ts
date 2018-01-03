/**
 * Created by Samuel Gratzl on 28.02.2017.
 */

import {hash} from 'phovea_core/src';
import ProvenanceGraph from 'phovea_core/src/provenance/ProvenanceGraph';
import * as cmode from './mode';
import {IEventHandler} from 'phovea_core/src/event';

export interface ICLUEWrapper extends IEventHandler {
  jumpToState(state: number): Promise<any>;
  jumpToStory(state: number): Promise<any>;
  nextSlide(): Promise<any>;
  previousSlide(): Promise<any>;
}

/**
 * injection for headless support
 * @param wrapper
 */
function injectHeadlessSupport(wrapper: ICLUEWrapper) {
  const w: any = window;
  w.__caleydo = w.__caleydo || {};
  w.__caleydo.clue = wrapper;
  wrapper.on('jumped_to', () => {
    setTimeout(() => {
      document.body.classList.add('clue_jumped');
      // prompt('clue_done_magic_key', 'test');
    }, 5000);

  });
}

function injectParentWindowSupport(wrapper: ICLUEWrapper) {
  const w: any = window;
  w.__caleydo = w.__caleydo || {};
  w.__caleydo.clue = wrapper;
  //initial jump
  const jumpListener = (s) => {
    window.top.postMessage({type: 'caleydo', clue: 'jumped_to_initial'}, '*');
    wrapper.off('jumped_to', jumpListener);
  };
  wrapper.on('jumped_to', jumpListener);
  window.addEventListener('message', (event: MessageEvent) => {
    const s = event.source,
      d = event.data;
    if (d.type !== 'caleydo' || !d.clue) {
      return;
    }
    if (d.clue === 'jump_to') {
      wrapper.jumpToState(d.state).then(() => {
        s.postMessage({type: 'caleydo', clue: 'jumped_to', state: d.state, ref: d.ref}, '*');
      }).catch(() => {
        s.postMessage({type: 'caleydo', clue: 'jump_to_error', state: d.state, ref: d.ref}, '*');
      });
    } else if (d.clue === 'show_slide') {
      wrapper.jumpToStory(d.slide).then(() => {
        s.postMessage({type: 'caleydo', clue: 'show_slide', slide: d.slide, ref: d.ref}, '*');
      }).catch(() => {
        s.postMessage({type: 'caleydo', clue: 'show_slide_error', slide: d.slide, ref: d.ref}, '*');
      });
    } else if (d.clue === 'next_slide') {
      wrapper.nextSlide().then(() => {
        s.postMessage({type: 'caleydo', clue: 'next_slide', ref: d.ref}, '*');
      });
    } else if (d.clue === 'previous_slide') {
      wrapper.previousSlide().then(() => {
        s.postMessage({type: 'caleydo', clue: 'previous_slide', ref: d.ref}, '*');
      });
    }
  });
}

export function handleMagicHashElements(body: HTMLElement, manager: ICLUEWrapper) {
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

/**
 * enables keyboard shortcuts to undo and change mode
 * @param graph
 */
export function enableKeyboardShortcuts(graph: ProvenanceGraph) {
  //undo using ctrl-z
  document.addEventListener('keydown', (k) => {
    if (k.keyCode === 90 && k.ctrlKey) {
      //ctrl-z
      k.preventDefault();
      graph.undo();
    } else if (k.keyCode === 37 && k.ctrlKey) {
      //left arrow 	37
      cmode.setMode(cmode.modes.Exploration);
    } else if ((k.keyCode === 38 || k.keyCode === 40) && k.ctrlKey) {
      //up arrow 	38
      //down arrow 	40
      cmode.setMode(cmode.modes.Authoring);
    } else if (k.keyCode === 39 && k.ctrlKey) {
      //right arrow 	39
      cmode.setMode(cmode.modes.Presentation);
    }
  });
}
