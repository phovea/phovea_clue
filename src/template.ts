/**
 * provides a template wrapper around an application for including CLUE. Includes the common frame for switching modes, provenance, and story visualizations
 *
 * Created by Samuel Gratzl on 27.08.2015.
 */

import {mixin} from 'phovea_core/src/index';
import {IHeaderLink, create as createHeader, AppHeaderLink, IAppHeaderOptions, AppHeader} from 'phovea_ui/src/header';
import {
  MixedStorageProvenanceGraphManager,
  IObjectRef
} from 'phovea_core/src/provenance';
import {select} from 'd3';
import {create as createSelection} from './selection';
import * as cmode from './mode';
import {loadProvenanceGraphVis, loadStoryVis} from './vis_loader';
import {IEvent} from 'phovea_core/src/event';
import CLUEGraphManager from './CLUEGraphManager';
import ProvenanceGraphMenu from './menu/ProvenanceGraphMenu';
import LoginMenu from './menu/LoginMenu';
export {default as CLUEGraphManager} from './CLUEGraphManager';
import ACLUEWrapper, {IACLUEWrapperOptions} from './ACLUEWrapper';


export interface ICLUEWrapperOptions extends IACLUEWrapperOptions {
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

export class CLUEWrapper extends ACLUEWrapper {
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

  header: AppHeader;
  $main: d3.Selection<any>;
  $mainRef: IObjectRef<d3.Selection<any>>;

  constructor(body: HTMLElement, options: ICLUEWrapperOptions = {}) {
    super();
    mixin(this.options, options);
    this.build(body, options);
    this.on('jumped_to,loaded_graph', () => this.header.ready());
  }

  protected buildImpl(body: HTMLElement) {
    //create the common header
    const headerOptions = mixin(this.options.headerOptions, {
      showOptionsLink: true, // always activate options
      appLink: this.options.appLink
    });
    this.header = createHeader(<HTMLElement>body.querySelector('div.box'), headerOptions);

    //load all available provenance graphs
    const manager = new MixedStorageProvenanceGraphManager({
      prefix: this.options.id,
      storage: sessionStorage,
      application: this.options.application
    });
    const clueManager = new CLUEGraphManager(manager);

    this.header.wait();

    new LoginMenu(this.header, {
      loginForm: this.options.loginForm,
      insertIntoHeader: true
    });
    const provenanceMenu = new ProvenanceGraphMenu(clueManager, body, false);
    this.header.insertCustomRightMenu(provenanceMenu.node);

    const modeSelector = body.querySelector('header');
    modeSelector.className += 'clue-modeselector';
    cmode.createButton(modeSelector, {
      size: 'sm'
    });

    this.$main = select(body).select('main');

    const graph = clueManager.list().then((graphs) => {
      provenanceMenu.build(graphs);
      return clueManager.choose(graphs);
    });

    graph.then((graph) => {
      provenanceMenu.setGraph(graph);
      this.$mainRef = graph.findOrAddObject(this.$main, 'Application', 'visual');

      graph.on('sync_start,sync', (event: IEvent) => {
        select('nav span.glyphicon-cog').classed('fa-spin', event.type !== 'sync');
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
    });

    const provVis = loadProvenanceGraphVis(graph, body.querySelector('div.content'), {
      thumbnails: this.options.thumbnails,
      provVisCollapsed: this.options.provVisCollapsed
    });
    const storyVis = loadStoryVis(graph, <HTMLElement>body.querySelector('div.content'), <HTMLElement>this.$main.node(), {
      thumbnails: this.options.thumbnails
    });

    return {graph, manager: clueManager, storyVis, provVis};
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
export default CLUEWrapper;

/**
 * factory method creating a CLUEWrapper instance
 * @param body
 * @param options
 * @returns {CLUEWrapper}
 */
export function create(body: HTMLElement, options: any = {}) {
  return new CLUEWrapper(body, options);
}
