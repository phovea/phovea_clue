import {IDType} from "../caleydo_core/idtype";
import {isUndefined} from "../caleydo_core/main";
import Color = d3.Color;
import idtype = require('../caleydo_core/idtype')
import {IStateToken, StateTokenLeaf, StateTokenNode,TokenType} from "./statetoken";



class HashTable {

  constructor(maxSize:number) {
    this.maxSize = maxSize
  }

  dict:string[] = [];
  hashes:string[] = [];
  probs:number[] = []
  maxSize:number;


  push(value:string, prob:number, hash:string) {
    if (hash == null) hash = String(murmurhash2_32_gc(value, 0))
    let index = this.dict.indexOf(value)
    if (index < 0) {
      index = this.dict.length
    }
    this.dict[index] = value
    this.probs[value] = prob;
    this.hashes[value] = hash;
  }

  toHash(n:number):string {
    if (Object.keys(this.probs).length==0) {
      let st: string = "";
      for (let i:number = 0; i < n; i++) {
        st = st + "0"
      }
      return st;
    }

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

    var hash:string = "";
    for (var i:number=0; i < n; i++) {
      let hashPart = this.hashes[this.dict[samples[i]]]
      let bitToUse  = hashPart.charAt(i % hashPart.length) // use the "bitToUse" bit of "hashPart"
      hash = hash + bitToUse
    }
    this.hashes = []
    this.probs = []
    return hash;
  }
}

export class SimHash {

  private static _instance:SimHash = new SimHash();

  private _catWeighting:number[] = [30, 20, 25, 20, 5];
  private _nrBits:number = 200;

  public static get hasher():SimHash {
    return this._instance;
  }

  private hashTable:HashTable[] = [];
  private _HashTableSize:number = 1000;

  get categoryWeighting() {
    return this._catWeighting;
  }

  set categoryWeighting(weighting) {
    this._catWeighting = weighting;
    //this.fire('weighting_change');
  }

  getHashOfIDTypeSelection(type:IDType, selectionType):string {
    let selection:number[] = type.selections(selectionType).dim(0).asList(0);
    let allTokens:StateTokenLeaf[] = [];
    for (var sel of selection) {
      var t = new StateTokenLeaf(
        "dummy",
        1,
        TokenType.string,
        sel.toString(),
        ""
      )
      allTokens = allTokens.concat(t);
    }
    if (this.hashTable[type.id] == null) {
      this.hashTable[type.id] = new HashTable(this._HashTableSize)
    }
    for (let i:number = 0; i < allTokens.length; i++) {
      this.hashTable[type.id].push(allTokens[i].value, allTokens[i].importance, null)
    }
    return this.hashTable[type.id].toHash(this._nrBits)
  }

  getHashOfOrdinalIDTypeSelection(type:IDType, min:number, max:number, selectionType):string {
    if (this.hashTable[type.id] == null) {
      this.hashTable[type.id] = new HashTable(this._HashTableSize)
    }
    let selection:number[] = type.selections(selectionType).dim(0).asList(0);
    for (var sel of selection) {
      this.hashTable[type.id].push(
        String(sel),
        1,
        ordinalHash(min, max, sel, this._nrBits))
    }
    return this.hashTable[type.id].toHash(this._nrBits)
  }


  private prepHashCalc(tokens:StateTokenLeaf[], needsNormalization:boolean = true) {
    function groupBy(arr:StateTokenLeaf[]) {
      return arr.reduce(function (memo, x:StateTokenLeaf) {
          if (!memo[x.type]) {
            memo[x.type] = []
          }
          memo[x.type].push(x);
          return memo;
        }, {}
      );
    }

    if (needsNormalization && typeof tokens != 'undefined') {
      let totalImportance = tokens.reduce((prev, a:IStateToken) => prev + a.importance, 0)
      for (let i:number = 0; i < tokens.length; i++) {
        tokens[i].importance /= totalImportance
      }
    }

    return groupBy(tokens)
  }


  public calcHash(tokens:IStateToken[]):string[] {
    if (tokens.length == 0) {
      return ["invalid", "invalid", "invalid", "invalid", "invalid"]
    }
    tokens = this.normalizeTokenPriority(tokens, 1)
    let leafs:StateTokenLeaf[] = this.filterLeafsAndSerialize(tokens)

    function groupBy(arr:StateTokenLeaf[]) {
      return arr.reduce(function (memo, x:StateTokenLeaf) {
          if (!memo[x.category]) {
            memo[x.category] = []
          }
          memo[x.category].push(x);
          return memo;
        }, {}
      );
    }

    let categories = ["data", "visual", "selection", "layout", "analysis"]

    let hashes:string[] = []
    let groupedTokens = groupBy(leafs)
    for (let i = 0; i < 5; i++) {
      hashes[i] = this.calcHashOfCat(groupedTokens[categories[i]], categories[i])
    }
    return hashes
  }

