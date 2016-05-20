/**
 * Created by sam on 12.02.2015.
 */
import C = require('../caleydo_core/main');
import plugins = require('../caleydo_core/plugin');
import datas = require('../caleydo_core/data');
import graph = require('../caleydo_core/graph');
import idtypes = require('../caleydo_core/idtype');
import ranges = require('../caleydo_core/range');
import datatypes = require('../caleydo_core/datatype');
import session = require('../caleydo_core/session');

import {SimHash, MatchedTokenTree} from "./simhash";
import {IStateToken, StateTokenNode} from "./statetoken";

/**
 * reexport the edge type
 */
export type GraphEdge = graph.GraphEdge;
export const graphModule = graph;

/**
 * list of categories for actions and objects
 */
export const cat = {
  data: 'data',
  selection: 'selection',
  visual: 'visual',
  layout: 'layout',
  logic: 'logic',
  custom: 'custom',
  annotation: 'annotation'
};

/**
 * list of operations
 */
export const op = {
  create: 'create',
  update: 'update',
  remove: 'remove'
};


/**
 * an object reference is a common description of an object node in the provenance graph
 */
export interface IObjectRef<T> {
  /**
   * name of the object
   */
  name: string;
  /**
   * category one of categories
   */
  category : string;
  /**
   * the value
   */
  v : Promise<T>;

  /**
   * maybe null if not defined
   */
  value: T;

  /**
   * a hash for avoiding false duplicate detection
   */
  hash: string;
}

/**
 * creates an object reference to the given object
 * @param v
 * @param name
 * @param category
 * @param hash
 * @returns {{v: T, name: string, category: string}}
 */
export function ref<T>(v:T, name:string, category = cat.data, hash = name + '_' + category):IObjectRef<T> {
  return {
    v: Promise.resolve(v),
    value: v,
    name: name,
    category: category,
    hash: hash
  };
}

export interface IInverseActionCreator {
  (inputs:IObjectRef<any>[], creates:IObjectRef<any>[], removes:IObjectRef<any>[]) : IAction;
}

export interface ICmdResult {
  /**
   * the command to revert this command
   */
  inverse : IAction | IInverseActionCreator;
  /**
   * the created references
   */
  created? : IObjectRef<any>[];
  /**
   * the removed references
   */
  removed? : IObjectRef<any>[];

  /**
   * then number of actual milliseconds consumed
   */
  consumed?: number;
}

/**
 * abstract definition of a command
 */
export interface ICmdFunction {
  (inputs:IObjectRef<any>[], parameters:any, graph:ProvenanceGraph, within:number) : Promise<ICmdResult> | ICmdResult;
}
/**
 * a factory to create from an id the corresponding command
 */
export interface ICmdFunctionFactory {
  (id:string): ICmdFunction;
}

/**
 * tries to persist an object value supporting datatypes and DOM elements having an id
 * @param v
 * @returns {any}
 */
function persistData(v:any):any {
  if (v instanceof Element) {
    let e = <Element>v,
      id = e.getAttribute('id');
    return {type: 'element', id: id};
  }
  if (datatypes.isDataType(v)) {
    let e = <datatypes.IDataType>v;
    return {type: 'dataset', id: e.desc.id, persist: e.persist()};
  }
  if (typeof v === 'string' || typeof v === 'number') {
    return {type: 'primitive', v: v};
  }
  return null;
}

function restoreData(v:any):any {
  if (!v) {
    return null;
  }
  switch (v.type) {
    case 'element':
      if (v.id) {
        return Promise.resolve(document.getElementById(v.id));
      }
      return null;
    case 'dataset':
      return datas.get(v.persist);
    case 'primitive':
      return Promise.resolve(v.v);
  }
  return null;
}

/**
 * a graph node of type object
 */
export class ObjectNode<T> extends graph.GraphNode implements IObjectRef<T> {
  /**
   * a promise of the value accessible via .v
   */
  private _promise:Promise<T>;
  private _persisted:any = null;

  constructor(private _v:T, name:string, category = cat.data, hash = name + '_' + category, description = '') {
    super('object');
    if (_v != null) { //if the value is given, auto generate a promise for it
      this._promise = Promise.resolve(_v);
    }
    super.setAttr('name', name);
    super.setAttr('category', category);
    super.setAttr('hash', hash);
    super.setAttr('description', description);
  }


  get stateTokenPropertyExists() {
     let value = <any>this.value
     if (value ===null || value == "") return false
     if(!("stateTokens" in value)) return false
     return true
  }

  get stateTokens() {
     if (!this.stateTokenPropertyExists) return "undefined"
     return (<any>this.value).stateTokens;
  }

  get value() {
    this.checkPersisted();
    return this._v;
  }

  set value(v:T) {
    this._v = v;
    if (this._promise == null) {
      this._promise = Promise.resolve(v);
    }
    this._persisted = null;
  }

  /**
   * checks whether the persisted value was already restored
   */
  private checkPersisted() {
    if (this._persisted != null) {
      this._promise = restoreData(this._persisted);
      if (this._promise) {
        this._promise.then((v) => {
          this._v = v;
        });
      }
      this._persisted = null;
    }
  }

  get v() {
    this.checkPersisted();
    return this._promise;
  }

  get name():string {
    return super.getAttr('name', '');
  }

  get category():string {
    return super.getAttr('category', '');
  }

  get hash():string {
    return super.getAttr('hash', '');
  }

  get description():string {
    return super.getAttr('description', '');
  }


  persist() {
    var r = super.persist();
    if (!r.attrs) {
      r.attrs = {};
    }
    r.attrs.v = this._persisted ? this._persisted : persistData(this.value);
    return r;
  }

  restore(p:any) {
    this._persisted = p.attrs.v;
    delete p.attrs.v;
    super.restore(p);
    return this;
  }

  static restore(p) {
    var r = new ObjectNode<any>(null, p.attrs.name, p.attrs.category, p.attrs.hash || p.attrs.name + '_' + p.attrs.category);
    return r.restore(p);
  }

  get createdBy() {
    var r = this.incoming.filter(graph.isType('creates'))[0];
    return r ? <ActionNode>r.source : null;
  }

  get removedBy() {
    var r = this.incoming.filter(graph.isType('removes'))[0];
    return r ? <ActionNode>r.source : null;
  }

  get requiredBy() {
    return this.incoming.filter(graph.isType('requires')).map((e) => <ActionNode>e.source);
  }

  get partOf() {
    return this.incoming.filter(graph.isType('consistsOf')).map((e) => <StateNode>e.source);
  }

  toString() {
    return this.name;
  }
}

function getCurrentUser() {
  return session.retrieve('username', 'Anonymous');
}

/**
 * additional data about a performed action
 */
export class ActionMetaData {
  constructor(public category:string, public operation:string, public name:string, public timestamp:number = Date.now(), public user:string = getCurrentUser()) {

  }

  static restore(p) {
    return new ActionMetaData(p.category, p.operation, p.name, p.timestamp, p.user);
  }

  eq(that:ActionMetaData) {
    return this.category === that.category && this.operation === that.operation && this.name === that.name;
  }

  /**
   * checks whether this metadata are the inverse of the given one in terms of category and operation
   * @param that
   * @returns {boolean}
   */
  inv(that:ActionMetaData) {
    if (this.category !== that.category) {
      return false;
    }
    if (this.operation === op.update) {
      return that.operation === op.update;
    }
    return this.operation === op.create ? that.operation === op.remove : that.operation === op.create;
  }

