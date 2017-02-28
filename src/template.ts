/**
 * provides a template wrapper around an application for including CLUE. Includes the common frame for switching modes, provenance, and story visualizations
 *
 * Created by Samuel Gratzl on 27.08.2015.
 */

import {hash, mixin} from 'phovea_core/src/index';
import {IHeaderLink, create as createHeader, AppHeaderLink, IAppHeaderOptions, AppHeader} from 'phovea_ui/src/header';
import {
  MixedStorageProvenanceGraphManager,
  IProvenanceGraphDataDescription,
  ProvenanceGraph,
  IObjectRef,
  StateNode,
  SlideNode
} from 'phovea_core/src/provenance';
import {select, selectAll, mouse as d3mouse, behavior} from 'd3';
import * as $ from 'jquery';
import {create as createSelection} from './selection';
import * as cmode from './mode';
import {create as createProvVis} from './provvis';
import {create as createStoryVis, VerticalStoryVis} from './storyvis';
import {EventHandler, IEvent} from 'phovea_core/src/event';
import {create as createAnnotation}  from './annotation';
import CLUEGraphManager from './CLUEGraphManager';
import ProvenanceGraphMenu from './menu/ProvenanceGraphMenu';
import LoginMenu from './menu/LoginMenu';
import {handleMagicHashElements, enableKeyboardShortcuts} from './internal';

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

export interface ICLUEWrapperOptions {
  /**
   * the name of the application
   */
  app?: string;
  /**
   * the URL of the application, used e.g., for generating screenshots
   */
  application?: string;
  /**
   * the id of the application, for differentiating provenance graphs
   */
  id?: string;
  /**
   * the selection type to record
   */
  recordSelectionTypes?: string;
  /**
   * whether selection replays should be animated
   */
  animatedSelections?: boolean;
  /**
   * whether thumbnails should be shown in the provenance or story vis
   */
  thumbnails?: boolean;
  /**
   * App Header Link
   */
  appLink?: IHeaderLink;
  /**
   * Should the provenance graph layout be collapsed by default?
   */
  provVisCollapsed?: boolean;
  /**
   * Options that will be passed to the header
   */
  headerOptions?: IAppHeaderOptions;

  /**
   * formular used for the login dialog
   */
  loginForm?: string;
}

