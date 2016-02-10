/**
 * Created by Samuel Gratzl on 27.08.2015.
 */
/// <amd-dependency path='font-awesome' />
/// <amd-dependency path='bootstrap' />
/// <amd-dependency path='css!./style' />


/// <amd-dependency path="text!./_template.html" name="template"/>
declare var template:string;

import C = require('../caleydo_core/main');
import header = require('../wrapper_bootstrap_fontawesome/header');
import datas = require('../caleydo_core/data');
import vis = require('../caleydo_core/vis');
import prov = require('../caleydo_provenance/main');
import d3 = require('d3');
import $ = require('jquery');
import prov_sel = require('../caleydo_provenance/selection');
import cmode = require('../caleydo_provenance/mode');
import provvis2 = require('./provvis2');
import storyvis = require('./storyvis2');
import events = require('../caleydo_core/event');
import renderer = require('./annotation');
import login = require('../caleydo_security_flask/login');
import session = require('../caleydo_core/session');
import dialogs = require('../wrapper_bootstrap_fontawesome/dialogs');

function chooseProvenanceGraph(manager: prov.MixedStorageProvenanceGraphManager, $ul: d3.Selection<any>): Promise<prov.ProvenanceGraph> {
  const graph = C.hash.getProp('clue_graph', null);
  $ul.select('#provenancegraph_new_remote').on('click', () => {
    d3.event.preventDefault();
    if (session.retrieve('logged_in') === true) {
      C.hash.removeProp('clue_slide', false);
      C.hash.removeProp('clue_state', false);
      C.hash.setProp('clue_graph', 'new_remote');
      window.location.reload();
    }
  });
  $ul.select('#provenancegraph_new').on('click', () => {
    C.hash.removeProp('clue_slide', false);
    C.hash.removeProp('clue_state', false);
    C.hash.setProp('clue_graph', 'new');
    window.location.reload();
    d3.event.preventDefault();
  });

  function loadGraph(desc : any) {
    C.hash.setProp('clue_graph', desc.id);
    window.location.reload();
  }

  d3.selectAll('#provenancegraph_import, #provenancegraph_import_remote').on('click', function() {
    d3.event.preventDefault();
    d3.event.stopPropagation();
    var remote = this.id === 'provenancegraph_import_remote';
    const d = dialogs.generateDialog('Select File', 'Upload');
    d.body.innerHTML = `<input type="file" placeholder="Select File to Upoad">`;
    d3.select(d.body).select('input').on('change', function() {
      var file = (<any>d3.event).target.files[0];
      var reader = new FileReader();
      reader.onload = function (e: any) {
        var data_s = e.target.result;
        var dump = JSON.parse(data_s);
        (remote ? manager.importRemote(dump) : manager.importLocal(dump)).then((graph) => {
          loadGraph(graph.desc);
        });
      };
      // Read in the image file as a data URL.
      reader.readAsText(file);
    });
    d.show();
  });

  return manager.list().then((list) => {
    const $list = $ul.select('#provenancegraph_list').selectAll('li.graph').data(list);
    $list.enter().insert('li', ':first-child').classed('graph',true).html((d) => `<a href="#clue_graph=${d.id}"><span class="glyphicon glyphicon-file"></span> ${d.name} </a>`).select('a').on('click', (d) => {
      d3.event.preventDefault();
      loadGraph(d);
    });
    const format = d3.time.format.utc('%Y-%m-%dT%H:%M');
    (<any>$('#provenancegraph_list li.graph a')).popover({
      html: true,
      placement: 'left',
      trigger: 'manual',
      title: function() {
        const graph = d3.select(this).datum();
        return `${graph.name}`;
      },
      content: function() {
        const graph = d3.select(this).datum();
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
                    <button class="btn btn-primary" ${session.retrieve('logged_in',false)!==true && !graph.local ? 'disabled="disabled"' : ''} data-action="select" data-toggle="modal" ><span class="fa fa-open"></span> Select</button>
                    <button class="btn btn-primary" data-action="clone" data-toggle="modal"><span class="fa fa-clone"></span> Clone</button>
                    <button class="btn btn-danger" ${session.retrieve('logged_in',false)!==true && !graph.local ? 'disabled="disabled"' : ''} data-toggle="modal"><span class="glyphicon glyphicon-remove"></span> Delete</button>
                </div>
            </div>
        </div>`);
        $elem.find('button.btn-danger').on('click', () => {
          dialogs.areyousure('Are you sure to delete: "'+graph.name+'"').then((deleteIt) => {
            if (deleteIt) {
              manager.delete(graph);
            }
          });
        });
        $elem.find('button.btn-primary').on('click', function() {
          const isSelect = this.dataset.action === 'select';
          if (isSelect) {
            loadGraph(graph);
          } else {
            manager.cloneLocal(graph).then((graph) => loadGraph(graph.desc));
          }
          return false;
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

    const loggedIn = session.retrieve('logged_in',false) === true;
    if (graph === 'new_remote' && loggedIn) {
      return manager.createRemote();
    }
    if (graph === null || graph === 'new') {
      return manager.createLocal();
    }
    const desc = list.filter((d) => d.id === graph)[0];
    if (desc) {
      if ((<any>desc).local || loggedIn) {
        return manager.get(desc);
      }
      return manager.cloneLocal(desc);
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
    application: '/clue',
    id: 'clue',
    recordSelectionTypes: 'selected',
    animatedSelections: false,
    thumbnails: true
  };

  private manager : prov.MixedStorageProvenanceGraphManager;

  graph: Promise<prov.ProvenanceGraph>;
  header: header.AppHeader;
  $main: d3.Selection<any>;
  $main_ref: prov.IObjectRef<d3.Selection<any>>;

  private storyvis: storyvis.VerticalStoryVis;

  constructor(body:HTMLElement, options: any = {}) {
    super();
    const that = this;
    C.mixin(this.options, options);
    body.innerHTML = template;

    if (C.hash.is('clue_headless')) {
      console.log('init headless mode');
      injectHeadlessSupport(this);
      d3.select('body').classed('headless', true);
    }
    this.manager = new prov.MixedStorageProvenanceGraphManager({
        prefix: this.options.id,
        storage: sessionStorage,
        application: this.options.application
      });

    this.header = header.create(<HTMLElement>body.querySelector('div.box'), {
      app: this.options.app,
      inverse: false
    });

    this.header.wait();

    this.createLogin();

    {
      let ul = document.createElement('ul');
      let $ul = d3.select(ul).attr('class','nav navbar-nav navbar-right').html(`
      <li class="dropdown">
            <a class="active" href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true"
               aria-expanded="false"><i class="fa fa-code-fork fa-lg fa-rotate-180"></i></a>
            <ul class="dropdown-menu" id="provenancegraph_list">
                <li role="separator" class="divider"></li>
                <li><a href="#" id="provenancegraph_import"><span class="glyphicon glyphicon-import"></span> Import ...</a></li>
                <li><a href="#" class="login_required disabled" disabled="disabled" id="provenancegraph_import_remote"><span class="glyphicon glyphicon-import"></span> Import Remote ...</a></li>
                <li><a href="#" id="provenancegraph_export"><span class="glyphicon glyphicon-export"></span> Export ...</a></li>
                <li role="separator" class="divider"></li>
                <li><a href="#" id="provenancegraph_new"><span class="glyphicon glyphicon-upload"></span> New ...</a></li>
                <li><a href="#" class="login_required disabled" disabled="disabled" id="provenancegraph_new_remote"><span class="glyphicon glyphicon-upload"></span> New Remote...</a></li>
            </ul>
        </li>`);

      this.header.insertCustomRightMenu(ul);

      d3.select('#provenancegraph_export').on('click', () => {
        d3.event.preventDefault();
        d3.event.stopPropagation();
        this.graph.then((g) => {
          console.log(g);
          const r = g.persist();
          console.log(r);

          var str = JSON.stringify(r, null, '\t');
          //create blob and save it
          var blob = new Blob([str], {type: 'application/json;charset=utf-8'});
          var a = new FileReader();
          a.onload = (e)  => window.open((<any>e.target).result, '_blank');
          a.readAsDataURL(blob);
        });
        return false;
      });

      d3.select(this.header.options).append('button').text('Show').attr('class', 'btn btn-default').on('click', () => {
        this.graph.then((g: prov.ProvenanceGraph) => {
            return datas.create({
              id : g.desc.id,
              name: g.desc.name,
              fqname: g.desc.fqname,
              type : 'graph',
              storage: 'given',
              graph: g.backend
            });
          })
          .then((proxy) => {
            const l = vis.list(proxy);
            if (l.length <= 0) {
              return;
            }
            l[0].load().then((force) => {
              let p = dialogs.generateDialog('Provenance Graph');
              force.factory(proxy,p.body);
              p.show();
            });
          });
        return false;
      });

      this.graph = chooseProvenanceGraph(this.manager, $ul);
    }



    //cmode.create(body.querySelector('#modeselector'));
    cmode.createButton(body.querySelector('header'), {
      size: 'sm'
    });
    //cmode.createSlider(body.querySelector('#modeselector'));

    this.$main = d3.select(body).select('main');

    this.graph.then((graph) => {
      graph.on('sync_start,sync', (event: events.IEvent) => {
        d3.select('nav span.glyphicon-cog').classed('fa-spin', event.type !== 'sync');
      });

      prov_sel.create(graph, this.options.recordSelectionTypes, {
        filter: function (idtype) {
          return idtype && idtype.name[0] !== '_';
        },
        animated: this.options.animatedSelections
      });

      this.$main_ref = graph.findOrAddObject(this.$main, 'Application', 'visual');

      const r = renderer.create(<HTMLElement>this.$main.node(), graph);


      /*const seditor = storyeditor.create(graph, body.querySelector('#storyeditor'), {
        editor: r.edit
      });
      */


      provvis2.create(graph, body.querySelector('div.content'), {
        thumbnails: this.options.thumbnails
      });

      this.storyvis = storyvis.create(graph, body.querySelector('div.content'), {
        render: r.render,
        thumbnails: this.options.thumbnails
      });
      graph.on('select_slide_selected', (event, state) => {
        d3.select('aside.annotations').style('display', state ? null : 'none');
      });
      d3.select('aside.annotations > div:first-of-type').call(d3.behavior.drag().on('drag', function() {
        var mouse = d3.mouse(this.parentElement.parentElement);
        d3.select(this.parentElement).style({
          left: mouse[0] +'px',
          top: mouse[1] +'px'
        });
      }));

      d3.selectAll('aside.annotations button[data-ann]').on('click', function () {
        var create = this.dataset.ann;
        var ann;
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

     graph.on('switch_state', (event:any, state:prov.StateNode) => {
       if (state) {
        C.hash.setInt('clue_state', state.id);
       } else {
         C.hash.removeProp('clue_state');
       }
      });
     graph.on('select_slide_selected', (event:any, state:prov.SlideNode) => {
        if (state) {
        C.hash.setInt('clue_slide', state.id);
       } else {
         C.hash.removeProp('clue_slide');
       }
      });

      {
        const $right = $('aside.provenance-layout-vis');
        const $right_story = $(this.storyvis.node);
        this.propagate(cmode, 'modeChanged');
        let update = (new_: cmode.CLUEMode) => {
          $('body').attr('data-clue', new_.toString());
          //$('nav').css('background-color', d3.rgb(255 * new_.exploration, 255 * new_.authoring, 255 * new_.presentation).darker().darker().toString());
          if (new_.presentation > 0.8) {
            $right.animate({width: 'hide'},'fast');
          } else {
            $right.animate({width: 'show'},'fast');
          }
          if (new_.exploration > 0.8) {
            $right_story.animate({width: 'hide'},'fast');
          } else {
            $right_story.animate({width: 'show'},'fast');
          }
        };
        cmode.on('modeChanged', (event, new_) => update(new_));
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
      d3.select('#bookmarkState').on('click', () => {
        graph.act.setAttr('starred', true);
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
      let ul = document.createElement('ul');
      ul.classList.add('nav','navbar-nav','navbar-right');
      ul.innerHTML = `
      <li id="login_menu"><a data-toggle="modal" data-target="#loginDialog" href="#"><span class="glyphicon glyphicon-user"></span></a></li>
        <li style="display: none" class="dropdown" id="user_menu">
            <a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true"
               aria-expanded="false"><span class="glyphicon glyphicon-user"></span> Unknown</a>
            <ul class="dropdown-menu">
                <li role="separator" class="divider"></li>
                <li><a href="#" id="logout_link">Logout</a></li>
            </ul>
        </li>`;

      this.header.insertCustomRightMenu(ul);
    }
    const that = this;
    {
      let $form = $('#loginDialog div.modal-body').html(login.form).find('form');
      let $alert = $form.parent().find('div.alert');

      $alert.hide();
      login.bindLoginForm(<HTMLFormElement>$form[0], (error, user) => {
        $('#login_menu').hide();
        var $base = $('#user_menu').show();

        session.store('logged_in', !error);
        if (!error) {
          session.store('username', user.name);
          session.store('user', user);
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


    $('#logout_link').on('click', function () {
      this.header.wait();
      login.logout().then(function() {
        session.store('logged_in', false);
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
      const s = graph.getSlideById(story);
      if (s) {
        console.log('jump to stored story', s.id);
        this.storyvis.switchTo(s);
        var next;
        if (C.hash.is('clue_autoplay')) {
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
