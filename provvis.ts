/**
 * Created by sam on 09.02.2015.
 */

import C = require('../caleydo_core/main');
import ranges = require('../caleydo_core/range');
import provenance = require('../caleydo_provenance/main');
import d3 = require('d3');
import vis = require('../caleydo_core/vis');

function translate(x = 0, y = 0) {
  return 'translate('+(x || 0)+','+(y || 0)+')';
}

export class SubwayVis extends vis.AVisInstance implements vis.IVisInstance {
  private $node:d3.Selection<any>;
  private trigger = C.bind(this.update, this);
  private layouts : any = {};
  private add = (event, node) => {
    this.layouts[node.id] = {
      _ : node
    };
  };

  constructor(public data:provenance.ProvenanceGraph, public parent:Element, private options:any) {
    super();
    this.options = C.mixin({}, options);
    this.options.scale = [1, 1];
    this.options.rotate = 0;
    this.$node = this.build(d3.select(parent));
    C.onDOMNodeRemoved(this.node, this.destroy, this);

    this.data.states.forEach((s) => this.add(null, s));
    this.data.objects.forEach((s) => this.add(null, s));
    this.data.actions.forEach((s) => this.add(null, s));

    this.bind();
    this.update();
  }

  private bind() {
    this.data.on('add_node', this.add);
    this.data.on('switch_action', this.trigger);
  }

  destroy() {
    super.destroy();
    this.data.off('add_node', this.add);
    this.data.off('switch_action', this.trigger);
  }

  get rawSize() : [number, number] {
    return [130, 800];
  }

  get node() {
    return <Element>this.$node.node();
  }

  option(name:string, val?:any) {
    if (arguments.length === 1) {
      return this.options[name];
    } else {
      this.fire('option.' + name, val, this.options[name]);
      this.options[name] = val;

    }
  }

  locateImpl(range:ranges.Range) {
    return Promise.resolve(null);
  }

  transform(scale?:number[], rotate:number = 0) {
    var bak = {
      scale: this.options.scale || [1, 1],
      rotate: this.options.rotate || 0
    };
    if (arguments.length === 0) {
      return bak;
    }
    var dims = this.data.dim;
    var width = 20, height = dims[0];
    this.$node.attr({
      width: width * scale[0],
      height: height * scale[1]
    }).style('transform', 'rotate(' + rotate + 'deg)');
    //this.$node.select('g').attr('transform', 'scale(' + scale[0] + ',' + scale[1] + ')');
    var new_ = {
      scale: scale,
      rotate: rotate
    };
    this.fire('transform', new_, bak);
    this.options.scale = scale;
    this.options.rotate = rotate;
    return new_;
  }


  private build($parent:d3.Selection<any>) {
    var size = this.size;
    //  scale = this.options.scale;
    var $svg = $parent.append('svg').attr({
      width: size[0],
      height: size[1],
      'class' : 'provenance-subway-vis'
    }).style('transform', 'rotate(' + this.options.rotate + 'deg)');

    //var $defs = $svg.append('defs');
    var $g = $svg.append('g').attr('transform', 'translate(20,20)scale(1.2,1.2)');

    $g.append('g').attr('class', 'objects');
    $g.append('g').attr('class', 'actions');
    $g.append('g').attr('class', 'states');

    return $svg;
  }

