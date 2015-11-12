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
import provvis = require('./provvis');
import provvis2 = require('./provvis2');
import storyvis = require('./storyvis');
import player = require('../caleydo_provenance/player');
import events = require('../caleydo_core/event');
import screenshot = require('../caleydo_screenshot/main');
import renderer = require('./annotation');


export class CLUEWrapper extends events.EventHandler {
  private options = {
    app: 'CLUE',
    id: 'clue_demo'
  };

  graph: prov.ProvenanceGraph;
  header: header.AppHeader;
  $main: d3.Selection<any>;
  $main_ref: prov.IObjectRef<d3.Selection<any>>;

  constructor(body:HTMLElement, options: any = {}) {
    super();
    C.mixin(this.options, options);
    body.innerHTML = template;

    this.graph = prov.create({
      type: 'provenance_graph',
      name: this.options.app,
      fqname: 'c.'+this.options.app,
      id: this.options.id,
      startFromScratch: C.hash.is('clue_clear')
    });


    this.header = header.create(<HTMLElement>body.querySelector('div.box'), {
      app: this.options.app,
      mainMenu: [
        {
          name: 'Home'
        }
      ]
    });

    {
      let div = <HTMLElement>document.createElement('div');
       this.header.insertCustomRightMenu(div);
      div.classList.add('nav');
      div.classList.add('navbar-nav');
      div.classList.add('navbar-right');
      div.id = 'modeselector';
    }

    this.graph.on('sync_start,sync', (event: events.IEvent) => {
      d3.select('*[data-header="options"] span.glyphicon').classed('fa-spin', event.type !== 'sync');
    });

    prov_sel.create(this.graph, 'selected', {
      filter: function (idtype) {
        return idtype && idtype.name[0] !== '_';
      }
    });

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
    this.$main_ref = this.graph.findOrAddObject(this.$main, 'Application', 'visual');

    const r = renderer.create(<HTMLElement>this.$main.node(), this.graph);

    new player.Player(this.graph, body.querySelector('#player_controls'), {
      render: r.render
    });
    /*const seditor = storyeditor.create(this.graph, body.querySelector('#storyeditor'), {
      editor: r.edit
    });
    */


    //const pvis = provvis.create(this.graph, body.querySelector('#clue'), {});
    const pvis = provvis2.create(this.graph, body.querySelector('#clue'), {});

    storyvis.create(this.graph, body.querySelector('#story_vis'), {
      render: r.render,
      /*extract: () => {
        //const selected = pvis.getAnClearStorySelection();
        //return this.graph.extractStory(selected, false);
      }*/
    });

   this.graph.on('switch_state', (event:any, state:prov.StateNode) => {
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
      //const selected = pvis.getAnClearStorySelection();
      //this.graph.extractStory(selected);
    });

    d3.select('#attachScreenshot').on('click', () => {
      const main = <HTMLElement>(document.querySelector('main *[data-main]') || document.querySelector('main'));
      const bounds = C.bounds(main);
      this.header.wait();
      screenshot.take(main, [bounds.w/2, bounds.h/2]).then((image) => {
        this.header.ready();
        this.graph.act.setAttr('screenshot', image);
      }).catch((error) => {
        console.log(error);
      });
    });
    d3.select('#attachNote form').on('submit', () => {
      const note = d3.select('#attachNote_note').property('value');
      this.graph.act.setAttr('note', note);
      (<any>$('#attachNote')).modal('hide');
      (<HTMLFormElement>document.querySelector('#attachNote form')).reset();
      d3.event.preventDefault();
      d3.event.stopPropagation();
    });

    //undo the step
    d3.select('#undoStep').on('click', () => {
      this.graph.undo();
    });
    //undo using ctrl-z
    d3.select(document).on('keydown.player', () => {
      let k = <KeyboardEvent>d3.event;
      if (k.keyCode === 90 && k.ctrlKey) {
        //ctrl-z
        k.preventDefault();
        this.graph.undo();
      }
    });
  }

  jumpToStored() {
    //jump to stored state
    let target_state = C.hash.getInt('clue_state', null);
    if (target_state !== null) {
      let s = this.graph.states.filter((s) => s.id === target_state)[0];
      if (s) {
        this.graph.jumpTo(s);
      }
    }
  }

  reset() {
    this.graph.jumpTo(this.graph.states[0]).then(() => {
      this.graph.clear();
      this.$main_ref = this.graph.findOrAddObject(this.$main, 'Application', 'visual');
      cmode.setMode(cmode.modes.Exploration);
    });
  }
}
export function create(body:HTMLElement, options: any = {}) {
  return new CLUEWrapper(body, options);
}
