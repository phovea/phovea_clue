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
import player = require('../caleydo_provenance/player');
import events = require('../caleydo_core/event');
import screenshot = require('../caleydo_screenshot/main');


export class CLUEWrapper extends events.EventHandler {
  private options = {
    app: 'CLUE'
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
      id: 'clue_demo',
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

    selection.create(body.querySelector('#selectioninfo'));
    cmode.create(body.querySelector('#modeselector'));

    const story = provvis.create(this.graph, body.querySelector('#clue'), {});

    new player.Player(this.graph, body.querySelector('#player_controls'));

    this.$main = d3.select(body).select('main');
    this.$main_ref = this.graph.findOrAddObject(this.$main, 'Application', 'visual');

   this.graph.on('switch_state', (event:any, state:prov.StateNode) => {
      C.hash.setInt('clue_state', state.id);
    });

    {
      let new_ = cmode.getMode();
      $('main').attr('data-clue', cmode.getMode().toString());
      $('nav').css('background-color', d3.rgb(255*new_.exploration, 255*new_.authoring, 255*new_.presentation));
      const $right = $('aside.right');
      if (new_.presentation > 0.8) {
          $right.hide(); //({width: 'hide'});
        } else {
          $right.show().css({width: story.width + 'px'});
        }
      const $left = $('aside.left');
      if (new_.exploration < 0.8) {
        $left.hide();
      } else {
        $left.show();
      }
      const $footer = $('footer');
      if (new_.presentation < 0.3) {
        $footer.hide();
      } else {
        $footer.show();
      }
      this.propagate(cmode, 'modeChanged');
      this.fire('modeChanged', new_);
      cmode.on('modeChanged', (event, new_) => {
        $('main').attr('data-clue', new_.toString());
        $('nav').css('background-color', d3.rgb(255*new_.exploration, 255*new_.authoring, 255*new_.presentation));
        if (new_.presentation > 0.8) {
          $right.hide(); //({width: 'hide'});
        } else {
          $right.show().css({width: story.width + 'px'});
        }
        if (new_.exploration < 0.8) {
          $left.hide(); //({width: 'hide'});
        } else {
          $left.show(); //({width: 'show'});
        }
        if (new_.presentation < 0.3) {
          $footer.hide();
        } else {
          $footer.show();
        }
      });
    }

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
    d3.select('#undoStep').on('click', () => {
      this.graph.undo();
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