  private update() {
    var graph = this.data,
      act = graph.act,
      states = act.path, //just the active path to the root
      objects_m = {},
      objects = [],
      actions = [],
      l = this.layouts;

    //collect all contained objects and actions
    var t = act;
    while ((t = t.nextState) != null && states.indexOf(t) < 0) {
      states.push(t);
    }
    states.forEach((s) => {
      var li = l[s.id];
      var a= s.resultsFrom[0];
      if (a) {
        actions.push(a);
      }
      var cc = s.consistsOf;
      li.elems = cc.length + 1;
      cc.forEach((c) => objects_m[c.id] = c);
    });
    objects = d3.values(objects_m);
    objects.forEach((obj) => {
      var li = l[obj.id],
        i;
      i = actions.indexOf(obj.createdBy);
      li.from = i < 0 ? -1 : i;
      i = actions.indexOf(obj.removedBy);
      li.to = i < 0 ? Number.POSITIVE_INFINITY : i;

    });
    objects = objects.sort((a,b) => {
      var r = l[a.id].from - l[b.id].from;
      return r !== 0 ? r : l[b.id].to - l[a.id].to;
    });
    objects.forEach((obj,i) => {
      var li = l[obj.id];
      li.track = objects.slice(0,i).filter((o) => l[o.id].to >= li.from).length;
    });
    actions.forEach((a) => {
      var creates = a.creates, removes = a.removes, requires = a.requires.filter((r) => removes.indexOf(r) < 0);
      var li = l[a.id], toTrack = (obj) => l[obj.id].track;
      li.tracks = d3.merge([
        creates.map(obj => { return { m : 'create', track : toTrack(obj)}; }),
        requires.map(obj => { return { m : 'require', track : toTrack(obj)}; }),
        removes.map(obj => { return { m : 'remove', track : toTrack(obj)}; }),
      ]);
      li.tracks.sort((a,b) => { return a.track - b.track; });
      if (creates.length === 0 && removes.length === 0 && requires.length > 0) {
        li.tracks[0].m = 'update';
      }
    });


    var yscale = d3.scale.linear().domain([0,20]).range([0,150]);
    var xscale = d3.scale.linear().domain([0,10]).range([0,60]);

    var $objects = this.$node.select('g.objects').selectAll('.object').data(objects, (d) => d.id);
    $objects.enter().append('g').classed('object',true).attr('transform',translate(0))
      .append('path')
      .attr('class', (d) => d.category)
      .append('title').text(String);
    $objects.select('path').attr('d', (d,i) => {
      var li = l[d.id], track = xscale(li.track);
      var r :any[] = ['M',track,','];
      r.push(li.from >= 0 ? yscale(li.from * 2 + 1)+2 : 0);
      r.push(' L',track,',');
      r.push(li.to !== Number.POSITIVE_INFINITY ? yscale(li.to * 2 + 1)-2 : yscale(states.length * 2 - 2));
      return r.join('');
    });

    $objects.exit().remove();
    var $states = this.$node.select('g.states').selectAll<provenance.StateNode>('.state').data(states, (d,_) => String(d.id));
    $states.enter().append('g').classed('state',true).on('click', (d) => {
      this.data.jumpTo(d);
    }).attr('transform',translate(0,this.size[1])).append('rect').attr({
      x : (d) => -4,
      y : -2.5,
      height: 5,
      width: 8,
      rx : 3,
      ry : 3
    }).append('title').text(String);
    $states.classed('act', (d) => d === act);
    $states.transition()
      .attr('transform',(d,i) => translate(0,yscale(i*2)))
      .select('rect').attr('width',(d) => 8 + xscale(l[d.id].elems));

    $states.exit().remove();

    var glyphs = {
      create : ' m-4,0 a 4,4 0 1,0 8,0 a 4,4 0 1,0 -8,0',
      require: ' m-2,0 a 2,2 0 1,0 4,0 a 2,2 0 1,0 -4,0',
      update: 'm-4,0 l4,4 l4,-4 l-4,-4 l-4,4',
      remove: 'm-5,-2 l10,0'
    };
    var $actions = this.$node.select('g.actions').selectAll('.action').data(actions, (d) => d.id);
    $actions.enter().append('g').classed('action',true).attr('transform',translate(0,this.size[1]))
      .append('path').attr('class', (d) => d.meta.operation+' '+d.meta.category + ' fill').append('title').text(String);

    $actions.transition().attr('transform',(d,i) => translate(0,yscale(i*2+1)))
      .select('path').attr('d', (d) => {
        var li = l[d.id];
        var r = li.tracks.map((t) => 'M'+xscale(t.track)+',0'+glyphs[t.m]);
        if (li.tracks.length > 0) {
          r.push('M'+xscale(li.tracks[0].track)+',0 L'+xscale(li.tracks[li.tracks.length-1].track)+',0');
        }
        return r.join(' ');
      });

    $actions.exit().remove();

  }
}

export function create(data:provenance.ProvenanceGraph, parent:Element, options = {}) {
  return new SubwayVis(data, parent, options);
}