  toString() {
    return `${this.category}:${this.operation} ${this.name}`;
  }
}

export function meta(name:string, category:string = cat.data, operation:string = op.update, timestamp:number = Date.now(), user:string = getCurrentUser()) {
  return new ActionMetaData(category, operation, name, timestamp, user);
}

export interface IAction {
  meta: ActionMetaData;
  id : string;
  f : ICmdFunction;
  inputs?: IObjectRef<any>[];
  parameter?: any;
}

/**
 * creates an action given the data
 * @param meta
 * @param id
 * @param f
 * @param inputs
 * @param parameter
 * @returns {{meta: ActionMetaData, id: string, f: (function(IObjectRef<any>[], any, ProvenanceGraph): ICmdResult), inputs: IObjectRef<any>[], parameter: any}}
 */
export function action(meta:ActionMetaData, id:string, f:ICmdFunction, inputs:IObjectRef<any>[] = [], parameter:any = {}):IAction {
  return {
    meta: meta,
    id: id,
    f: f,
    inputs: inputs,
    parameter: parameter
  };
}

/**
 * comparator by index
 * @param a
 * @param b
 * @returns {number}
 */
function byIndex(a:graph.AttributeContainer, b:graph.AttributeContainer) {
  const ai = +a.getAttr('index', 0);
  const bi = +b.getAttr('index', 0);
  return ai - bi;
}


export class ActionNode extends graph.GraphNode {
  private inverter:IInverseActionCreator;

  constructor(meta:ActionMetaData, f_id:string, private f:ICmdFunction, parameter:any = {}) {
    super('action');
    super.setAttr('meta', meta);
    super.setAttr('f_id', f_id);
    super.setAttr('parameter', parameter);
  }

  clone() {
    return new ActionNode(this.meta, this.f_id, this.f, this.parameter);
  }

  get name() {
    return this.meta.name;
  }

  get meta():ActionMetaData {
    return super.getAttr('meta');
  }

  get f_id():string {
    return super.getAttr('f_id');
  }

  get parameter():any {
    return super.getAttr('parameter');
  }

  set parameter(value:any) {
    super.setAttr('parameter', value);
  }

  get onceExecuted():boolean {
    return super.getAttr('onceExecuted', false);
  }

  set onceExecuted(value:boolean) {
    if (this.onceExecuted !== value) {
      super.setAttr('onceExecuted', value);
    }
  }

  static restore(r, factory:ICmdFunctionFactory) {
    var a = new ActionNode(ActionMetaData.restore(r.attrs.meta), r.attrs.f_id, factory(r.attrs.f_id), r.attrs.parameter);
    return a.restore(r);
  }

  toString() {
    return this.meta.name;
  }

  get inversedBy() {
    var r = this.incoming.filter(graph.isType('inverses'))[0];
    return r ? <ActionNode>r.source : null;
  }

  /**
   * inverses another action
   * @returns {ActionNode}
   */
  get inverses() {
    var r = this.outgoing.filter(graph.isType('inverses'))[0];
    return r ? <ActionNode>r.target : null;
  }

  get isInverse() {
    return this.outgoing.filter(graph.isType('inverses'))[0] != null;
  }

  getOrCreateInverse(graph:ProvenanceGraph) {
    var i = this.inversedBy;
    if (i) {
      return i;
    }
    if (this.inverter) {
      return graph.createInverse(this, this.inverter);
    }
    this.inverter = null; //not needed anymore
    return null;
  }

  updateInverse(graph:ProvenanceGraph, inverter:IInverseActionCreator) {
    var i = this.inversedBy;
    if (i) { //update with the actual values / parameter only
      var c = inverter.call(this, this.requires, this.creates, this.removes);
      i.parameter = c.parameter;
      this.inverter = null;
    } else if (!this.isInverse) {
      //create inverse action immediatelly
      graph.createInverse(this, inverter);
      this.inverter = null;
    } else {
      this.inverter = inverter;
    }
  }

  execute(graph:ProvenanceGraph, withinMilliseconds:number):Promise<ICmdResult> {
    var r = this.f.call(this, this.requires, this.parameter, graph, <number>withinMilliseconds);
    return Promise.resolve(r);
  }

  equals(that:ActionNode):boolean {
    if (!(this.meta.category === that.meta.category && that.meta.operation === that.meta.operation)) {
      return false;
    }
    if (this.f_id !== that.f_id) {
      return false;
    }
    //TODO check parameters if they are the same
    return true;
  }

  get uses():ObjectNode<any>[] {
    return this.outgoing.filter(graph.isType(/(creates|removes|requires)/)).map((e) => <ObjectNode<any>>e.target);
  }

  get creates():ObjectNode<any>[] {
    return this.outgoing.filter(graph.isType('creates')).map((e) => <ObjectNode<any>>e.target);
  }

  get removes():ObjectNode<any>[] {
    return this.outgoing.filter(graph.isType('removes')).sort(byIndex).map((e) => <ObjectNode<any>>e.target);
  }

  get requires():ObjectNode<any>[] {
    return this.outgoing.filter(graph.isType('requires')).sort(byIndex).map((e) => <ObjectNode<any>>e.target);
  }

  get resultsIn():StateNode {
    var r = this.outgoing.filter(graph.isType('resultsIn'))[0];
    return r ? <StateNode>r.target : null;
  }

  get previous():StateNode {
    var r = this.incoming.filter(graph.isType('next'))[0];
    return r ? <StateNode>r.source : null;
  }
}

/**
 * a state node is one state in the visual exploration consisting of an action creating it and one or more following ones.
 * In addition, a state is characterized by the set of active object nodes
 */
export class StateNode extends graph.GraphNode {

  constructor(name:string, description = '') {
    super('state');
    super.setAttr('name', name);
    super.setAttr('description', description);
  }

  //<author>: Michael Gillhofer

 calcSimHash():string[] {
    //console.log("Recalc Hash of " + this.id)
    var allTokens: IStateToken[] = [];
    for (var oN of this.consistsOf) {
      if (oN.stateTokenPropertyExists) {
        if (oN.category == "data") continue
        allTokens = allTokens.concat(oN.stateTokens);
      }
    }
    let hash:string[] = SimHash.hasher.calcHash(allTokens)
    this.setAttr('simHash', hash);
    this.setAttr('stateTokens', allTokens)
    //console.log(hash)
    return hash
  }

  get stateTokens():IStateToken[] {
    let tokens = this.getAttr('stateTokens')
    return tokens === null ? null : SimHash.normalizeTokenPriority(tokens)
  }

  get simHash(): string[]{
    var simHash:string[] = this.getAttr('simHash');
    if (simHash === null) {
      console.log("Sim Hash Was null")
      simHash = this.calcSimHash()
    }
    return simHash;
  }

  /*
  getSimilarityTo(otherState:StateNode): number{
    return 1-this.numberOfSetBits(this.simHash ^ otherState.simHash)/32
  }
  */

