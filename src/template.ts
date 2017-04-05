/**
 * provides a template wrapper around an application for including CLUE. Includes the common frame for switching modes, provenance, and story visualizations
 *
 * Created by Samuel Gratzl on 27.08.2015.
 */

import * as template from 'html-loader!./_template.html';

import {hash, mixin} from 'phovea_core/src/index';
import {IHeaderLink, create as createHeader, AppHeaderLink, IAppHeaderOptions, AppHeader} from 'phovea_ui/src/header';
import {create as createData} from 'phovea_core/src/data';
import {IDataDescription} from 'phovea_core/src/datatype';
import {list as listVis} from 'phovea_core/src/vis';
import {
  MixedStorageProvenanceGraphManager,
  IProvenanceGraphDataDescription,
  ProvenanceGraph,
  IObjectRef,
  StateNode,
  SlideNode
} from 'phovea_core/src/provenance';
import {event as d3event, select, selectAll, time, mouse as d3mouse, behavior} from 'd3';
import * as $ from 'jquery';
import {create as createSelection} from './selection';
import * as cmode from './mode';
import {create as createProvVis} from './provvis';
import {create as createStoryVis, VerticalStoryVis} from './storyvis';
import {EventHandler, IEvent} from 'phovea_core/src/event';
import {create as createAnnotation}  from './annotation';
import {bindLoginForm, form as loginForm, logout} from 'phovea_security_flask/src/login';
import {retrieve} from 'phovea_core/src/session';
import {generateDialog, areyousure} from 'phovea_ui/src/dialogs';
import {setLoggedIn, isLoggedIn} from './user';


export class CLUEGraphManager {
  constructor(private manager: MixedStorageProvenanceGraphManager) {
    //selected by url
  }

  static setGraphInUrl(value: string) {
    hash.removeProp('clue_slide', false);
    hash.removeProp('clue_state', false);
    hash.setProp('clue_graph', value);
  }

  newRemoteGraph() {
    if (isLoggedIn()) {
      CLUEGraphManager.setGraphInUrl('new_remote');
      window.location.reload();
    }
  }

  newGraph() {
    CLUEGraphManager.setGraphInUrl('new');
    window.location.reload();
  }

  loadGraph(desc: any) {
    // reset
    CLUEGraphManager.setGraphInUrl(desc.id);
    window.location.reload();
  }

  get storedSlide() {
    return hash.getInt('clue_slide', null);
  }

  set storedSlide(value: number) {
    if (value !== null) {
      hash.setInt('clue_slide', value);
    } else {
      hash.removeProp('clue_slide');
    }
  }

  get storedState() {
    return hash.getInt('clue_state', null);
  }

  set storedState(value: number) {
    if (value !== null) {
      hash.setInt('clue_state', value);
    } else {
      hash.removeProp('clue_state');
    }
  }

  get isAutoPlay() {
    return hash.is('clue_autoplay');
  }

  list() {
    return this.manager.list();
  }

  delete(graph: IProvenanceGraphDataDescription) {
    return this.manager.delete(graph);
  }

  importGraph(dump: any, remote = false) {
    (remote ? this.manager.importRemote(dump) : this.manager.importLocal(dump)).then((graph) => {
      this.loadGraph(graph.desc);
    });
  }

  setGraph(graph: ProvenanceGraph) {
    hash.setProp('clue_graph', graph.desc.id);
  }

  choose(list: IDataDescription[]) {
    const loggedIn = retrieve('logged_in', <boolean>false) === true;
    const graph = hash.getProp('clue_graph', null);
    if (graph === 'new_remote' && loggedIn) {
      return this.manager.createRemote();
    }
    if (graph === null || graph === 'new') {
      return this.manager.createLocal();
    }
    const desc = <IProvenanceGraphDataDescription>list.find((d) => d.id === graph);
    if (desc) {
      if ((<any>desc).local || loggedIn) {
        return this.manager.get(desc);
      }
      return this.manager.cloneLocal(desc);
    }
    return this.manager.create();
  }

  loadOrClone(graph: IProvenanceGraphDataDescription, isSelect: boolean) {
    if (isSelect) {
      this.loadGraph(graph);
    } else {
      this.manager.cloneLocal(graph).then((graph) => this.loadGraph(graph.desc));
    }
  }
}
/**
 * create the provenance graph selection dropdown and handles the graph selection
 * @param manager
 * @param $ul
 * @returns {Promise<U>}
 */
