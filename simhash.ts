import {IDType} from "../caleydo_core/idtype";
import statetoken = require('../caleydo_core/statetoken');
import idtype = require('../caleydo_core/idtype')
import {idtypes} from "../caleydo_core/wrapper";
import {SelectionIDType} from "../caleydo_d3/selectioninfo";
import {isUndefined} from "../caleydo_core/main";



class HashTable {

  constructor(maxSize:number) {
    this.maxSize = maxSize
  }

  dict:string[] = [];
  hashes:number[] = [];
  probs:number[] = []
  size = 0;
  maxSize:number;


  push(value:string, prob:number, hash:number) {
    if (hash == null) hash = murmurhash2_32_gc(value, 0)
    let index = this.dict.indexOf(value)
    if (index < 0) {
      index = this.size
    }
    this.dict[index] = value
    this.probs[value] = prob;
    this.hashes[value] = hash;
    this.size += 1

  }

  toHash(n:number) {
    let cdf:number[] = [];
    let lastElement = this.probs[this.dict[this.dict.length - 1]]
    if (lastElement == null) lastElement=0
    cdf[0] = lastElement;

    for (var i:number = 1; i < this.dict.length; i++) {
      let val:number = this.probs[this.dict[this.dict.length - i-1]]
      val = isUndefined(val) ? 0 : val;
      cdf[i] = cdf[i - 1] + val;
    }
    cdf = cdf.reverse()
    for (var i:number = 0; i < this.dict.length; i++) {
      cdf[i] = this.probs[this.dict[i]] / cdf[i]
    }

    var rng:RNG = new RNG(1)
    var samples:number[] = []
    for (var i:number=0; i < n; i++){
      var found: boolean = false
      for (var j: number=0; j < this.maxSize; j++) {
        var rndN:number = rng.nextDouble()
        if (!found && rndN < cdf[j]){
          samples[i] = j
          found = true
        }
      }
    }

    var hash:number = 0;
    for (var i:number=0; i < n; i++) {
      hash = (this.hashes[this.dict[samples[i]]] >>i) % 2 == 0  ? hash << 1 : (hash << 1) +1
    }
    this.hashes = []
    this.probs = []
    return hash;
  }
}

export class SimHash {

  private static _instance: SimHash = new SimHash();


  public static get hasher():SimHash {
    return this._instance;
  }

  private hashTable: HashTable;
  private _HashTableSize:number = 500;

  constructor() {
    this.hashTable = new HashTable(this._HashTableSize);
  }

  getHashOfIDTypeSelection(type:IDType, selectionType):number {
    let selection:number[] = type.selections(selectionType).dim(0).asList(0);
    let allTokens: statetoken.IStateToken[] = [];
    for (var sel of selection) {
      var t = {
        name: "dummy",
        value: sel.toString(),
        type: statetoken.TokenType.string,
        importance: 1
      }
      allTokens = allTokens.concat(t);
    };
    return this.calcHash(allTokens);
  }

  getHashOfOrdinalIDTypeSelection(token:statetoken.IStateToken, selectionType):number {
    let selection:number[] = token.value.type.selections(selectionType).dim(0).asList(0);
    let allTokens: statetoken.IStateToken[] = [];
    for (var sel of selection) {
      var t = {
        name: "dummy",
        value: sel.toString(),
        type: statetoken.TokenType.string,
        importance: 1
      }
      allTokens = allTokens.concat(t);
    };
    return this.calcHash(allTokens);
  }

