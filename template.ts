/**
 * Created by Samuel Gratzl on 27.08.2015.
 */
/// <amd-dependency path='font-awesome' />
/// <amd-dependency path='bootstrap' />
/// <amd-dependency path='css!./style' />


/// <amd-dependency path="text!./template.html" name="template"/>
declare var template:string;

import C = require('../caleydo_core/main');
import header = require('../wrapper_bootstrap_fontawesome/header');
import prov = require('../caleydo_provenance/main');
import d3 = require('d3');
import $ = require('jquery');
import prov_sel = require('../caleydo_provenance/selection');
import selection = require('../caleydo_d3/selectioninfo');
import cmode = require('../caleydo_provenance/mode');
import provvis2 = require('./provvis2');
import storyvis = require('./storyvis2');
import player = require('../caleydo_provenance/player');
import events = require('../caleydo_core/event');
import screenshot = require('../caleydo_screenshot/main');
import renderer = require('./annotation');
import login = require('../caleydo_security_flask/login');
import dialogs = require('../wrapper_bootstrap_fontawesome/dialogs');

function chooseProvenanceGraph(manager: prov.IProvenanceGraphManager, $ul: d3.Selection<any>): Promise<prov.ProvenanceGraph> {
  const graph = C.hash.getProp('clue_graph', null);
  $ul.select('#provenancegraph_new').on('click', () => {
    C.hash.setProp('clue_graph', 'new');
    window.location.reload();
      d3.event.preventDefault();
  });
  return manager.list().then((list) => {
    const $list = $ul.select('#provenancegraph_list').selectAll('li.graph').data(list);
    $list.enter().insert('li', ':first-child').classed('graph',true).html((d) => `<a href="#clue_graph=${d.id}"><span class="glyphicon glyphicon-file"></span> ${d.name} </a>`).select('a').on('click', (d) => {
      C.hash.setProp('clue_graph', d.id);
      window.location.reload();
      d3.event.preventDefault();
    });
    (<any>$('#provenancegraph_list li.graph a')).popover({
      html: true,
      trigger: 'manual',
      title: function() {
        const graph = d3.select(this).datum();
        return `${graph.name}`;
      },
      content: function() {
        const graph = d3.select(this).datum();
        const creator = graph.creator;
        const description = graph.description;
        const ts = graph.ts;
        const nnodes = graph.size[0];
        const nedges = graph.size[1];
        const locked = false;
        const $elem = $(`
            <div class="container-fluid">
            <div class="row">
                <div class="col-sm-3">Creator:</div>
                <div class="col-sm-9">${creator}</div>
            </div>
            <div class="row">
                <div class="col-sm-3">Creationdate:</div>
                <div class="col-sm-9">${ts}</div>
            </div>
            <div class="row">
                <div class="col-sm-3">Description:</div>
                <div class="col-sm-9">${description}</div>
            </div>
            <div class="row">
                <div class="col-sm-3">Nodes/Edges:</div>
                <div class="col-sm-9">${nnodes}/${nedges}</div>
            </div>
            <div class="row">
                <div class="col-sm-12 text-right">
                    <button class="btn btn-primary" data-toggle="modal"><span class="fa fa-open"></span> Select</button>
                    <button class="btn btn-warning" data-toggle="modal"><span class="fa fa-${locked ? 'unlock' : 'lock'}"></span> Lock</button>
                    <button class="btn btn-danger" data-toggle="modal"><span class="glyphicon glyphicon-remove"></span> Delete</button>
                </div>
            </div>
        </div>`);
        $elem.find('button.btn-danger').on('click', () => {
          dialogs.areyousure('Are you sure to delete: "'+graph.name+'"').then((deleteIt) => {
            if (deleteIt) {
              //TODO
            }
          });
        });
        $elem.find('button.btn-warning').on('click', () => {
          //TODO lock
        });
        return $elem;
      }
    }).parent().on({
      mouseenter: function () {
        (<any>$(this).find('a')).popover('show');
      },
      mouseleave: function () {
        (<any>$(this).find('a')).popover('hide');
      }
    });

    if (graph === null || graph === 'new') {
      return manager.create();
    }
    const desc = list.filter((d) => d.id === graph)[0];
    if (desc) {
      return manager.get(desc);
    }
    return manager.create();
  }).then((graph) => {
    C.hash.setProp('clue_graph', graph.desc.id);
    $ul.select('#provenancegraph_name').text(graph.desc.name);
    return graph;
  });
}

/**
 * injection for headless support
 * @param wrapper
 */
function injectHeadlessSupport(wrapper: CLUEWrapper) {
  var w : any = window;
  w.__caleydo = w.__caleydo || {};
  w.__caleydo.clue = wrapper;
  wrapper.on('jumped_to', () => {
    setTimeout(() => {
      document.body.classList.add('clue_jumped');
      prompt('clue_done_magic_key','test');
    },5000);

  });
}

export class CLUEWrapper extends events.EventHandler {
  private options = {
    app: 'CLUE',
    application: '/clue_demo',
    id: 'clue_demo'
  };