function chooseProvenanceGraph(manager: CLUEGraphManager, $ul: d3.Selection<any>): Promise<ProvenanceGraph> {

  //new button
  $ul.select('#provenancegraph_new_remote').on('click', () => {
    (<Event>d3event).preventDefault();
    manager.newRemoteGraph();
  });
  //new local
  $ul.select('#provenancegraph_new').on('click', () => {
    (<Event>d3event).preventDefault();
    manager.newGraph();
  });

  selectAll('#provenancegraph_import, #provenancegraph_import_remote').on('click', function () {
    const e = (<Event>d3event);
    e.preventDefault();
    e.stopPropagation();
    const remote = this.id === 'provenancegraph_import_remote';
    //import dialog
    const d = generateDialog('Select File', 'Upload');
    d.body.innerHTML = `<input type="file" placeholder="Select File to Upoad">`;
    select(d.body).select('input').on('change', function () {
      const file = (<any>d3event).target.files[0];
      const reader = new FileReader();
      reader.onload = function (e: any) {
        const dataS = e.target.result;
        const dump = JSON.parse(dataS);
        manager.importGraph(dump, remote);
      };
      // Read in the image file as a data URL.
      reader.readAsText(file);
    });
    d.show();
  });

  return manager.list().then((list) => {
    const $list = $ul.select('#provenancegraph_list').selectAll('li.graph').data(list);
    $list.enter().insert('li', ':first-child').classed('graph', true).html((d) => `<a href="#clue_graph=${d.id}"><i class="fa fa-code-fork fa-rotate-180" aria-hidden="true"></i> ${d.name} </a>`).select('a').on('click', (d) => {
      (<Event>d3event).preventDefault();
      manager.loadGraph(d);
    });
    const format = time.format.utc('%Y-%m-%dT%H:%M');
    (<any>$('#provenancegraph_list li.graph a')).popover({
      html: true,
      placement: 'left',
      trigger: 'manual',
      title() {
        const graph = select(this).datum();
        return `${graph.name}`;
      },
      content() {
        const graph = select(this).datum();
        const creator = graph.creator;
        const description = graph.description || '';
        const ts = graph.ts ? format(new Date(graph.ts)) : 'Unknown';
        const nnodes = graph.size[0];
        const nedges = graph.size[1];
        //const locked = false;
        const $elem = $(`
            <div class="container-fluid">
            <div class="row">
                <div class="col-sm-3">creator:</div>
                <div class="col-sm-9">${creator}</div>
            </div>
            <div class="row">
                <div class="col-sm-3">created:</div>
                <div class="col-sm-9">${ts}</div>
            </div>
            <div class="row">
                <div class="col-sm-3">description:</div>
                <div class="col-sm-9">${description}</div>
            </div>
            <div class="row">
                <div class="col-sm-3">nodes/edges:</div>
                <div class="col-sm-9">${nnodes}/${nedges}</div>
            </div>
            <div class="row">
                <div class="col-sm-12 text-right">
                    <button class="btn btn-primary" ${retrieve('logged_in', <boolean>false) !== true && !graph.local ? 'disabled="disabled"' : ''} data-action="select" data-toggle="modal"><span class="fa fa-folder-open" aria-hidden="true"></span> Select</button>
                    <button class="btn btn-primary" data-action="clone" data-toggle="modal"><span class="fa fa-clone" aria-hidden="true"></span> Clone</button>
                    <button class="btn btn-danger" ${retrieve('logged_in', <boolean>false) !== true && !graph.local ? 'disabled="disabled"' : ''} data-toggle="modal"><i class="fa fa-trash" aria-hidden="true"></i> Delete</button>
                </div>
            </div>
        </div>`);
        $elem.find('button.btn-danger').on('click', () => {
          areyousure('Are you sure to delete: "' + graph.name + '"').then((deleteIt) => {
            if (deleteIt) {
              manager.delete(graph);
            }
          });
        });
        $elem.find('button.btn-primary').on('click', function () {
          const isSelect = this.dataset.action === 'select';
          manager.loadOrClone(graph, isSelect);
          return false;
        });
        return $elem;
      }
    }).parent().on({
      mouseenter() {
        (<any>$(this).find('a')).popover('show');
      },
      mouseleave() {
        (<any>$(this).find('a')).popover('hide');
      }
    });
    return manager.choose(list);
  }).then((graph) => {
    manager.setGraph(graph);
    $ul.select('#provenancegraph_name').text(graph.desc.name);
    return graph;
  });
}

/**
 * injection for headless support
 * @param wrapper
 */
function injectHeadlessSupport(wrapper: CLUEWrapper) {
  const w: any = window;
  w.__caleydo = w.__caleydo || {};
  w.__caleydo.clue = wrapper;
  wrapper.on('jumped_to', () => {
    setTimeout(() => {
      document.body.classList.add('clue_jumped');
      prompt('clue_done_magic_key', 'test');
    }, 5000);

  });
}

