/**
 * Created by sam on 03.03.2017.
 */

import {select, selectAll, mouse as d3mouse, behavior} from 'd3';
import * as $ from 'jquery';
import * as cmode from './mode';
import {create as createStory, VerticalStoryVis} from './storyvis';
import {EventHandler} from 'phovea_core/src/event';
import {create as createAnnotation}  from './annotation';
import CLUEGraphManager from './CLUEGraphManager';
import {handleMagicHashElements, enableKeyboardShortcuts} from './internal';
import StateNode from 'phovea_core/src/provenance/StateNode';
import ProvenanceGraph from 'phovea_core/src/provenance/ProvenanceGraph';
import SlideNode from 'phovea_core/src/provenance/SlideNode';
import {IVisStateApp} from './prov-retrieval/IVisState';

const TEMPLATE = `<div class="box">
  <header>

  </header>
  <div class="content">
    <main data-anchor="main"></main>
    <!--annotation toolbar-->
    <aside class="annotations" style="display:none">
      <div>
        <h2>Annotations</h2>
      </div>
      <div class="btn-group" role="group" aria-label="annotations">
        <button class="btn btn-default btn-xs" title="add text annotation" data-ann="text"><i class="fa fa-font"></i>
        </button>
        <button class="btn btn-default btn-xs" title="add arrow" data-ann="arrow"><i class="fa fa-arrow-right"></i>
        </button>
        <button class="btn btn-default btn-xs" title="add frame" data-ann="frame"><i class="fa fa-square-o"></i>
        </button>
      </div>
    </aside>
  </div>
</div>`;

export interface IACLUEWrapperOptions {
  replaceBody?: boolean;
}


export abstract class ACLUEWrapper extends EventHandler {
  clueManager: CLUEGraphManager;
  graph: Promise<ProvenanceGraph>;
  private storyVis: Promise<VerticalStoryVis>;
  private app: IVisStateApp;

  setApplication(app:IVisStateApp) {
    this.app = app;
    this.fire('set_application', this.app);
  }

  protected build(body: HTMLElement, options: IACLUEWrapperOptions) {
    if (options.replaceBody !== false) {
      body.innerHTML = TEMPLATE;
    } else {
      body.insertAdjacentHTML('afterbegin', TEMPLATE);
    }
    handleMagicHashElements(body, this);
    const {graph, storyVis, manager} = this.buildImpl(body);

    this.graph = graph;
    this.clueManager = manager;
    this.storyVis = storyVis;

    this.graph.then((graph) => {
      graph.on('switch_state', (event: any, state: StateNode) => {
        manager.storedState = state ? state.id : null;
      });
      graph.on('select_slide_selected', (event: any, state: SlideNode) => {
        manager.storedSlide = state ? state.id : null;
      });

      enableKeyboardShortcuts(graph);
      this.handleModeChange();

      this.fire('loaded_graph', graph);
    });
  }

  protected abstract buildImpl(body: HTMLElement): {graph: Promise<ProvenanceGraph>, storyVis: Promise<VerticalStoryVis>, manager: CLUEGraphManager};

  private handleModeChange() {
    const $right = $('aside.provenance-layout-vis');
    const $rightStory = $('aside.provenance-story-vis');
    this.propagate(cmode, 'modeChanged');
    const update = (newMode: cmode.CLUEMode) => {
      $('body').attr('data-clue', newMode.toString());
      //$('nav').css('background-color', d3.rgb(255 * new_.exploration, 255 * new_.authoring, 255 * new_.presentation).darker().darker().toString());
      if (newMode.presentation > 0.8) {
        $right.animate({width: 'hide'}, 'fast');
      } else {
        $right.animate({width: 'show'}, 'fast');
      }
      if (newMode.exploration > 0.8) {
        $rightStory.animate({width: 'hide'}, 'fast');
      } else {
        $rightStory.animate({width: 'show'}, 'fast');
      }
    };
    cmode.on('modeChanged', (event, newMode) => update(newMode));
    this.fire('modeChanged', cmode.getMode());
    update(cmode.getMode());
  }