  private manager : prov.IProvenanceGraphManager;

  graph: Promise<prov.ProvenanceGraph>;
  header: header.AppHeader;
  $main: d3.Selection<any>;
  $main_ref: prov.IObjectRef<d3.Selection<any>>;

  private player: player.Player;
  private storyvis: storyvis.StoryManager;

  constructor(body:HTMLElement, options: any = {}) {
    super();
    C.mixin(this.options, options);
    body.innerHTML = template;

    if (C.hash.is('clue_headless')) {
      console.log('init headless mode');
      injectHeadlessSupport(this);
      d3.select('body').classed('headless', true);
    }

    if (C.hash.getProp('clue_store','local') === 'local') {
      this.manager = new prov.LocalStorageProvenanceGraphManager({
        prefix: this.options.id,
        storage: sessionStorage,
        application: this.options.application
      });
    } else {
      this.manager = new prov.RemoteStorageProvenanceGraphManager({
        application: this.options.application
      });
    }

    this.header = header.create(<HTMLElement>body.querySelector('div.box'), {
      app: this.options.app
    });

    {
      let ul = document.createElement('ul');
      let $ul = d3.select(ul).attr('class','nav navbar-nav').html(`
      <li class="dropdown">
            <a class="active" href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true"
               aria-expanded="false"><span id="provenancegraph_name">No Provenance Graph</span><span class="caret"></span></a>
            <ul class="dropdown-menu" id="provenancegraph_list">
                <li role="separator" class="divider"></li>
                <li><a href="#" id="provenancegraph_new"><span class="glyphicon glyphicon-upload"></span> New ...</a></li>
            </ul>
        </li>`);

      this.header.insertCustomMenu(ul);

      this.graph = chooseProvenanceGraph(this.manager, $ul);
    }


    this.createLogin();

    {
      let div = <HTMLElement>document.createElement('div');
      this.header.insertCustomRightMenu(div);
      div.id = 'player_controls';
      div.classList.add('nav');
      div.classList.add('navbar-nav');
      div.classList.add('navbar-right');
      div.innerHTML = `<button data-player="backward" class="btn btn-xs btn-default fa fa-step-backward" title="Step Backward"></button>
            <button data-player="play" class="btn btn-default fa fa-play" title="Play"></button>
            <button data-player="forward" class="btn btn-xs btn-default fa fa-step-forward" title="Step Forward"></button>`;
    }

    {
      let div = <HTMLElement>document.createElement('div');
      this.header.insertCustomRightMenu(div);
      div.classList.add('nav');
      div.classList.add('navbar-nav');
      div.classList.add('navbar-right');
      div.id = 'modeselector';
    }

    selection.create(body.querySelector('#selectioninfo'), {
      useNames: true,
      filter: (idtype) => {
        return idtype && idtype.name[0] !== '_';
      }
    });

    cmode.create(body.querySelector('#modeselector'));
    cmode.createButton(body.querySelector('#modeselector'));
    cmode.createSlider(body.querySelector('#modeselector'));

    this.$main = d3.select(body).select('main');


    console.log('graph loading');
    this.graph.then((graph) => {
      console.log('graph loaded');
      graph.on('sync_start,sync', (event: events.IEvent) => {
        d3.select('nav span.glyphicon-cog').classed('fa-spin', event.type !== 'sync');
      });

      prov_sel.create(graph, 'selected', {
        filter: function (idtype) {
          return idtype && idtype.name[0] !== '_';
        }
      });

      this.$main_ref = graph.findOrAddObject(this.$main, 'Application', 'visual');

      const r = renderer.create(<HTMLElement>this.$main.node(), graph);

      this.player = new player.Player(graph, body.querySelector('#player_controls'), {
        render: r.render
      });
      /*const seditor = storyeditor.create(graph, body.querySelector('#storyeditor'), {
        editor: r.edit
      });
      */


      provvis2.create(graph, body.querySelector('#provenancevis'), {});

      this.storyvis = storyvis.create(graph, body.querySelector('#storyvis'), {
        render: r.render
      });

     graph.on('switch_state', (event:any, state:prov.StateNode) => {
        C.hash.setInt('clue_state', state.id);
      });
     graph.on('select_story', (event:any, state:prov.SlideNode) => {
        C.hash.setInt('clue_slide', state.id);
      });

      {
        const $right = $('aside.prov_right');
        const $right_story = $('aside.story_right');
        const $left = $('aside.left');
        const $footer = $('#player_controls');
        this.propagate(cmode, 'modeChanged');
        let update = (new_: cmode.CLUEMode) => {
          $('body').attr('data-clue', new_.toString());
          $('nav').css('background-color', d3.rgb(255 * new_.exploration, 255 * new_.authoring, 255 * new_.presentation).darker().darker().toString());
          if (new_.presentation > 0.8) {
            $right.hide(); //({width: 'hide'});
          } else {
            $right.show();
          }
          if (new_.exploration < 0.8) {
            $left.hide(); //({width: 'hide'});
          } else {
            $left.show(); //({width: 'show'});
          }
          if (new_.exploration > 0.2) {
            $footer.hide();
          } else {
            $footer.show();
          }
          if (new_.authoring < 0.8) {
            $right_story.hide(); //({width: 'hide'});
          } else {
            $right_story.show();
          }
        };
        cmode.on('modeChanged', (event, new_) => update(new_));
        this.fire('modeChanged', cmode.getMode());
        update(cmode.getMode());
      }

      d3.select('#attachScreenshot').on('click', () => {
        const main = <HTMLElement>(document.querySelector('main *[data-main]') || document.querySelector('main'));
        const bounds = C.bounds(main);
        this.header.wait();
        screenshot.takeCanvas(main, [bounds.w/2, bounds.h/2]).then((canvas) => {
          this.header.ready();
          graph.act.setAttr('screenshot', screenshot.toString(canvas));
          graph.act.setAttr('thumbnail', screenshot.toString(screenshot.createThumbnailCanvas(canvas, 128)));
        }).catch((error) => {
          console.log(error);
        });
      });
      d3.select('#attachNote form').on('submit', () => {
        const note = d3.select('#attachNote_note').property('value');
        graph.act.setAttr('note', note);
        (<any>$('#attachNote')).modal('hide');
        (<HTMLFormElement>document.querySelector('#attachNote form')).reset();
        d3.event.preventDefault();
        d3.event.stopPropagation();
      });

      //undo the step
      d3.select('#undoStep').on('click', () => {
        graph.undo();
      });
      //undo using ctrl-z
      d3.select(document).on('keydown.player', () => {
        let k = <KeyboardEvent>d3.event;
        if (k.keyCode === 90 && k.ctrlKey) {
          //ctrl-z
          k.preventDefault();
          graph.undo();
        }
      });

      this.fire('loaded_graph', graph);
      console.log('done init');
    });
  }