  getSimilarityTo(otherState:StateNode, exact:boolean = false): number{
    //exact = true
    //if (exact) return this.getExactSimilarityTo(otherState)
    let thisH:string[] = this.simHash
    let otherH:string[] = otherState.simHash
    if (thisH[0] == "invalid" || otherH[0] == "invalid") return -1
    let weighting = SimHash.hasher.categoryWeighting
    let similarity:number = 0 ;
    for (let j = 0; j < 5; j++) {
      let len = Math.min(thisH[j].length, otherH[j].length);
      let nrEqu = 0;
      for(let i=0; i<len; i++) {
        if( thisH[j].charAt(i) == otherH[j].charAt(i)) nrEqu++;
      }
      similarity += (nrEqu/len - 0.5)*2*weighting[j]/100
    }
    return similarity >=0 ? similarity : 0;
  }

  getExactSimilarityTo(otherState:StateNode):number {
    if (this.id === otherState.id) return 1;
    let thisTokens:IStateToken[] = this.stateTokens
    let otherTokens:IStateToken[] = otherState.stateTokens
    if (thisTokens === null || otherTokens===null) return -1
    let tree = new MatchedTokenTree(thisTokens, otherTokens)
    let s = tree.similarityForLineup;
    return tree.similarity
  }



  numberOfSetBits(i:number):number{
    i = i - ((i >> 1) & 0x55555555);
    i = (i & 0x33333333) + ((i >> 2) & 0x33333333);
    return (((i + (i >> 4)) & 0x0F0F0F0F) * 0x01010101) >> 24;
  }

  public duplicates:StateNode[] = [];

  //checkduplicate() {

    //if (this.simHash == ){
     // this.duplicates[this.duplicates.length] = state;
   // }
 // }

  //</author>


  get name():string {
    return super.getAttr('name');
  }

  set name(value:string) {
    super.setAttr('name', value);
  }

  get description():string {
    return super.getAttr('description', '');
  }

  set description(value:string) {
    super.setAttr('description', value);
  }

  static restore(p) {
    var r = new StateNode(p.attrs.name);
    return r.restore(p);
  }

  /**
   * this state consists of the following objects
   * @returns {ObjectNode<any>[]}
   */
  get consistsOf():ObjectNode<any>[] {
    return this.outgoing.filter(graph.isType('consistsOf')).map((e) => <ObjectNode<any>>e.target);
  }

  /**
   * returns the actions leading to this state
   * @returns {ActionNode[]}
   */
  get resultsFrom():ActionNode[] {
    return this.incoming.filter(graph.isType('resultsIn')).map((e) => <ActionNode>e.source);
  }

  /**
   *
   * @returns {any}
   */
  get creator() {
    //results and not a inversed actions
    const from = this.incoming.filter(graph.isType('resultsIn')).map((e) => <ActionNode>e.source).filter((s) => !s.isInverse);
    if (from.length === 0) {
      return null;
    }
    return from[0];
  }

  get next():ActionNode[] {
    return this.outgoing.filter(graph.isType('next')).map((e) => <ActionNode>e.target).filter((s) => !s.isInverse);
  }

  get previousState():StateNode {
    const a = this.creator;
    if (a) {
      return a.previous;
    }
    return null;
  }

  get previousStates():StateNode[] {
    return this.resultsFrom.map((n) => n.previous);
  }

  get nextStates():StateNode[] {
    return this.next.map((n) => n.resultsIn);
  }

  get nextState():StateNode {
    var r = this.next[0];
    return r ? r.resultsIn : null;
  }

  get path():StateNode[] {
    var p = this.previousState,
      r:StateNode[] = [];
    r.unshift(this);
    if (p) {
      p.pathImpl(r);
    }
    return r;
  }

  private pathImpl(r:StateNode[]) {
    var p = this.previousState;
    r.unshift(this);
    if (p && r.indexOf(p) < 0) { //no loop
      //console.log(p.toString() + ' path '+ r.join(','));
      p.pathImpl(r);
    }
  }

  toString() {
    return this.name;
  }
}

export const DEFAULT_DURATION = 1500; //ms
export const DEFAULT_TRANSITION = 0; //ms


export interface IStateAnnotation {
  type: string;
  pos: [number, number] | { anchor: string, offset: [number, number] } ;
  styles?: { [key: string]: string; };

  [key: string] : any;
}

export interface ITextStateAnnotation extends IStateAnnotation {
  text: string;
  size?: [number, number];
  rotation?: number;
}

export interface IArrowStateAnnotation extends IStateAnnotation {
  at: [number, number];
}

export interface IFrameStateAnnotation extends IStateAnnotation {
  size?: [number, number];
  pos2?: [number, number];
  rotation?: number;
}


export class SlideNode extends graph.GraphNode {
  constructor() {
    super('story');
  }

  get name():string {
    return super.getAttr('name', '');
  }

  set name(value:string) {
    super.setAttr('name', value);
  }

  get description():string {
    return super.getAttr('description', '');
  }

  set description(value:string) {
    super.setAttr('description', value);
  }

  get isTextOnly() {
    return !this.outgoing.some(graph.isType('jumpTo'));
  }

  get state() {
    const edge = this.outgoing.filter(graph.isType('jumpTo'))[0];
    return edge ? <StateNode>edge.target : null;
  }

  static restore(dump:any) {
    return new SlideNode().restore(dump);
  }

  get next() {
    const n = this.outgoing.filter(graph.isType('next'))[0];
    return n ? <SlideNode>n.target : null;
  }

  get nexts() {
    return this.outgoing.filter(graph.isType('next')).map((n) => <SlideNode>n.target);
  }

  get previous() {
    const n = this.incoming.filter(graph.isType('next'))[0];
    return n ? <SlideNode>n.source : null;
  }

  get slideIndex() {
    const p = this.previous;
    return 1 + (p ? p.slideIndex : 0);
  }

  get duration() {
    return <number>this.getAttr('duration', DEFAULT_DURATION);
  }

  set duration(value:number) {
    this.setAttr('duration', value);
  }

  /**
   * the number of milliseconds for the transitions
   * @returns {number}
   */
  get transition() {
    return <number>this.getAttr('transition', DEFAULT_TRANSITION);
  }

  set transition(value:number) {
    this.setAttr('transition', value);
  }

  get annotations() {
    return <IStateAnnotation[]>this.getAttr('annotations', []);
  }

  setAnnotation(index:number, ann:IStateAnnotation) {
    var old = this.annotations;
    old[index] = ann;
    this.setAttr('annotations', old);
  }

  updateAnnotation(ann:IStateAnnotation) {
    //since it is a reference just updated
    this.setAttr('annotations', this.annotations);
  }

  removeAnnotation(index:number) {
    var old = this.annotations;
    old.splice(index, 1);
    this.setAttr('annotations', old);
  }

  removeAnnotationElem(elem:IStateAnnotation) {
    var old = this.annotations;
    old.splice(old.indexOf(elem), 1);
    this.setAttr('annotations', old);
  }

  pushAnnotation(ann:IStateAnnotation) {
    var old = this.annotations;
    old.push(ann);
    this.setAttr('annotations', old);
    this.fire('push-annotations', ann, old);
  }

  get isStart() {
    return this.previous == null;
  }

  static makeText(title?:string) {
    const s = new SlideNode();
    if (title) {
      s.pushAnnotation({
        type: 'text',
        pos: [25, 25],
        text: '# ${name}'
      });
      s.name = title;
    }
    return s;
  }
}

/**
 * an action compressor is used to compress a series of action to fewer one, e.g. create and remove can be annihilated
 */
export interface IActionCompressor {
  (path:ActionNode[]) : ActionNode[];
}


function removeNoops(path:ActionNode[]) {
  return path.filter((a) => a.f_id !== 'noop');
}

