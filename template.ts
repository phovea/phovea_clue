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
import selection = require('../caleydo_core/selectioninfo');
import cmode = require('../caleydo_provenance/mode');
import provvis = require('./provvis');
import player = require('../caleydo_provenance/player');
import events = require('../caleydo_core/event');

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
      name: options.app,
      fqname: 'c.'+options.app,
      id: 'clue_demo',
      startFromScratch: C.hash.is('clue_clear')
    });


    this.header = header.create(<HTMLElement>body.querySelector('div.box'), {
      app: options.app,
      mainMenu: [
        {
          name: 'Home'
        }
      ]
    });
    {
      let ul = <HTMLElement>document.createElement('ul');
       this.header.insertCustomRightMenu(ul);
      d3.select(ul).attr({
        'class' : 'nav navbar-nav navbar-right',
        id: 'player_controls'
      }).html('<li><a data-player="play" href="#"><i class="fa fa-play" title="Play"></i></a></li>\n'+
          '<li><a data-player="backward" href="#" class="disabled"><i class="fa fa-step-backward" title="Step Backward"></i></a></li>\n'+
          '<li><a data-player="stop" href="#" class="disabled"><i class="fa fa-stop" title="Stop"></i></a></li>\n'+
          '<li><a data-player="forward" href="#" class="disabled"><i class="fa fa-step-forward" title="Step Forward"></i></a></li>\n');
    }
    {
      let div = <HTMLElement>document.createElement('div');
       this.header.insertCustomRightMenu(div);
      div.classList.add('nav');
      div.classList.add('navbar-nav');
      div.classList.add('navbar-right');
      div.id = 'modeselector';
    }

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
      $('main').attr('data-clue', cmode.ECLUEMode[cmode.getMode()]);
      const $right = $('aside.right');
      $right.css('width', story.width + 'px');
      const $left = $('aside.left');
      if (cmode.getMode() >= cmode.ECLUEMode.Interactive_Story) {
        $left.hide();
      } else {
        $left.show();
      }
      this.propagate(cmode, 'modeChanged');
      this.fire('modeChanged', cmode.getMode());
      cmode.on('modeChanged', (event, new_) => {
        $('main').attr('data-clue', cmode.ECLUEMode[new_]);
        $right.animate({width: story.width + 'px'});
        if (new_ >= cmode.ECLUEMode.Interactive_Story) {
          $left.animate({width: 'hide'});
        } else {
          $left.animate({width: 'show'});
        }
      });
    }
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
      cmode.setMode(cmode.ECLUEMode.Exploration);
    });
  }
}
export function create(body:HTMLElement, options: any = {}) {
  return new CLUEWrapper(body, options);
}
