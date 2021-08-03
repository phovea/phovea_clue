/**
 * Created by Samuel Gratzl on 28.02.2017.
 */

import {IProvenanceGraphDataDescription, ProvenanceGraph, UserSession, I18nextManager} from 'phovea_core';
import {event as d3event, select, time} from 'd3';
import * as $ from 'jquery';
import {Dialog, FormDialog} from 'phovea_ui';
import {CLUEGraphManager} from '../base/CLUEGraphManager';

export class ProvenanceGraphMenu {
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
      .attr('class', 'navbar-nav')
      .attr('data-clue', 'provenanceGraphList')
      .html(`<li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle" href="#" id="provenanceGraphDropdown" data-bs-toggle="dropdown" role="button" aria-haspopup="true" aria-expanded="false">
          <i class="fas fa-code-branch fa-lg fa-rotate-180 fa-fw"></i>
        </a>
        <div class="dropdown-menu" data-bs-popper="none" id="provenancegraph_list" aria-labelledby="provenanceGraphDropdown">
          <div class="dropdown-divider"></div>
          <a class="dropdown-item" href="#" id="provenancegraph_import">
            <i class="fas fa-upload" aria-hidden="true"></i> ${I18nextManager.getInstance().i18n.t('phovea:clue.provenanceMenu.import')}
          </a>
          <a class="dropdown-item login_required disabled" href="#" disabled="disabled" id="provenancegraph_import_remote">
            <i class="fas fa-cloud-upload-alt" aria-hidden="true"></i> ${I18nextManager.getInstance().i18n.t('phovea:clue.provenanceMenu.importRemote')}
          </a>
          <a class="dropdown-item" href="#" id="provenancegraph_export">
            <i class="fas fa-download" aria-hidden="true"></i> ${I18nextManager.getInstance().i18n.t('phovea:clue.provenanceMenu.export')}
          </a>
          <div class="dropdown-divider"></div>
          <a class="dropdown-item" href="#" id="provenancegraph_new">
            <i class="fas fa-plus-circle" aria-hidden="true"></i> ${I18nextManager.getInstance().i18n.t('phovea:clue.provenanceMenu.new')}
          </a>
          <a class="dropdown-item login_required disabled" href="#" disabled="disabled" id="provenancegraph_new_remote">
            <i class="fas fa-cloud" aria-hidden="true"></i> ${I18nextManager.getInstance().i18n.t('phovea:clue.provenanceMenu.newRemote')}
          </a>
        </div>
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
      a.onload = (e) => {
        const url = (<any>e.target).result;
        const helper = parent.ownerDocument.createElement('a');
        helper.setAttribute('href', url);
        helper.setAttribute('target', '_blank');
        helper.setAttribute('download', `${this.graph.desc.name}.json`);
        helper.click();
        helper.remove();
      };
      a.readAsDataURL(blob);
      return false;
    });

    $ul.selectAll('#provenancegraph_import, #provenancegraph_import_remote').on('click', function () {
      const e = (<Event>d3event);
      e.preventDefault();
      e.stopPropagation();
      const remote = this.id === 'provenancegraph_import_remote';
      //import dialog
      const d = Dialog.generateDialog(I18nextManager.getInstance().i18n.t('phovea:clue.provenanceMenu.selectFile'), I18nextManager.getInstance().i18n.t('phovea:clue.provenanceMenu.upload'));
      d.body.innerHTML = `<input type="file" placeholder=${I18nextManager.getInstance().i18n.t('phovea:clue.provenanceMenu.selectFileToUpload')}>`;
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
      .html((d) => `<a href="#clue_graph=${d.id}"><i class="fas fa-code-branch fa-rotate-180" aria-hidden="true"></i> ${d.name} </a>`)
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
                <div class="col-sm-3">${I18nextManager.getInstance().i18n.t('phovea:clue.provenanceMenu.creator')}:</div>
                <div class="col-sm-9">${creator}</div>
            </div>
            <div class="row">
                <div class="col-sm-3">${I18nextManager.getInstance().i18n.t('phovea:clue.provenanceMenu.created')}</div>
                <div class="col-sm-9">${ts}</div>
            </div>
            <div class="row">
                <div class="col-sm-3">${I18nextManager.getInstance().i18n.t('phovea:clue.provenanceMenu.description')}</div>
                <div class="col-sm-9">${description}</div>
            </div>
            <div class="row">
                <div class="col-sm-3">${I18nextManager.getInstance().i18n.t('phovea:clue.provenanceMenu.nodes')}</div>
                <div class="col-sm-9">${nnodes}/${nedges}</div>
            </div>
            <div class="row">
                <div class="col-sm-12 text-end">
                    <button class="btn btn-primary" ${!UserSession.getInstance().isLoggedIn() && !graph.local ? 'disabled="disabled"' : ''} data-action="select" data-bs-toggle="modal"><span class="fas fa-folder-open" aria-hidden="true"></span> ${I18nextManager.getInstance().i18n.t('phovea:clue.provenanceMenu.select')}</button>
                    <button class="btn btn-primary" data-action="clone" data-bs-toggle="modal"><span class="fas fa-clone" aria-hidden="true"></span> ${I18nextManager.getInstance().i18n.t('phovea:clue.provenanceMenu.clone')}</button>
                    <button class="btn btn-danger" ${!UserSession.getInstance().isLoggedIn() && !graph.local ? 'disabled="disabled"' : ''} data-bs-toggle="modal"><i class="fas fa-trash" aria-hidden="true"></i> ${I18nextManager.getInstance().i18n.t('phovea:clue.provenanceMenu.delete')}</button>
                </div>
            </div>
        </div>`);
        $elem.find<HTMLElement>('button.btn-danger').on('click', () => {
          FormDialog.areyousure(I18nextManager.getInstance().i18n.t('phovea:clue.provenanceMenu.areYouSureToDelete', {name: graph.name})).then((deleteIt) => {
            if (deleteIt) {
              manager.delete(graph);
            }
          });
        });
        $elem.find<HTMLElement>('button.btn-primary').on('click', function () {
          const isSelect = this.dataset.action === 'select';
          manager.loadOrClone(graph, isSelect);
          return false;
        });
        return $elem;
      }
    }).parent().on({
      mouseenter() {
        (<any>$(this).find<HTMLElement>('a')).popover('show');
      },
      mouseleave() {
        (<any>$(this).find<HTMLElement>('a')).popover('hide');
      }
    });
  }
}