function compositeCompressor(cs:IActionCompressor[]) {
  return (path:ActionNode[]) => {
    path = removeNoops(path);
    let before:number;
    do {
      before = path.length;
      cs.forEach((c) => path = c(path));
    } while (before > path.length);
    return path;
  };
}
function createCompressor(path:ActionNode[]) {
  var toload = plugins.list('actionCompressor').filter((plugin:any) => {
    return path.some((action) => action.f_id.match(plugin.matches) != null);
  });
  return plugins.load(toload).then((loaded) => {
    return compositeCompressor(loaded.map((l) => <IActionCompressor>l.factory));
  });
}
/**
 * returns a compressed version of the paths where just the last selection operation remains
 * @param path
 */
export function compress(path:ActionNode[]) {
  //return Promise.resolve(path);
  //TODO find a strategy how to compress but also invert skipped actions
  return createCompressor(path).then((compressor) => {
    //return path;
    let before:number;
    do {
      before = path.length;
      path = compressor(path);
    } while (before > path.length);
    return path;
  });

}

/**
 * find common element in the list of two elements returning the indices of the first same item
 * @param a
 * @param b
 * @returns {any}
 */
function findCommon<T>(a:T[], b:T[]) {
  var c = 0;
  while (c < a.length && c < b.length && a[c] === b[c]) { //go to next till a difference
    c++;
  }
  if (c === 0) { //not even the root common
    return null;
  }
  return {
    i: c - 1,
    j: c - 1
  };
}

function asFunction(i) {
  if (!C.isFunction(i)) { //make a function
    return C.constant(i);
  }
  return i;
}

function noop(inputs:IObjectRef<any>[], parameter:any):ICmdResult {
  return {
    inverse: createNoop()
  };
}

function createNoop() {
  return {
    meta: meta('noop', cat.custom),
    id: 'noop',
    f: noop,
    inputs: [],
    parameter: {}
  };
}

function createLazyCmdFunctionFactory():ICmdFunctionFactory {
  const facts = plugins.list('actionFactory');

  function resolveFun(id) {
    if (id === 'noop') {
      return Promise.resolve(noop);
    }
    const factory = facts.filter((f:any) => id.match(f.creates) != null)[0];
    if (factory == null) {
      return Promise.reject('no factory found for ' + id);
    }
    return factory.load().then((f) => f.factory(id));
  }

  const lazyFunction = (id) => {
    var _resolved = null;
    return function (inputs:IObjectRef<any>[], parameters:any) {
      var that = this, args = C.argList(arguments);
      if (_resolved == null) {
        _resolved = resolveFun(id);
      }
      return _resolved.then((f) => f.apply(that, args));
    };
  };
  return (id) => lazyFunction(id);
}


function provenanceGraphFactory():graph.IGraphFactory {
  const factory = createLazyCmdFunctionFactory();
  var types = {
    action: ActionNode,
    state: StateNode,
    object: ObjectNode,
    story: SlideNode
  };
  return {
    makeNode: (n) => types[n.type].restore(n, factory),
    makeEdge: (n, lookup) => ((new graph.GraphEdge()).restore(n, lookup))
  };
}

export enum ProvenanceGraphDim {
  Action = 0,
  Object = 1,
  State = 2,
  Slide = 3
}

export interface IProvenanceGraphManager {
  list(): Promise<datatypes.IDataDescription[]>;
  get(desc:datatypes.IDataDescription): Promise<ProvenanceGraph>;
  create(): Promise<ProvenanceGraph>;

  delete(desc:datatypes.IDataDescription): Promise<boolean>;

  import(json:any): Promise<ProvenanceGraph>;
}

export class LocalStorageProvenanceGraphManager implements IProvenanceGraphManager {
  private options = {
    storage: localStorage,
    prefix: 'clue',
    application: 'unknown'
  };

  constructor(options = {}) {
    C.mixin(this.options, options);
  }

  list() {
    const lists = JSON.parse(this.options.storage.getItem(this.options.prefix + '_provenance_graphs') || '[]');
    var l = lists.map((id) => JSON.parse(this.options.storage.getItem(this.options.prefix + '_provenance_graph.' + id)));
    return Promise.resolve(l);
  }


  getGraph(desc:datatypes.IDataDescription):Promise<graph.LocalStorageGraph> {
    return Promise.resolve(graph.LocalStorageGraph.load(desc, provenanceGraphFactory(), this.options.storage));
  }

  get(desc:datatypes.IDataDescription):Promise<ProvenanceGraph> {
    return this.getGraph(desc).then((impl) => new ProvenanceGraph(desc, impl));
  }

  clone(graph:graph.GraphBase) {
    const desc = this.createDesc();
    return this.getGraph(desc).then((new_) => {
      new_.restoreDump(graph.persist(), provenanceGraphFactory());
      return new ProvenanceGraph(desc, new_);
    });
  }

  import(json:any):Promise<ProvenanceGraph> {
    const desc = this.createDesc();
    return this.getGraph(desc).then((new_) => {
      new_.restoreDump(json, provenanceGraphFactory());
      return new ProvenanceGraph(desc, new_);
    });
  }

  delete(desc:datatypes.IDataDescription) {
    var lists = JSON.parse(this.options.storage.getItem(this.options.prefix + '_provenance_graphs') || '[]');
    lists.splice(lists.indexOf(desc.id), 1);
    graph.LocalStorageGraph.delete(desc);
    //just remove from the list
    this.options.storage.setItem(this.options.prefix + '_provenance_graphs', JSON.stringify(lists));
    return Promise.resolve(true);
  }

  private createDesc() {
    var lists = JSON.parse(this.options.storage.getItem(this.options.prefix + '_provenance_graphs') || '[]');
    const id = this.options.prefix + (lists.length > 0 ? String(1 + d3.max(lists.map((d) => parseInt(d.slice(this.options.prefix.length), 10)))) : '0');
    const desc = {
      type: 'provenance_graph',
      name: 'Local Workspace#' + id,
      fqname: this.options.prefix + '.Provenance Graph #' + id,
      id: id,
      local: true,
      size: [0, 0],
      attrs: {
        graphtype: 'provenance_graph',
        of: this.options.application
      },
      creator: getCurrentUser(),
      ts: Date.now(),
      description: ''
    };
    lists.push(id);
    this.options.storage.setItem(this.options.prefix + '_provenance_graphs', JSON.stringify(lists));
    this.options.storage.setItem(this.options.prefix + '_provenance_graph.' + id, JSON.stringify(desc));
    return desc;
  }

  create() {
    const desc = this.createDesc();
    return this.get(<any>desc);
  }
}

export function toSlidePath(s?:SlideNode) {
  var r = [];
  while (s) {
    if (r.indexOf(s) >= 0) {
      return r;
    }
    r.push(s);
    s = s.next;
  }
  return r;
}

export class RemoteStorageProvenanceGraphManager implements IProvenanceGraphManager {
  private options = {
    application: 'unknown'
  };

  constructor(options = {}) {
    C.mixin(this.options, options);
  }

  list() {
    return datas.list((d) => d.desc.type === 'graph' && (<any>d.desc).attrs.graphtype === 'provenance_graph' && (<any>d.desc).attrs.of === this.options.application).then((d) => d.map((di) => di.desc));
  }

