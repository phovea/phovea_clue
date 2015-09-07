/**
 * Created by Samuel Gratzl on 27.08.2015.
 */
/// <amd-dependency path='font-awesome' />
/// <amd-dependency path='bootstrap' />

/// <amd-dependency path="text!./_template.html" />
declare var require:(moduleId:string) => any;
const template:string = require("text!./_template.html");

import C = require('../caleydo_core/main');
import header = require('../wrapper_bootstrap_fontawesome/header');
import prov = require('../caleydo_provenance/main');
import d3 = require('d3');
import $ = require('jquery');
import cmds = require('./cmds');
import prov_sel = require('../caleydo_provenance/selection');
import databrowser = require('../caleydo_window/databrowser');
import selection = require('../caleydo_core/selectioninfo');
import cmode = require('../caleydo_provenance/mode');
import provvis = require('./provvis');
import player = require('../caleydo_provenance/player');


export function create(body:HTMLElement) {
  body.innerHTML = template;

  var graph = prov.create({
    type: 'provenance_graph',
    name: 'CLUE',
    fqname: 'c.CLUE',
    id: 'clue_demo',
    startFromScratch: C.hash.is('clue_clear')
  });


  const appheader = header.create(body, {
    app: 'CLUE',
    mainMenu: [
      {
        name: 'Home'
      }
    ]
  });
  {
    let ul = <HTMLElement>document.createElement('ul');
    appheader.insertCustomRightMenu(ul);
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
    appheader.insertCustomRightMenu(div);
    div.classList.add('nav');
    div.classList.add('navbar-nav');
    div.classList.add('navbar-right');
    div.id = 'modeselector';
  }

  prov_sel.create(graph, 'selected', {
    filter: function (idtype) {
      return idtype && idtype.name[0] !== '_';
    }
  });

  databrowser.create(body.querySelector('#databrowser'));
  selection.create(body.querySelector('#selectioninfo'));
  cmode.create(body.querySelector('#modeselector'));

  const story = provvis.create(graph, body.querySelector('#clue'), {});
  (function () {
    const $right = $('aside.right');
    $right.css('width', story.width + 'px');
    const $left = $('aside.left');
    const $left_data = $('#databrowser');
    if (cmode.getMode() > cmode.ECLUEMode.Exploration) {
      $left_data.hide();
    } else {
      $left_data.show();
    }
    if (cmode.getMode() >= cmode.ECLUEMode.Interactive_Story) {
      $left.hide();
    } else {
      $left.show();
    }
    cmode.on('modeChanged', (event, new_) => {
      $right.animate({width: story.width + 'px'});
      if (new_ >= cmode.ECLUEMode.Interactive_Story) {
        $left.animate({width: 'hide'});
      } else {
        $left.animate({width: 'show'});
      }
      if (new_ > cmode.ECLUEMode.Exploration) {
        $left_data.animate({height: 'hide'});
      } else {
        $left_data.animate({height: 'show'});
      }
    });
  })();

  new player.Player(graph, body.querySelector('#player_controls'));

  let $main = d3.select(body).select('main');
  let $main_ref = graph.findOrAddObject($main, 'Application', 'visual');
  {

    databrowser.makeDropable(<Element>$main.node(), (data, op, pos) => {
      var data_ref = graph.findOrAddObject(data, data.desc.id, 'data');
      graph.push(cmds.createAddCmd($main_ref, data_ref, pos));
    });
  }

  {
    graph.on('switch_state', (event:any, state:prov.StateNode) => {
      C.hash.setInt('clue_state', state.id);
    });
    //jump to stored state
    let target_state = C.hash.getInt('clue_state', null);
    if (target_state !== null) {
      let s = graph.states.filter((s) => s.id === target_state)[0];
      if (s) {
        graph.jumpTo(s);
      }
    }
  }

  appheader.addMainMenu('New Workspace', () => {
    graph.jumpTo(graph.states[0]).then(() => {
      graph.clear();
      $main_ref = graph.findOrAddObject($main, 'Board', 'visual');
      cmode.setMode(cmode.ECLUEMode.Exploration);
    });
  });

  return graph;
}