  public calcHash(tokens:statetoken.IStateToken[]): number{
    let nrBits:number =50;
    let b:number = 0;

    function groupBy(arr: statetoken.IStateToken[]){
      return arr.reduce(function(memo, x: statetoken.IStateToken) {
        if (!memo[x.type]){
          memo[x.type] = []
        }
        memo[x.type].push(x);
        return memo;
      },{}
      );
    }

    let totalImportance = tokens.reduce((prev, a:statetoken.IStateToken) => prev+ a.importance,0)
    for (let i: number=0; i < tokens.length; i++) {
      tokens[i].importance /= totalImportance
    }

    let splitTokens = groupBy(tokens)
    let hashDict:number[] = []

    /*
    let ordidTypeTokens:statetoken.IStateToken[] = splitTokens[2];
    if (ordidTypeTokens !== undefined) {

      for (let i:number=0; i < idtypeTokens.length; i++) {
        hashDict[<any>idtypeTokens[i]] =this.getHashOfOrdinalIDTypeSelection(
            idtypeTokens[i].value,
            idtype.defaultSelectionType
          )
      }
    }
    */

    let idtypeTokens:statetoken.IStateToken[] = splitTokens[3];
    if (idtypeTokens !== undefined) {

      for (let i:number=0; i < idtypeTokens.length; i++) {
        hashDict[<any>idtypeTokens[i]] =this.getHashOfIDTypeSelection(
            idtypeTokens[i].value,
            idtype.defaultSelectionType
          )
      }
      for (let i =0; i < idtypeTokens.length; i++) {
        this.hashTable.push(
          idtypeTokens[i].value,
          idtypeTokens[i].importance,
          hashDict[<any>idtypeTokens[i]]
        )
      }
    }

    let regularTokens:statetoken.IStateToken[] = splitTokens[0];
    if (regularTokens !== undefined) {
      for (let i:number=0; i < regularTokens.length; i++) {
        this.hashTable.push(regularTokens[i].value,regularTokens[i].importance, null)
      }
    }



    return this.hashTable.toHash(nrBits);
  }
}


/**
   * Calculate a 32 bit FNV-1a hash
   * Found here: https://gist.github.com/vaiorabbit/5657561
   * Ref.: http://isthe.com/chongo/tech/comp/fnv/
   *
   * @param {string} str the input value
   * @param {integer} [seed] optionally pass the hash of the previous chunk
   * @returns {integer}
   */
   function hashFnv32a(str: string, seed:number) {
      /*jshint bitwise:false */
      var i, l,
        hval = (typeof seed != 'undefined') ? 0x811c9dc5 : seed;
      for (i = 0, l = str.length; i < l; i++) {
          hval ^= str.charCodeAt(i);
          hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
      }
      return hval >>> 0;
  }


    /**
   * JS Implementation of MurmurHash2
   *
   * @author <a href="mailto:gary.court@gmail.com">Gary Court</a>
   * @see http://github.com/garycourt/murmurhash-js
   * @author <a href="mailto:aappleby@gmail.com">Austin Appleby</a>
   * @see http://sites.google.com/site/murmurhash/
   *
   * @param {string} str ASCII only
   * @param {number} seed Positive integer only
   * @return {number} 32-bit positive integer hash
   */
  function murmurhash2_32_gc(str, seed) {
    var
      l = str.length,
      h = seed ^ l,
      i = 0,
      k;

    while (l >= 4) {
      k =
        ((str.charCodeAt(i) & 0xff)) |
        ((str.charCodeAt(++i) & 0xff) << 8) |
        ((str.charCodeAt(++i) & 0xff) << 16) |
        ((str.charCodeAt(++i) & 0xff) << 24);

      k = (((k & 0xffff) * 0x5bd1e995) + ((((k >>> 16) * 0x5bd1e995) & 0xffff) << 16));
      k ^= k >>> 24;
      k = (((k & 0xffff) * 0x5bd1e995) + ((((k >>> 16) * 0x5bd1e995) & 0xffff) << 16));

    h = (((h & 0xffff) * 0x5bd1e995) + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16)) ^ k;

      l -= 4;
      ++i;
    }

    switch (l) {
    case 3: h ^= (str.charCodeAt(i + 2) & 0xff) << 16;
    case 2: h ^= (str.charCodeAt(i + 1) & 0xff) << 8;
    case 1: h ^= (str.charCodeAt(i) & 0xff);
            h = (((h & 0xffff) * 0x5bd1e995) + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16));
    }

    h ^= h >>> 13;
    h = (((h & 0xffff) * 0x5bd1e995) + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16));
    h ^= h >>> 15;

    return h >>> 0;
  }



class RNG {
    private seed:number;

    constructor(seed:number) {
        this.seed = seed;
    }

    private next(min:number, max:number):number {
        max = max || 0;
        min = min || 0;

        this.seed = (this.seed * 9301 + 49297) % 233280;
        var rnd = this.seed / 233280;

        return min + rnd * (max - min);
    }

    // http://indiegamr.com/generate-repeatable-random-numbers-in-js/
    public nextInt(min:number, max:number):number {
        return Math.round(this.next(min, max));
    }

    public nextDouble():number {
        return this.next(0, 1);
    }

    public pick(collection:any[]):any {
        return collection[this.nextInt(0, collection.length - 1)];
    }
}