  getGraph(desc:datatypes.IDataDescription):Promise<graph.GraphBase> {
    return datas.get(desc.id)
      .then((graph:graph.GraphProxy) => graph.impl(provenanceGraphFactory()));
  }

  get(desc:datatypes.IDataDescription):Promise<ProvenanceGraph> {
    return this.getGraph(desc).then((impl:graph.GraphBase) => new ProvenanceGraph(desc, impl));
  }

  delete(desc:datatypes.IDataDescription) {
    return datas.remove(desc);
  }

  import(json:any):Promise<ProvenanceGraph> {
    const desc = {
      type: 'graph',
      attrs: {
        graphtype: 'provenance_graph',
        of: this.options.application
      },
      name: 'Workspace for ' + this.options.application,
      creator: getCurrentUser(),
      ts: Date.now(),
      description: '',

      nodes: json.nodes,
      edges: json.edges
    };
    return datas.upload(desc)
      .then((graph:graph.GraphProxy) => graph.impl(provenanceGraphFactory()))
      .then((impl:graph.GraphBase) => new ProvenanceGraph(impl.desc, impl));
  }

  create() {
    const desc = {
      type: 'graph',
      attrs: {
        graphtype: 'provenance_graph',
        of: this.options.application
      },
      name: 'Workspace for ' + this.options.application,
      creator: getCurrentUser(),
      ts: Date.now(),
      description: ''
    };
    return datas.upload(desc)
      .then((graph:graph.GraphProxy) => graph.impl(provenanceGraphFactory()))
      .then((impl:graph.GraphBase) => new ProvenanceGraph(impl.desc, impl));
  }
}


export class MixedStorageProvenanceGraphManager implements IProvenanceGraphManager {
  private remote:RemoteStorageProvenanceGraphManager;
  private local:LocalStorageProvenanceGraphManager;

  constructor(options = {}) {
    this.remote = new RemoteStorageProvenanceGraphManager(options);
    this.local = new LocalStorageProvenanceGraphManager(options);
  }

  listRemote() {
    return this.remote.list();
  }

  listLocal() {
    return this.local.list();
  }

  list():Promise<datatypes.IDataDescription[]> {
    return Promise.all([this.listLocal(), this.listRemote()]).then((arr) => arr[0].concat(arr[1]));
  }

  delete(desc:datatypes.IDataDescription):Promise<boolean> {
    if ((<any>desc).local) {
      return this.local.delete(desc);
    } else {
      return this.remote.delete(desc);
    }
  }

  get(desc:datatypes.IDataDescription):Promise<ProvenanceGraph> {
    if ((<any>desc).local) {
      return this.local.get(desc);
    } else {
      return this.remote.get(desc);
    }
  }

  getGraph(desc:datatypes.IDataDescription):Promise<graph.GraphBase> {
    if ((<any>desc).local) {
      return this.local.getGraph(desc);
    } else {
      return this.remote.getGraph(desc);
    }
  }

  cloneLocal(desc:datatypes.IDataDescription):Promise<ProvenanceGraph> {
    return this.getGraph(desc).then(this.local.clone.bind(this.local));
  }

  importLocal(json:any) {
    return this.local.import(json);
  }

  importRemote(json:any) {
    return this.remote.import(json);
  }

  import(json:any) {
    return this.importLocal(json);
  }

  createLocal() {
    return this.local.create();
  }

  createRemote() {
    return this.remote.create();
  }

  create() {
    return this.createLocal();
  }
}

function findMetaObject<T>(find:IObjectRef<T>) {
  return (obj:ObjectNode<any>) => find === obj || ((obj.value === null || obj.value === find.value) && (find.hash === obj.hash));
}

export class ProvenanceGraph extends datatypes.DataTypeBase {
  private _actions:ActionNode[] = [];
  private _objects:ObjectNode<any>[] = [];
  private _states:StateNode[] = [];
  private _slides:SlideNode[] = [];

  act:StateNode = null;
  private lastAction:ActionNode = null;

  public comparing:boolean = false;

  get compareMode():boolean {
    return this.comparing && this.selectedStates(idtypes.hoverSelectionType).length > 0;
  }


  //currently executing promise
  private currentlyRunning = false;
  executeCurrentActionWithin = -1;
  private nextQueue:(()=>any)[] = [];

  constructor(desc:datatypes.IDataDescription, public backend:graph.GraphBase) {
    super(desc);
    this.propagate(this.backend, 'sync', 'add_edge', 'add_node', 'sync_node', 'sync_edge', 'sync_start');

    if (this.backend.nnodes === 0) {
      this.act = new StateNode('Start');
      this._states.push(this.act);
      this.backend.addNode(this.act);
    } else {
      var act = (<any>desc).act;
      this._actions = <any>this.backend.nodes.filter((n) => (n instanceof ActionNode));
      this._objects = <any>this.backend.nodes.filter((n) => (n instanceof ObjectNode));
      this._states = <any>this.backend.nodes.filter((n) => (n instanceof StateNode));
      this._slides = <any>this.backend.nodes.filter((n) => (n instanceof SlideNode));
      this.act = <StateNode>(act >= 0 ? this.getStateById(act) : this._states[0]);
    }
  }

  get isEmpty() {
    return this._states.length <= 1;
  }

  get dim() {
    return [this._actions.length, this._objects.length, this._states.length, this._slides.length];
  }

  ids(range:ranges.Range = ranges.all()) {
    const to_id = (a:any) => a.id;
    const actions = ranges.Range1D.from(this._actions.map(to_id));
    const objects = ranges.Range1D.from(this._objects.map(to_id));
    const states = ranges.Range1D.from(this._states.map(to_id));
    const stories = ranges.Range1D.from(this._slides.map(to_id));
    return Promise.resolve(range.preMultiply(ranges.list(actions, objects, states, stories)));
  }

  selectState(state:StateNode, op:idtypes.SelectOperation = idtypes.SelectOperation.SET, type = idtypes.defaultSelectionType, extras = {}) {
    this.select(ProvenanceGraphDim.State, type, state ? [this._states.indexOf(state)] : [], op);
    this.fire('select_state,select_state_' + type, state, type, op, extras);
  }

  selectSlide(state:SlideNode, op:idtypes.SelectOperation = idtypes.SelectOperation.SET, type = idtypes.defaultSelectionType, extras = {}) {
    this.fire('select_slide,select_slide_' + type, state, type, op, extras);
    this.select(ProvenanceGraphDim.Slide, type, state ? [this._slides.indexOf(state)] : [], op);
  }

  selectAction(action:ActionNode, op:idtypes.SelectOperation = idtypes.SelectOperation.SET, type = idtypes.defaultSelectionType) {
    this.fire('select_action,select_action_' + type, action, type, op);
    this.select(ProvenanceGraphDim.Action, type, action ? [this._actions.indexOf(action)] : [], op);
  }

  selectedStates(type = idtypes.defaultSelectionType):StateNode[] {
    const sel = this.idtypes[ProvenanceGraphDim.State].selections(type);
    if (sel.isNone) {
      return [];
    }
    var lookup = {};
    this._states.forEach((s) => lookup[s.id] = s);
    var nodes = [];
    sel.dim(0).forEach((id) => {
      const n = lookup[id];
      if (n) {
        nodes.push(n);
      }
    });
    return nodes;
  }


