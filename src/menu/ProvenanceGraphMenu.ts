/**
 * Created by Samuel Gratzl on 28.02.2017.
 */

import {IProvenanceGraphDataDescription} from 'phovea_core/src/provenance';
import ProvenanceGraph from 'phovea_core/src/provenance/ProvenanceGraph';
import {event as d3event, select, time} from 'd3';
import * as $ from 'jquery';
import {retrieve} from 'phovea_core/src/session';
import {generateDialog, areyousure} from 'phovea_ui/src/dialogs';
import CLUEGraphManager from '../CLUEGraphManager';

export default class ProvenanceGraphMenu {
  private readonly $node: d3.Selection<any>;
  private graph: ProvenanceGraph;

  constructor(private readonly manager: CLUEGraphManager, parent: HTMLElement, appendChild = true) {
    this.$node = this.init(parent);
    if (appendChild) {
      parent.appendChild(this.node);
    }
  }

  get node() {
    return <HTMLElement>this.$node.node();
  }

  setGraph(graph: ProvenanceGraph) {
    this.$node.select('#provenancegraph_name').text(graph.desc.name);
    this.graph = graph;
  }

  private init(parent: HTMLElement) {
    const manager = this.manager;
    //add provenance graph management menu entry
    const ul = parent.ownerDocument.createElement('ul');
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
    $ul.select('#provenancegraph_export').on('click', () => {
      const e = (<Event>d3event);
      e.preventDefault();
      e.stopPropagation();

      console.log(this.graph);
      const r = this.graph.persist();
      console.log(r);

      const str = JSON.stringify(r, null, '\t');
      //create blob and save it
      const blob = new Blob([str], {type: 'application/json;charset=utf-8'});
      const a = new FileReader();
      a.onload = (e) => window.open((<any>e.target).result, '_blank');
      a.readAsDataURL(blob);
      return false;
    });

    $ul.selectAll('#provenancegraph_import, #provenancegraph_import_remote').on('click', function () {
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

    return $ul;
  }

  build(graphs: IProvenanceGraphDataDescription[]) {
    const manager = this.manager;
    const $list = this.$node.select('#provenancegraph_list').selectAll('li.graph').data(graphs);
    $list.enter().insert('li', ':first-child')
      .classed('graph', true)
      .html((d) => `<a href="#clue_graph=${d.id}"><i class="fa fa-code-fork fa-rotate-180" aria-hidden="true"></i> ${d.name} </a>`)
      .select('a').on('click', (d) => {
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
  }
}
