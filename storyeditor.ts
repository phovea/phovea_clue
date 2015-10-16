/**
 * Created by sam on 15.10.2015.
 */
/// <reference path="../../tsd.d.ts" />

/// <amd-dependency path="text!./storyeditor.html" name="template"/>
declare var template:string;

import C = require('../caleydo_core/main');
import ranges = require('../caleydo_core/range');
import provenance = require('../caleydo_provenance/main');
import d3 = require('d3');

export class StoryNodeEditor {
  private options = {

  };

  private $node : d3.Selection<StoryNodeEditor>;

  private act: provenance.AStoryNode = null;

  private onSelectionChanged = (event: any, act: ranges.Range) => {
    const d = act.dim(provenance.ProvenanceGraphDim.Story);
    if (!d.isNone) {
      const new_ = this.data.selectedStories()[0] || null;

      if (this.act === new_) {
        return;
      }
      this.switchTo(new_);
    }
  };

  constructor(private data:provenance.ProvenanceGraph, parent:Element, options = {}) {
    C.mixin(this.options, options);
    this.$node = d3.select(parent).append('div').classed('storynodeeditor',true).datum(this);
    this.build(this.$node);
    data.on('select-selected', this.onSelectionChanged);
  }

  private build($node : d3.Selection<StoryNodeEditor>) {
    $node.html(template);
    const $form = $node.select('form');
    $form.on('submit', () => {
      const node = this.act;
      d3.event.preventDefault();
      if (!node) {
        return;
      }
      if (node instanceof provenance.TextStoryNode) {
        node.title = $form.select('#storyeditor_title').property('value');
        node.text = $form.select('#storyeditor_text').property('value');
      }
      node.duration = parseInt($form.select('#storyeditor_duration').property('value'), 10);
    });
  }

  private switchTo(node: provenance.AStoryNode) {
    this.act = node;
    var $form = this.$node.select('form');
    (<HTMLFormElement>$form.node()).reset();
    $form.select('fieldset').attr('disabled',node == null ? 'disabled' : null);
    if (node) {
      //insert the text
      $form.selectAll('.storyeditor_text_fields').style('display', (node instanceof provenance.TextStoryNode ? null: 'none'));
      if (node instanceof provenance.TextStoryNode) {
        $form.select('#storyeditor_title').property('value', node.title);
        $form.select('#storyeditor_text').property('value', node.text);
      }
      $form.select('#storyeditor_duration').property('value', node.duration);
    }
  }
}

export function create(data:provenance.ProvenanceGraph, parent:Element, options = {}) {
  return new StoryNodeEditor(data, parent, options);
}