  selectedSlides(type = idtypes.defaultSelectionType):SlideNode[] {
    const sel = this.idtypes[ProvenanceGraphDim.Slide].selections(type);
    if (sel.isNone) {
      return [];
    }
    var lookup = {};
    this._slides.forEach((s) => lookup[s.id] = s);
    var nodes = [];
    sel.dim(0).forEach((id) => {
      const n = lookup[id];
      if (n) {
        nodes.push(n);
      }
    });
    return nodes;
  }

  get idtypes():idtypes.IDType[] {
    return ['_provenance_actions', '_provenance_objects', '_provenance_states', '_provenance_stories'].map(idtypes.resolve);
  }

  clear() {
    this.backend.clear();
    this._states = [];
    this._actions = [];
    this._objects = [];
    this._slides = [];
    this.act = null;
    this.lastAction = null;

    this.act = new StateNode('start');
    this._states.push(this.act);
    this.backend.addNode(this.act);

    this.fire('clear');
  }


  get states() {
    return this._states;
  }

  getStateById(id:number) {
    return C.search(this._states, (s) => s.id === id);
  }

  get actions() {
    return this._actions;
  }

  getActionById(id:number) {
    return C.search(this._actions, (s) => s.id === id);
  }

  get objects() {
    return this._objects;
  }

  getObjectById(id:number) {
    return C.search(this._objects, (s) => s.id === id);
  }

  get stories() {
    return this._slides;
  }

  getSlideById(id:number) {
    return C.search(this._slides, (s) => s.id === id);
  }

  getSlideChains() {
    return this.stories.filter((n) => n.isStart);
  }

  getSlides():SlideNode[][] {
    return this.getSlideChains().map(toSlidePath);
  }

  get edges() {
    return this.backend.edges;
  }

  private addEdge(s:graph.GraphNode, type:string, t:graph.GraphNode, attrs = {}) {
    var l = new graph.GraphEdge(type, s, t);
    Object.keys(attrs).forEach((attr) => l.setAttr(attr, attrs[attr]));
    this.backend.addEdge(l);
    return l;
  }

  private createAction(meta:ActionMetaData, f_id:string, f:ICmdFunction, inputs:IObjectRef<any>[] = [], parameter:any = {}) {
    var r = new ActionNode(meta, f_id, f, parameter);
    return this.initAction(r, inputs);
  }

  private initAction(r:ActionNode, inputs:IObjectRef<any>[] = []) {
    var inobjects = inputs.map((i) => this.findInArray(this._objects, i));
    this._actions.push(r);
    this.backend.addNode(r);
    this.fire('add_action', r);
    inobjects.forEach((obj, i) => {
      this.addEdge(r, 'requires', obj, {index: i});
    });
    return r;
  }

  createInverse(action:ActionNode, inverter:IInverseActionCreator) {
    const creates = action.creates,
      removes = action.removes;
    var i = inverter.call(action, action.requires, creates, removes);
    var inverted = this.createAction(i.meta, i.id, i.f, i.inputs, i.parameter);
    inverted.onceExecuted = true;
    this.addEdge(inverted, 'inverses', action);

    //the inverted action should create the removed ones and removes the crated ones
    removes.forEach((c, i) => {
      this.addEdge(inverted, 'creates', c, {index: i});
    });
    creates.forEach((c) => {
      this.addEdge(inverted, 'removes', c);
    });

    //create the loop in the states
    this.addEdge(action.resultsIn, 'next', inverted);
    this.addEdge(inverted, 'resultsIn', action.previous);

    return inverted;
  }

  push(action:IAction);
  push(meta:ActionMetaData, f_id:string, f:ICmdFunction, inputs:IObjectRef<any>[], parameter:any);
  push(arg:any, f_id:string = '', f:ICmdFunction = null, inputs:IObjectRef<any>[] = [], parameter:any = {}) {
    return this.inOrder(() => {
      if (arg instanceof ActionMetaData) {
        return this.run(this.createAction(<ActionMetaData>arg, f_id, f, inputs, parameter));
      } else {
        var a = <IAction>arg;
        return this.run(this.createAction(a.meta, a.id, a.f, a.inputs || [], a.parameter || {}));
      }
    });
  }

  findObject<T>(value:T) {
    var r = C.search(this._objects, (obj) => obj.value === value);
    if (r) {
      return r;
    }
    return null;
  }


  addObject<T>(value:T, name:string = value ? value.toString() : 'Null', category = cat.data, hash = name + '_' + category) {
    return this.addObjectImpl(value, name, category, hash, true);
  }

  addJustObject<T>(value:T, name:string = value ? value.toString() : 'Null', category = cat.data, hash = name + '_' + category) {
    return this.addObjectImpl(value, name, category, hash, false);
  }

  private addObjectImpl<T>(value:T, name:string = value ? value.toString() : 'Null', category = cat.data, hash = name + '_' + category, createEdge = false) {
    var r = new ObjectNode<T>(value, name, category, hash);
    this._objects.push(r);
    this.backend.addNode(r);
    if (createEdge) {
      this.addEdge(this.act, 'consistsOf', r);
    }
    this.fire('add_object', r);
    return r;
  }

  private resolve(arr:IObjectRef<any>[]) {
    return arr.map((r) => {
      if (r instanceof ObjectNode) {
        return <ObjectNode<any>>r;
      }
      if ((<any>r)._resolvesTo instanceof ObjectNode) {
        return <ObjectNode<any>>(<any>r)._resolvesTo;
      }
      //else create a new instance
      const result = this.addJustObject(r.value, r.name, r.category, r.hash);
      (<any>r)._resolvesTo = result;
      return result;
    });
  }

  private findInArray(arr:ObjectNode<any>[], r:IObjectRef<any>) {
    if (r instanceof ObjectNode) {
      return <ObjectNode<any>>r;
    }
    if ((<any>r)._resolvesTo instanceof ObjectNode) {
      return <ObjectNode<any>>(<any>r)._resolvesTo;
    }
    //else create a new instance
    const result = C.search(arr, findMetaObject(r));
    (<any>r)._resolvesTo = result;
    return result;
  }

  findOrAddObject<T>(i:T|IObjectRef<T>, name?:string, type?:any):ObjectNode<T> {
    return this.findOrAddObjectImpl(i, name, type, true);
  }

  findOrAddJustObject<T>(i:T|IObjectRef<T>, name?:string, type?:any):ObjectNode<T> {
    return this.findOrAddObjectImpl(i, name, type, false);
  }

  private findOrAddObjectImpl<T>(i:T|IObjectRef<T>, name?:string, type?:any, createEdge = false):ObjectNode<T> {
    var r, j = <any>i;
    if (i instanceof ObjectNode) {
      return <ObjectNode<T>>i;
    }
    if (j._resolvesTo instanceof ObjectNode) {
      return <ObjectNode<T>>j._resolvesTo;
    }
    if (j.hasOwnProperty('value') && j.hasOwnProperty('name')) { //sounds like an proxy
      j.category = j.category || cat.data;
      r = C.search(this._objects, findMetaObject(j));
      if (r) {
        if (r.value === null) { //restore instance
          r.value = j.value;
        }
        //cache result
        j._resolvesTo = r;
        return r;
      }
      return this.addObjectImpl(j.value, j.name, j.category, j.hash, createEdge);
    } else { //raw value
      r = C.search(this._objects, (obj) => (obj.value === null || obj.value === i) && (name === null || obj.name === name) && (type === null || type === obj.category));
      if (r) {
        if (r.value === null) { //restore instance
          r.value = i;
        }
        return r;
      }
      return this.addObjectImpl(<any>i, name, type, name + '_' + type, createEdge);
    }
  }