  async nextSlide() {
    if (!this.storyVis) {
      return Promise.reject('no player available');
    }
    const story = await this.storyVis;
    return story.player.forward();
  }

  async previousSlide() {
    if (!this.storyVis) {
      return Promise.reject('no player available');
    }
    const story = await this.storyVis;
    return story.player.backward();
  }

  async jumpToStory(story: number) {
    console.log('jump to stored story', story);
    if (!this.storyVis) {
      return Promise.reject('no player available');
    }
    const graph = await this.graph;
    const storyVis = await this.storyVis;
    const s = graph.getSlideById(story);
    if (s) {
      console.log('jump to stored story', s.id);
      storyVis.switchTo(s);
      if (this.clueManager.isAutoPlay) {
        storyVis.player.start();
      } else {
        await storyVis.player.render(s);
      }
      this.fire('jumped_to', s);
      return this;
    }
    this.fire('jumped_to', null);
    return Promise.reject('story not found');
  }

  async jumpToState(state: number) {
    console.log('jump to stored state', state);
    const graph = await this.graph;
    const s = graph.getStateById(state);
    if (s) {
      console.log('jump to stored', s.id);
      await graph.jumpTo(s);
      console.log('jumped to stored', s.id);
      this.fire('jumped_to', s);
      return this;
    }
    this.fire('jumped_to', null);
    return Promise.reject('state not found');
  }

  jumpToStored() {
    //jump to stored state
    const targetStory = this.clueManager.storedSlide;
    if (targetStory !== null) {
      return this.jumpToStory(targetStory);
    }
    const targetState = this.clueManager.storedState;
    if (targetState !== null) {
      return this.jumpToState(targetState);
    }
    this.fire('jumped_to', null);
    //no stored state nothing to jump to
    return Promise.resolve(this);
  }

  jumpToStoredOrLastState() {
    //jump to stored state
    const targetStory = this.clueManager.storedSlide;
    if (targetStory !== null) {
      return this.jumpToStory(targetStory);
    }
    const targetState = this.clueManager.storedState;
    if (targetState !== null) {
      return this.jumpToState(targetState);
    }

    return this.graph.then((graph) => {
      const maxId = Math.max(...graph.states.map((s) => s.id));
      return this.jumpToState(maxId);
    });
  }
}

export function createStoryVis(graph: ProvenanceGraph, parent: HTMLElement, main: HTMLElement, options: {thumbnails: boolean}) {
  const r = createAnnotation(main, graph);

  const storyvis = createStory(graph, parent, {
    render: r.render,
    thumbnails: options.thumbnails
  });

  graph.on('select_slide_selected', (event, state) => {
    select('aside.annotations').style('display', state ? null : 'none');
  });
  select('aside.annotations > div:first-of-type').call(behavior.drag().on('drag', function () {
    const mouse = d3mouse(this.parentElement.parentElement);
    select(this.parentElement).style({
      left: mouse[0] + 'px',
      top: mouse[1] + 'px'
    });
  }));

  selectAll('aside.annotations button[data-ann]').on('click', function () {
    const create = this.dataset.ann;
    let ann;
    switch (create) {
      case 'text':
        ann = {
          type: 'text',
          pos: [10, 10],
          text: ''
        };
        break;
      case 'arrow':
        ann = {
          type: 'arrow',
          pos: [10, 10],
          at: [200, 200]
        };
        //that.data.appendToStory(that.story.story, that.data.makeTextStory('Unnamed');
        //this.actStory.addText();
        break;
      case 'frame':
        ann = {
          type: 'frame',
          pos: [10, 10],
          size: [20, 20]
        };
        break;
    }
    if (storyvis && ann) {
      storyvis.pushAnnotation(ann);
    }
  });
  return storyvis;
}

export default ACLUEWrapper;