export default class CLUEWrapper extends EventHandler {
  private options: ICLUEWrapperOptions = {
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

  private readonly manager: MixedStorageProvenanceGraphManager;
  readonly clueManager: CLUEGraphManager;
  readonly graph: Promise<ProvenanceGraph>;

  readonly header: AppHeader;
  readonly $main: d3.Selection<any>;
  $mainRef: IObjectRef<d3.Selection<any>>;

  private storyvis: VerticalStoryVis;

  constructor(body: HTMLElement, options: ICLUEWrapperOptions = {}) {
    super();
    mixin(this.options, options);

    body.insertAdjacentHTML('afterbegin', TEMPLATE);
    this.$main = select(body).select('main');

    handleMagicHashElements(body, this);


    //create the common header
    const headerOptions = mixin(this.options.headerOptions, {
      showOptionsLink: true, // always activate options
      appLink: this.options.appLink
    });
    this.header = createHeader(<HTMLElement>body.querySelector('div.box'), headerOptions);

    //load all available provenance graphs
    this.manager = new MixedStorageProvenanceGraphManager({
      prefix: this.options.id,
      storage: sessionStorage,
      application: this.options.application
    });
    this.clueManager = new CLUEGraphManager(this.manager);

    this.header.wait();

    const loginMenu = new LoginMenu(this.header, {
      loginForm: this.options.loginForm,
      insertIntoHeader: true
    });
    const provenanceMenu = new ProvenanceGraphMenu(this.clueManager, body, false);
    this.header.insertCustomRightMenu(provenanceMenu.node);

    const modeSelector = body.querySelector('header');
    modeSelector.className += 'clue-modeselector';
    cmode.createButton(modeSelector, {
      size: 'sm'
    });


    this.graph = this.clueManager.list().then((graphs) => {
      provenanceMenu.build(graphs);
      return this.clueManager.choose(graphs);
    });

    this.graph.then((graph) => {
      provenanceMenu.setGraph(graph);
      this.$mainRef = graph.findOrAddObject(this.$main, 'Application', 'visual');

      graph.on('sync_start,sync', (event: IEvent) => {
        select('nav span.glyphicon-cog').classed('fa-spin', event.type !== 'sync');
      });

      graph.on('switch_state', (event: any, state: StateNode) => {
        this.clueManager.storedState = state ? state.id : null;
      });
      graph.on('select_slide_selected', (event: any, state: SlideNode) => {
        this.clueManager.storedSlide = state ? state.id : null;
      });

      if (this.options.recordSelectionTypes) {
        //record selections of the given type
        createSelection(graph, this.options.recordSelectionTypes, {
          filter(idtype) {
            return idtype && idtype.name[0] !== '_';
          },
          animated: this.options.animatedSelections
        });
      }

      createProvVis(graph, body.querySelector('div.content'), {
        thumbnails: this.options.thumbnails,
        provVisCollapsed: this.options.provVisCollapsed
      });
      this.storyvis = CLUEWrapper.createStoryVis(graph, <HTMLElement>body.querySelector('div.content'), <HTMLElement>this.$main.node(), {
        thumbnails: this.options.thumbnails
      });

      enableKeyboardShortcuts(graph);
      this.handleModeChange();

      this.fire('loaded_graph', graph);

      this.header.ready();
    });
  }

  private handleModeChange() {
    const $right = $('aside.provenance-layout-vis');
    const $rightStory = $(this.storyvis.node);
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

  private static createStoryVis(graph: ProvenanceGraph, parent: HTMLElement, main: HTMLElement, options: {thumbnails: boolean}) {
    const r = createAnnotation(main, graph);

    const storyvis = createStoryVis(graph, parent, {
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

  nextSlide() {
    return this.graph.then((graph) => {
      return this.storyvis.player.forward();
    });
  }

  previousSlide() {
    return this.graph.then((graph) => {
      return this.storyvis.player.backward();
    });
  }

  jumpToStory(story: number) {
    console.log('jump to stored story', story);
    return this.graph.then((graph) => {
      const s = graph.getSlideById(story);
      if (s) {
        console.log('jump to stored story', s.id);
        this.storyvis.switchTo(s);
        let next;
        if (this.clueManager.isAutoPlay) {
          this.storyvis.player.start();
          next = Promise.resolve();
        } else {
          next = this.storyvis.player.render(s);
        }
        return next.then(() => {
          this.fire('jumped_to', s);
          this.header.ready();
          return this;
        });
      }
      this.fire('jumped_to', null);
      this.header.ready();
      return Promise.reject('story not found');
    });
  }

  jumpToState(state: number) {
    console.log('jump to stored state', state);
    return this.graph.then((graph) => {
      const s = graph.getStateById(state);
      if (s) {
        console.log('jump to stored', s.id);
        return graph.jumpTo(s).then(() => {
          console.log('jumped to stored', s.id);
          this.fire('jumped_to', s);
          this.header.ready();
          return this;
        });
      }
      this.fire('jumped_to', null);
      this.header.ready();
      return Promise.reject('state not found');
    });
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
    this.header.ready();
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

  reset() {
    this.graph.then((graph) => {
      graph.jumpTo(graph.states[0]).then(() => {
        graph.clear();
        this.$mainRef = graph.findOrAddObject(this.$main, 'Application', 'visual');
        cmode.setMode(cmode.modes.Exploration);
      });
    });
  }
}

/**
 * factory method creating a CLUEWrapper instance
 * @param body
 * @param options
 * @returns {CLUEWrapper}
 */
export function create(body: HTMLElement, options: any = {}) {
  return new CLUEWrapper(body, options);
}