  private inOrder(f:()=>Promise<any>):Promise<any> {
    if (this.currentlyRunning) {
      var helper;
      var r = new Promise((resolve) => {
        helper = resolve.bind(this);
      });
      this.nextQueue.push(helper);
      return r.then(f);
    } else {
      return f();
    }
  }

  private run(action:ActionNode, withinMilliseconds:number | (() => number) = -1) {
    var current = this.act,
      next:StateNode = action.resultsIn,
      newState = false;
    if (!next) { //create a new state
      newState = true;
      this.addEdge(current, 'next', action);
      next = this.makeState(action.meta.name);
      this.addEdge(action, 'resultsIn', next);
    }
    this.fire('execute', action);
    if (C.hash.is('debug')) {
      console.log('execute ' + action.meta + ' ' + action.f_id);
    }
    this.currentlyRunning = true;

    if (C.isFunction(withinMilliseconds)) {
      withinMilliseconds = (<any>withinMilliseconds)();
    }
    this.executeCurrentActionWithin = <number>withinMilliseconds;

    const runningAction = action.execute(this, this.executeCurrentActionWithin).then((result) => {
      result = C.mixin({created: [], removed: [], inverse: null, consumed: 0}, result);
      this.fire('executed', action, result);

      var firstTime = !action.onceExecuted;
      action.onceExecuted = true;

      if (firstTime) {
        //create an link outputs
        //
        var created = this.resolve(result.created);
        created.forEach((c, i) => {
          this.addEdge(action, 'creates', c, {index: i});
        });
        // a removed one should be part of the inputs
        const requires = action.requires;
        var removed = result.removed.map((r) => this.findInArray(requires, r));
        removed.forEach((c) => {
          c.value = null; //free reference
          this.addEdge(action, 'removes', c);
        });

        //update new state
        if (newState) {
          var objs = current.consistsOf;
          objs.push.apply(objs, created);
          removed.forEach((r) => {
            var i = objs.indexOf(r);
            objs.splice(i, 1);
          });
          objs.forEach((obj) => this.addEdge(next, 'consistsOf', obj));
        }
        this.fire('executed_first', action, next);
        //action.resultsIn.checkduplicate()

      } else {
        //update creates reference values
        action.creates.forEach((c, i) => {
          c.value = result.created[i].value;
        });
        action.removes.forEach((c) => c.value = null);
      }
      let hash = next.calcSimHash();
      //console.log("recalculated hash of " + next.id +" is " + hash);

      result.inverse = asFunction(result.inverse);
      action.updateInverse(this, <IInverseActionCreator>result.inverse);

      this.switchToImpl(action, next);

      return {
        action: action,
        state: next,
        created: created,
        removed: removed,
        consumed: result.consumed
      };
    });

    runningAction.then((result) => {
      const q = this.nextQueue.shift();
      if (q) {
        q();
      } else {
        this.currentlyRunning = false;
      }
    });

    return runningAction;
  }

  private switchToImpl(action:ActionNode, state:StateNode) {
    var bak:any = this.act;
    this.act = state;
    this.fire('switch_state', state, bak);

    bak = this.lastAction;
    this.lastAction = action;
    this.fire('switch_action', action, bak);
  }

  /**
   * execute a bunch of already executed actions
   * @param actions
   */
  private runChain(actions:ActionNode[], withinMilliseconds = -1) {
    if (actions.length === 0) {
      if (withinMilliseconds > 0) {
        return C.resolveIn(withinMilliseconds).then(() => []);
      }
      return Promise.resolve([]);
    }
    //actions = compress(actions, null);
    const last = actions[actions.length - 1];

    return compress(actions).then((torun) => {
      var r = Promise.resolve([]);

      var remaining = withinMilliseconds;

      function guessTime(index) {
        const left = torun.length - index;
        return () => remaining < 0 ? -1 : remaining / left; //uniformly distribute
      }

      function updateTime(consumed) {
        remaining -= consumed;
      }

      torun.forEach((action, i) => {
        r = r.then((results) => this.run(action, withinMilliseconds < 0 ? -1 : guessTime(i)).then((result) => {
          results.push(result);
          updateTime(result.consumed);
          return results;
        }));
      });
      return r.then((results) => {
        if (this.act !== last.resultsIn) {
          this.switchToImpl(last, last.resultsIn);
        }
        return results;
      });
    });
  }

  undo() {
    if (!this.lastAction) {
      return Promise.resolve(null);
    }
    //create and store the inverse
    if (this.lastAction.inverses != null) {
      //undo and undoing should still go one up
      return this.jumpTo(this.act.previousState);
    } else {
      return this.inOrder(() => this.run(this.lastAction.getOrCreateInverse(this)));
    }
  }

  jumpTo(state:StateNode, withinMilliseconds = -1) {
    return this.inOrder(() => {
      var actions:ActionNode[] = [],
        act = this.act;
      if (act === state) { //jump to myself
        return withinMilliseconds >= 0 ? C.resolveIn(withinMilliseconds).then(() => []) : Promise.resolve([]);
      }
      //lets look at the simple past
      var act_path = act.path,
        target_path = state.path;
      var common = findCommon(act_path, target_path);
      if (common) {
        var to_revert = act_path.slice(common.i + 1).reverse(),
          to_forward = target_path.slice(common.j + 1);
        actions = actions.concat(to_revert.map((r) => r.resultsFrom[0].getOrCreateInverse(this)));
        actions = actions.concat(to_forward.map((r) => r.resultsFrom[0]));
      }
      //no in the direct branches maybe in different loop instances?
      //TODO
      return this.runChain(actions, withinMilliseconds);
    });
  }

  fork(action:ActionNode, target:StateNode) {
    //sanity check if target is a child of target ... bad
    //collect all states
    const all:StateNode[] = [];
    const queue = [action.resultsIn];
    while (queue.length > 0) {
      let next = queue.shift();
      if (all.indexOf(next) >= 0) {
        continue;
      }
      all.push(next);
      queue.push.apply(queue, next.nextStates);
    }
    if (all.indexOf(target) >= 0) {
      return false; //target is a child of state
    }

    const targetObjects = target.consistsOf;
    const sourceObjects = action.previous.consistsOf;
    //function isSame(a: any[], b : any[]) {
    //  return a.length === b.length && a.every((ai, i) => ai === b[i]);
    //}
    //if (isSame(targetObjects, sourceObjects)) {
    //no state change ~ similar state, just create a link
    //we can copy the action and point to the same target
    //  const clone = this.initAction(action.clone(), action.requires);
    //  this.addEdge(target, 'next', clone);
    //  this.addEdge(clone, 'resultsIn', action.resultsIn);
    //} else {
    const removedObjects = sourceObjects.filter((o) => targetObjects.indexOf(o) < 0);
    //need to copy all the states and actions
    this.copyBranch(action, target, removedObjects);
    //}

    this.fire('forked_branch', action, target);
    return true;
  }

  private copyAction(action:ActionNode, appendTo:StateNode) {
    const clone = this.initAction(action.clone(), action.requires);
    this.addEdge(appendTo, 'next', clone);
    var s = this.makeState(action.resultsIn.name, action.resultsIn.description);
    this.addEdge(clone, 'resultsIn', s);
    return s;
  }