  private calcHashOfCat(tokens:StateTokenLeaf[], cat:string) {
    if (!(typeof tokens != 'undefined')) return Array(this._nrBits + 1).join("0")

    let b:number = 0;
    let splitTokens = this.prepHashCalc(tokens)
    if (this.hashTable[cat] == null) {
      this.hashTable[cat] = new HashTable(this._HashTableSize)
    }

    let ordinalTokens:StateTokenLeaf[] = splitTokens[1];
    if (ordinalTokens !== undefined) {
      for (let i:number = 0; i < ordinalTokens.length; i++) {
        this.hashTable[cat].push(
          ordinalTokens[i].name,
          ordinalTokens[i].importance,
          ordinalHash(
            ordinalTokens[i].value[0],
            ordinalTokens[i].value[1],
            ordinalTokens[i].value[2],
            this._nrBits
          )
        )
      }
    }

    let ordidTypeTokens:StateTokenLeaf[] = splitTokens[2];
    if (ordidTypeTokens !== undefined) {
      for (let i:number = 0; i < ordidTypeTokens.length; i++) {
        this.hashTable[cat].push(
          ordidTypeTokens[i].name,
          ordidTypeTokens[i].importance,
          this.getHashOfOrdinalIDTypeSelection(
            ordidTypeTokens[i].value[0],
            ordidTypeTokens[i].value[1],
            ordidTypeTokens[i].value[2],
            idtype.defaultSelectionType
          )
        )
      }
    }


    let idtypeTokens:StateTokenLeaf[] = splitTokens[3];
    if (idtypeTokens !== undefined) {
      for (let i:number = 0; i < idtypeTokens.length; i++) {
        this.hashTable[cat].push(
          idtypeTokens[i].value,
          idtypeTokens[i].importance,
          this.getHashOfIDTypeSelection(
            idtypeTokens[i].value,
            idtype.defaultSelectionType
          )
        )
      }
    }

    let regularTokens:StateTokenLeaf[] = splitTokens[0];
    if (regularTokens !== undefined) {
      for (let i:number = 0; i < regularTokens.length; i++) {
        this.hashTable[cat].push(regularTokens[i].value, regularTokens[i].importance, null)
      }
    }


    return this.hashTable[cat].toHash(this._nrBits);
  };

  private normalizeTokenPriority(tokens:IStateToken[], baseLevel:number):IStateToken[] {
    let totalImportance = tokens.reduce((prev, a:IStateToken) => prev + a.importance, 0)
    for (let i:number = 0; i < tokens.length; i++) {
      tokens[i].importance = tokens[i].importance / totalImportance * baseLevel
      if (!(tokens[i] instanceof StateTokenLeaf)) {
        (<StateTokenNode>tokens[i]).childs = this.normalizeTokenPriority((<StateTokenNode>tokens[i]).childs, tokens[i].importance)
      }
    }
    return tokens
  }

  private filterLeafsAndSerialize(tokens:IStateToken[]):StateTokenLeaf[] {
    let childs:StateTokenLeaf[] = []
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] instanceof StateTokenLeaf) {
        childs = childs.concat(<StateTokenLeaf>tokens[i])
      } else {
        childs = childs.concat(
          this.filterLeafsAndSerialize((<StateTokenNode>tokens[i]).childs)
        )
      }
    }
    return childs;
  }

}


/*export class HashColor {

  static colorMap = []
  static size:number = 0;

  public static getColor(hash:string[]):Color {
    let col = this.colorMap[String(hash)];
    if (col==null) {
      col = d3.scale.category10().range()[this.size % 10]
      this.size += 1
      this.colorMap[String(hash)] = col
    }
    return col
  }


}*/



/**
   * Calculate a 32 bit FNV-1a hash
   * Found here: https://gist.github.com/vaiorabbit/5657561
   * Ref.: http://isthe.com/chongo/tech/comp/fnv/
   *
   * @param {string} str the input value
   * @param {integer} [seed] optionally pass the hash of the previous chunk
   * @returns {integer}
   */
   function hashFnv32a(str: string, seed:number):string {
      /*jshint bitwise:false */
      var i, l,
        hval = (typeof seed != 'undefined') ? 0x811c9dc5 : seed;
      for (i = 0, l = str.length; i < l; i++) {
          hval ^= str.charCodeAt(i);
          hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
      }
      return (hval >>> 0).toString(2);
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

    return (h >>> 0).toString(2);
  }

  function ordinalHash(min:number, max:number, value:number, nrBits:number):string {
    let pct = (value-min)/(max-min)
    let minH:string = hashFnv32a(String(min), 0)
    let maxH:string = hashFnv32a(String(max), 0)
    let rng = new RNG(1);

    let hash:string = ""
    for (let i = 0; i < nrBits; i++) {
      if (rng.nextDouble() > pct) {
        hash = hash + minH.charAt(i % minH.length)
      } else {
        hash = hash + maxH.charAt(i%maxH.length)
      }
    }
    return hash;
  }

  function dec2bin(dec:number):string{
    return (dec >>> 0).toString(2);
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