function injectParentWindowSupport(wrapper: CLUEWrapper) {
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

export class CLUEWrapper extends EventHandler {
  private options: ICLUEWrapperOptions = {
    app: 'CLUE',
    application: '/clue',
    id: 'clue',
    recordSelectionTypes: 'selected',
    animatedSelections: false,
    thumbnails: true,
    appLink: new AppHeaderLink('CLUE'),
    provVisCollapsed: false,
    headerOptions: {},
    loginForm: String(loginForm)
  };

  private manager: MixedStorageProvenanceGraphManager;
  clueManager: CLUEGraphManager;

  graph: Promise<ProvenanceGraph>;
  header: AppHeader;
  $main: d3.Selection<any>;
  $mainRef: IObjectRef<d3.Selection<any>>;

  private storyvis: VerticalStoryVis;

  constructor(body: HTMLElement, options: ICLUEWrapperOptions = {}) {
    super();
    const that = this;
    mixin(this.options, options);

    // replace content with the template
    body.innerHTML = String(template);

    //special flag for rendering server side screenshots
    if (hash.is('clue_headless')) {
      console.log('init headless mode');
      injectHeadlessSupport(this);
      select('body').classed('headless', true);
    }
    if (hash.is('clue_contained')) {
      console.log('init contained mode');
      injectParentWindowSupport(this);
      select('body').classed('headless', true);
    }

    //load all available provenance graphs
    this.manager = new MixedStorageProvenanceGraphManager({
      prefix: this.options.id,
      storage: sessionStorage,
      application: this.options.application
    });
    this.clueManager = new CLUEGraphManager(this.manager);

    //create the common header
    const headerOptions = mixin(this.options.headerOptions, {
      showOptionsLink: true, // always activate options
      appLink: this.options.appLink
    });
    this.header = createHeader(<HTMLElement>body.querySelector('div.box'), headerOptions);

    this.header.wait();

    this.createLogin();

    {
      //add provenance graph management menu entry
      const ul = document.createElement('ul');
      const $ul = select(ul)
        .attr('class', 'nav navbar-nav navbar-right')
        .attr('data-clue', 'provenanceGraphList')
        .html(`<li class="dropdown">
          <a class="active" href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true" aria-expanded="false">
            <i class="fa fa-code-fork fa-lg fa-rotate-180 fa-fw"></i>
          </a>
          <ul class="dropdown-menu" id="provenancegraph_list">
            <li role="separator" class="divider"></li>
            <li>
              <a href="#" id="provenancegraph_import">
                <i class="fa fa-upload" aria-hidden="true"></i> Import ...
              </a>
            </li>
            <li>
              <a href="#" class="login_required disabled" disabled="disabled" id="provenancegraph_import_remote">
                <i class="fa fa-cloud-upload" aria-hidden="true"></i> Import Remote ...
              </a>
            </li>
            <li>
              <a href="#" id="provenancegraph_export">
                <i class="fa fa-download" aria-hidden="true"></i> Export ...
              </a>
            </li>
            <li role="separator" class="divider"></li>
            <li>
              <a href="#" id="provenancegraph_new">
                <i class="fa fa-plus-circle" aria-hidden="true"></i> New ...
              </a>
            </li>
            <li>
              <a href="#" class="login_required disabled" disabled="disabled" id="provenancegraph_new_remote">
                <i class="fa fa-cloud" aria-hidden="true"></i> New Remote...
              </a>
            </li>
          </ul>
        </li>`);

      this.header.insertCustomRightMenu(ul);

      select('#provenancegraph_export').on('click', () => {
        const e = (<Event>d3event);
        e.preventDefault();
        e.stopPropagation();
        this.graph.then((g) => {
          console.log(g);
          const r = g.persist();
          console.log(r);

          const str = JSON.stringify(r, null, '\t');
          //create blob and save it
          const blob = new Blob([str], {type: 'application/json;charset=utf-8'});
          const a = new FileReader();
          a.onload = (e) => window.open((<any>e.target).result, '_blank');
          a.readAsDataURL(blob);
        });
        return false;
      });

      select(this.header.optionsDialog)
        .append('button').text('Show Provenance Graph')
        .attr('class', 'btn btn-default')
        .on('click', () => {
          this.graph.then((g: ProvenanceGraph) => {
            return createData({
              id: g.desc.id,
              name: g.desc.name,
              description: '',
              fqname: g.desc.fqname,
              type: 'graph',
              storage: 'given',
              graph: g.backend,
              creator: 'Anonymous',
              ts: Date.now()
            });
          })
            .then((proxy) => {
              const l = listVis(proxy);
              if (l.length <= 0) {
                return;
              }
              l[0].load().then((force) => {
                const p = generateDialog('Provenance Graph');
                force.factory(proxy, p.body);
                p.show();
              });
            });
          return false;
        });

      this.graph = chooseProvenanceGraph(this.clueManager, $ul);
    }


    //cmode.create(body.querySelector('#modeselector'));
    const modeselector = body.querySelector('header');
    modeselector.className += 'clue-modeselector';
    cmode.createButton(modeselector, {
      size: 'sm'
    });
    //cmode.createSlider(body.querySelector('#modeselector'));

    this.$main = select(body).select('main');

    this.graph.then((graph) => {
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

      this.$mainRef = graph.findOrAddObject(this.$main, 'Application', 'visual');

      const r = createAnnotation(<HTMLElement>this.$main.node(), graph);


      /*const seditor = storyeditor.create(graph, body.querySelector('#storyeditor'), {
       editor: r.edit
       });
       */


      createProvVis(graph, body.querySelector('div.content'), {
        thumbnails: this.options.thumbnails,
        provVisCollapsed: this.options.provVisCollapsed
      });

      this.storyvis = createStoryVis(graph, body.querySelector('div.content'), {
        render: r.render,
        thumbnails: this.options.thumbnails
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
        if (that.storyvis && ann) {
          that.storyvis.pushAnnotation(ann);
        }
      });

      graph.on('switch_state', (event: any, state: StateNode) => {
        this.clueManager.storedState = state ? state.id : null;
      });
      graph.on('select_slide_selected', (event: any, state: SlideNode) => {
        this.clueManager.storedSlide = state ? state.id : null;
      });

      {
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

      //d3.select('#attachScreenshot').on('click', () => {
      //  const main = <HTMLElement>(document.querySelector('main *[data-main]') || document.querySelector('main'));
      //  const bounds = C.bounds(main);
      //  this.header.wait();
      //  screenshot.takeCanvas(main, [bounds.w/2, bounds.h/2]).then((canvas) => {
      //    this.header.ready();
      //    graph.act.setAttr('screenshot', screenshot.toString(canvas));
      //    graph.act.setAttr('thumbnail', screenshot.toString(screenshot.createThumbnailCanvas(canvas, 128)));
      //  }).catch((error) => {
      //    console.log(error);
      //  });
      //});
      select('#bookmarkState').on('click', () => {
        graph.act.setAttr('starred', true);
      });
      select('#attachNote form').on('submit', () => {
        const note = select('#attachNote_note').property('value');
        const e = (<Event>d3event);
        graph.act.setAttr('note', note);
        (<any>$('#attachNote')).modal('hide');
        (<HTMLFormElement>document.querySelector('#attachNote form')).reset();
        e.preventDefault();
        e.stopPropagation();
      });

      //undo the step
      select('#undoStep').on('click', () => {
        graph.undo();
      });
      //undo using ctrl-z
      select(document).on('keydown.player', () => {
        const k = <KeyboardEvent>d3event;
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

      this.fire('loaded_graph', graph);

      this.header.ready();
    });
  }

  private createLogin() {
    {
      const ul = document.createElement('ul');
      ul.classList.add('nav', 'navbar-nav', 'navbar-right');
      ul.innerHTML = `
      <li id="login_menu">
        <a data-toggle="modal" data-target="#loginDialog" href="#">
        <i class="fa fa-user fa-fw" aria-hidden="true"></i>
        </a></li>
        <li style="display: none" class="dropdown" id="user_menu">
            <a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true"
               aria-expanded="false"><i class="fa fa-user" aria-hidden="true"></i> Unknown</a>
            <ul class="dropdown-menu">
                <li role="separator" class="divider"></li>
                <li><a href="#" id="logout_link">Logout</a></li>
            </ul>
        </li>`;

      this.header.insertCustomRightMenu(ul);
    }
    const that = this;
    {
      const $form = $('#loginDialog div.modal-body').html(this.options.loginForm).find('form');
      const $alert = $form.parent().find('div.alert');

      $alert.hide();
      bindLoginForm(<HTMLFormElement>$form[0], (error, user) => {
        setLoggedIn((!error && user) ? true : false, user);
        if (!error && user) {
          $('#login_menu').hide();
          const $base = $('#user_menu').show();
          $form.removeClass('has-error');
          $base.find('> a:first').text(user.name);

          (<any>$('#loginDialog')).modal('hide');

          $('.login_required.disabled').removeClass('disabled').attr('disabled', null);
        } else {
          that.header.ready();
          $form.addClass('has-error');
          $alert.html(error).show();
        }
      });
    }


    $('#logout_link').on('click', () => {
      that.header.wait();
      logout().then(function () {
        setLoggedIn(false);
        $('#user_menu').hide();
        $('#login_menu').show();
        $('.login_required').addClass('disabled');
        that.header.ready();
      });
    });
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