  private copyBranch(action:ActionNode, target:StateNode, removedObject:ObjectNode<any>[]) {
    var queue = [{a: action, b: target}];
    while (queue.length > 0) {
      let next = queue.shift();
      var b = next.b;
      let a = next.a;
      if (!a.requires.some((ai) => removedObject.indexOf(ai) >= 0)) {
        //copy it and create a new pair to execute
        b = this.copyAction(a, next.b);
      }
      queue.push.apply(queue, a.resultsIn.next.map((aa) => ({a: aa, b: b})));
    }
  }

  private makeState(name:string, description = '') {
    var s = new StateNode(name, description);
    this._states.push(s);
    this.backend.addNode(s);
    this.fire('add_state', s);
    return s;
  }

  persist() {
    var r = (<any>this.backend).persist();
    r.act = this.act ? this.act.id : null;
    r.lastAction = this.lastAction ? this.lastAction.id : null;
    return r;
  }

  /*
   restore(persisted: any) {
   const lookup = {},
   lookupFun = (id) => lookup[id];
   const types = {
   action: ActionNode,
   state: StateNode,
   object: ObjectNode
   };
   this.clear();
   persisted.nodes.forEach((p) => {
   var n = types[p.type].restore(p, factory);
   lookup[n.id] = n;
   if (n instanceof ActionNode) {
   this._actions.push(n);
   } else if (n instanceof StateNode) {
   this._states.push(n);
   } else if (n instanceof ObjectNode) {
   this._objects.push(n);
   }
   this.backend.addNode(n);
   });
   if (persisted.act) {
   this.act = lookup[persisted.id];
   }
   if (persisted.lastAction) {
   this.lastAction = lookup[persisted.lastAction];
   }

   persisted.edges.forEach((p) => {
   var n = (new graph.GraphEdge()).restore(p, lookupFun);
   this.backend.addEdge(n);
   });
   return this;
   }*/


  wrapAsSlide(state:StateNode) {
    const node = new SlideNode();
    node.name = state.name;
    this.addEdge(node, 'jumpTo', state);
    this._slides.push(node);
    this.backend.addNode(node);
    this.fire('add_slide', node);
    return node;
  }

  cloneSingleSlideNode(state:SlideNode) {
    const clone = state.state != null ? this.wrapAsSlide(state.state) : this.makeTextSlide();
    state.attrs.forEach((attr) => {
      if (attr !== 'annotations') {
        clone.setAttr(attr, state.getAttr(attr, null));
      }
    });
    clone.setAttr('annotations', state.annotations.map((a) => C.mixin({}, a)));
    return clone;
  }

  /**
   * creates a new slide of the given StateNode by jumping to them
   * @param states
   */
  extractSlide(states:StateNode[], addStartEnd = true):SlideNode {
    const addSlide = (node:SlideNode) => {
      this._slides.push(node);
      this.backend.addNode(node);
      this.fire('add_slide', node);
      return node;
    };
    var slide:SlideNode = addStartEnd ? addSlide(SlideNode.makeText('Unnamed Story')) : null,
      prev = slide;
    states.forEach((s, i) => {
      const node = addSlide(new SlideNode());
      node.name = s.name;
      this.addEdge(node, 'jumpTo', s);
      if (prev) {
        this.addEdge(prev, 'next', node);
      } else {
        slide = node;
      }
      prev = node;
    });

    if (addStartEnd) {
      const last = SlideNode.makeText('Thanks');
      addSlide(last);
      this.addEdge(prev, 'next', last);
    }

    this.fire('extract_slide', slide);
    this.selectSlide(slide);
    return slide;
  }

  startNewSlide(title?:string, states:StateNode[] = []) {
    const s = this.makeTextSlide(title);
    if (states.length > 0) {
      const s2 = this.extractSlide(states, false);
      this.addEdge(s, 'next', s2);
    }
    this.fire('start_slide', s);
    return s;
  }


  makeTextSlide(title?:string) {
    const s = SlideNode.makeText(title);
    this._slides.push(s);
    this.backend.addNode(s);
    this.fire('add_slide', s);
    return s;
  }

  insertIntoSlide(toInsert:SlideNode, slide:SlideNode, beforeIt:boolean = false) {
    this.moveSlide(toInsert, slide, beforeIt);
  }

  appendToSlide(slide:SlideNode, elem:SlideNode) {
    const s = toSlidePath(slide);
    return this.moveSlide(elem, s[s.length - 1], false);
  }

  moveSlide(node:SlideNode, to:SlideNode, beforeIt:boolean = false) {
    if ((beforeIt && node.next === to) || (!beforeIt && node.previous === to)) {
      return; //already matches
    }
    //1. extract the node
    //create other links
    const prev = node.previous;
    if (prev) {
      node.nexts.forEach((n) => {
        this.addEdge(prev, 'next', n);
      });
    }
    //remove links
    this.edges.filter((e) => (e.source === node || e.target === node) && e.type === 'next').forEach((e) => {
      this.backend.removeEdge(e);
    });

    //insert into the new place
    if (beforeIt) {
      const tprev = to.previous;
      if (tprev) {
        this.edges.filter((e) => (e.target === to) && e.type === 'next').forEach((e) => {
          this.backend.removeEdge(e);
        });
        this.addEdge(tprev, 'next', node);
        this.addEdge(node, 'next', to);
      }
      this.addEdge(node, 'next', to);
    } else {
      const tnexts = to.nexts;
      if (tnexts.length > 0) {
        this.edges.filter((e) => (e.source === to) && e.type === 'next').forEach((e) => {
          this.backend.removeEdge(e);
        });
        tnexts.forEach((next) => {
          this.addEdge(node, 'next', next);
        });
      }
      this.addEdge(to, 'next', node);
    }
    this.fire('move_slide', node, to, beforeIt);
  }

  removeSlideNode(node:SlideNode) {
    const prev = node.previous;
    if (prev) {
      node.nexts.forEach((n) => {
        this.addEdge(prev, 'next', n);
      });
    }
    this.edges.filter((e) => e.source === node || e.target === node).forEach((e) => {
      this.backend.removeEdge(e);
    });
    this._slides.splice(this._slides.indexOf(node), 1);
    this.backend.removeNode(node);
    this.fire('remove_slide', node);
  }

  removeFullSlide(node:SlideNode) {
    //go to the beginning
    while (node.previous) {
      node = node.previous;
    }
    const bak = node;
    while (node) {
      let next = node.next;
      this.removeSlideNode(node);
      node = next;
    }
    this.fire('destroy_slide', bak);
  }

  setSlideJumpToTarget(node:SlideNode, state:StateNode) {
    const old = node.outgoing.filter(graph.isType('jumpTo'))[0];
    if (old) {
      this.backend.removeEdge(old);
    }
    if (state) {
      this.addEdge(node, 'jumpTo', state);
    }
    this.fire('set_jump_target', node, old ? old.target : null, state);
  }
}

export function findLatestPath(state:StateNode) {
  var path = state.path.slice();
  //compute the first path to the end
  while ((state = state.nextState) != null && (path.indexOf(state) < 0)) {
    path.push(state);
  }
  return path;
}

export function createDummy() {
  const desc = {
    type: 'provenance_graph',
    id: 'dummy',
    name: 'dummy',
    fqname: 'dummy'
  };
  return new ProvenanceGraph(desc, new graph.MemoryGraph(desc, [], [], provenanceGraphFactory()));
}
