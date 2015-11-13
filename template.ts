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

export class CLUEWrapper extends events.EventHandler {
  private options = {
    app: 'CLUE',
    id: 'clue_demo'
  };

  private manager : prov.IProvenanceGraphManager;

  graph: Promise<prov.ProvenanceGraph>;
  header: header.AppHeader;
  $main: d3.Selection<any>;
  $main_ref: prov.IObjectRef<d3.Selection<any>>;

  constructor(body:HTMLElement, options: any = {}) {
    super();
    C.mixin(this.options, options);
    body.innerHTML = template;

    this.manager = new prov.LocalStorageProvenanceGraphManager(sessionStorage, this.options.id);

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

    this.graph.then((graph) => {
      graph.on('sync_start,sync', (event: events.IEvent) => {
        d3.select('*[data-header="options"] span.glyphicon').classed('fa-spin', event.type !== 'sync');
      });

      prov_sel.create(graph, 'selected', {
        filter: function (idtype) {
          return idtype && idtype.name[0] !== '_';
        }
      });

      this.$main_ref = graph.findOrAddObject(this.$main, 'Application', 'visual');

      const r = renderer.create(<HTMLElement>this.$main.node(), graph);

      new player.Player(graph, body.querySelector('#player_controls'), {
        render: r.render
      });
      /*const seditor = storyeditor.create(graph, body.querySelector('#storyeditor'), {
        editor: r.edit
      });
      */


      //const pvis = provvis.create(graph, body.querySelector('#clue'), {});
      const pvis = provvis2.create(graph, body.querySelector('#clue'), {});

      storyvis.create(graph, body.querySelector('#clue'), {
        render: r.render
        /*extract: () => {
          //const selected = pvis.getAnClearStorySelection();
          //return graph.extractStory(selected, false);
        }*/
      });

     graph.on('switch_state', (event:any, state:prov.StateNode) => {
        C.hash.setInt('clue_state', state.id);
      });

      {
        const $right = $('aside.right');
        const $left = $('aside.left');
        const $footer = $('footer');
        this.propagate(cmode, 'modeChanged');
        let update = (new_: cmode.CLUEMode) => {
          $('main').attr('data-clue', new_.toString());
          $('nav').css('background-color', d3.rgb(255 * new_.exploration, 255 * new_.authoring, 255 * new_.presentation).darker().darker().toString());
          if (new_.presentation > 0.8) {
            $right.hide(); //({width: 'hide'});
          } else {
            $right.show().css({width: pvis.width + 'px'});
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
            $('#story_toolbar, #story_vis, #storyeditor').hide();
          } else {
            $('#story_toolbar, #story_vis, #storyeditor').show();
          }
        };
        cmode.on('modeChanged', (event, new_) => update(new_));
        this.fire('modeChanged', cmode.getMode());
        update(cmode.getMode());
      }

      d3.select('#story_toolbar button.fa-magic').on('click', () => {
        graph.startNewStory('Welcome');
        //const selected = pvis.getAnClearStorySelection();
        //graph.extractStory(selected);
      });

      d3.select('#attachScreenshot').on('click', () => {
        const main = <HTMLElement>(document.querySelector('main *[data-main]') || document.querySelector('main'));
        const bounds = C.bounds(main);
        this.header.wait();
        screenshot.takeCanvas(main, [bounds.w/2, bounds.h/2]).then((canvas) => {
          this.header.ready();
          graph.act.setAttr('screenshot', screenshot.toString(canvas));
          graph.act.setAttr('thumbnail', screenshot.toString(screenshot.createThumbnailCanvas(canvas, [128,128])));
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
    });
  }

  jumpToStored() {
    //jump to stored state
    let target_state = C.hash.getInt('clue_state', null);
    if (target_state !== null) {
      this.graph.then((graph) => {
        let s = graph.getStateById(target_state);
        if (s) {
          graph.jumpTo(s);
        }
      });
    }
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