  private createLogin() {
    {
      let ul = document.createElement('ul');
      let $ul = d3.select(ul).attr('class','nav navbar-nav navbar-right').html(`
      <li id="login_menu"><a data-toggle="modal" data-target="#loginDialog" href="#"><span class="glyphicon glyphicon-user"></span></a></li>
        <li style="display: none" class="dropdown" id="user_menu">
            <a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true"
               aria-expanded="false"><span class="glyphicon glyphicon-user"></span> Unknown</a>
            <ul class="dropdown-menu">
                <li role="separator" class="divider"></li>
                <li><a href="#" id="logout_link">Logout</a></li>
            </ul>
        </li>`);

      this.header.insertCustomRightMenu(ul);
    }
    const that = this;
    $('#loginDialog div.modal-body').load('../caleydo_security_flask/_login_form.html', function () {
      var $form = $(this).find('form'),
        $alert = $form.parent().find('div.alert');

      $alert.hide();
      login.bindLoginForm(<HTMLFormElement>$form[0], (error, user) => {
        $('#login_menu').hide();
        var $base = $('#user_menu').show();

        if (!error) {
          $form.removeClass('has-error');
          $base.find('> a:first').text(user.name);

          (<any>$('#loginDialog')).modal('hide');

          $('.login_required.disabled').removeClass('disabled');
        } else {
          that.header.ready();
          $form.addClass('has-error');
          $alert.html(error).show();
        }
      });
  });


  $('#logout_link').on('click', function () {
    this.header.wait();
    login.logout().then(function() {
      $('#user_menu').hide();
      $('#login_menu').show();
      $('.login_required').addClass('disabled');
      //TODO
    });
  });
  }

  private jumpToStory(story: number) {
    console.log('jump to stored story', story);
    return this.graph.then((graph) => {
      const s = graph.getStoryById(story);
      if (s) {
        console.log('jump to stored story', s.id);
        this.storyvis.switchTo(s);
        var next;
        if (C.hash.is('clue_autoplay')) {
          this.player.start();
          next = Promise.resolve();
        } else {
          next = this.player.render(s);
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

  private jumpToState(state: number) {
    console.log('jump to stored state', state);
    return this.graph.then((graph) => {
      let s = graph.getStateById(state);
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
    const target_story = C.hash.getInt('clue_slide', null);
    if (target_story !== null) {
      return this.jumpToStory(target_story);
    }
    const target_state = C.hash.getInt('clue_state', null);
    if (target_state !== null) {
      return this.jumpToState(target_state);
    }
    this.fire('jumped_to', null);
    this.header.ready();
    //no stored state nothing to jump to
    return Promise.resolve(this);
  }

  reset() {
    this.graph.then((graph) => {
      graph.jumpTo(graph.states[0]).then(() => {
        graph.clear();
        this.$main_ref = graph.findOrAddObject(this.$main, 'Application', 'visual');
        cmode.setMode(cmode.modes.Exploration);
      });
    });
  }
}
export function create(body:HTMLElement, options: any = {}) {
  return new CLUEWrapper(body, options);
}
