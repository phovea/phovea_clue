/**
 * Created by Holger Stitz on 28.06.2017.
 */
import {
  CategoricalPropertyComparator, IPropertyComparator, NumericalPropertyComparator,
  SetPropertyComparator
} from './VisStatePropertyComparator';

export interface IProperty {
  text: string; // must be `text` because of Select2 usage
  values: IPropertyValue[]; // must be `children` because of Select2 usage
  comparator: IPropertyComparator;

  clone():IProperty;
}

export interface INumericalProperty extends IProperty {
  values: INumericalValue[]; // override with more specific numerical values
}

export interface IPropertyValue {
  id: string|number; // must be `id` because of Select2 usage
  text: string; // must be `text` because of Select2 usage
  isSelected: boolean;

  clone():IPropertyValue;
}

export interface INumericalValue extends IPropertyValue {
  numVal: number;

  clone():INumericalValue;
}

class Property implements IProperty {
  constructor(public text:string, public values: IPropertyValue[], public comparator:IPropertyComparator) {
    //
  }

  clone():IProperty {
    return new Property(this.text, this.values.slice(0).map((d) => d.clone()), this.comparator);
  }
}

class NumericalProperty extends Property implements INumericalProperty {
  constructor(public text: string, public values: INumericalValue[], public comparator: IPropertyComparator) {
    super(text, values, comparator);
  }
}


class PropertyValue implements IPropertyValue {
  constructor(public id:string|number, public text:string, public isSelected:boolean = false) {
    //
  }

  clone():IPropertyValue {
    return new PropertyValue(this.id, this.text, this.isSelected);
  }

  toJSON():string {
    return JSON.stringify({
      id: this.id
    });
  }
}

class NumericalPropertyValue extends PropertyValue implements INumericalValue {
  constructor(public id:string|number, public text:string, public isSelected:boolean = false, public numVal = 0) {
    super(id, text, isSelected);
  }

  clone():INumericalValue {
    return new NumericalPropertyValue(this.id, this.text, this.isSelected, this.numVal);
  }

  toJSON():string {
    return JSON.stringify({
      id: this.id,
      numVal: this.numVal
    });
  }
}

export function categoricalProperty(text:string, values:string[]|{text:string, id?:string|number}[]):IProperty {
  const vals:IPropertyValue[] = (<any>values).map((d) => {
    // case of string array -> use text for both
    if(Object.prototype.toString.call(d) === '[object String]') {
      return new PropertyValue(d, d);
    // case of missing id -> use text for both
    } else if(d.id === undefined) {
      return new PropertyValue(d.text, d.text);
    }
    // case of id and text
    return new PropertyValue(d.id, d.text);
  });

  return new Property(text, vals, new CategoricalPropertyComparator());
}

export function setProperty(text:string, values:string[]|{text:string, id?:string|number}[]):IProperty {
  const vals:IPropertyValue[] = (<any>values).map((d) => {
    // case of string array -> use text for both
    if(Object.prototype.toString.call(d) === '[object String]') {
      return new PropertyValue(d, d);
    // case of missing id -> use text for both
    } else if(d.id === undefined) {
      return new PropertyValue(d.text, d.text);
    }
    // case of id and text
    return new PropertyValue(d.id, d.text);
  });

  return new Property(text, vals, new SetPropertyComparator());
}

export function numericalProperty(text:string, values:string[]|{text:string, id?:string|number}[]):INumericalProperty {
  const textAddon = ' = <i>&lt;number&gt;</i>';

  const vals:INumericalValue[] = (<any>values).map((d) => {
    // case of string array -> use text for both
    if(Object.prototype.toString.call(d) === '[object String]') {
      return new NumericalPropertyValue(d, d + textAddon);
    // case of missing id -> use text for both
    } else if(d.id === undefined) {
      return new NumericalPropertyValue(d.text, d.text + textAddon);
    }
    // case of id and text
    return new NumericalPropertyValue(d.id, d.text + textAddon);
  });

  return new NumericalProperty(text, vals, new NumericalPropertyComparator());
}

export function isNumericalPropertyValue(value: IPropertyValue): value is INumericalValue {
  return (<INumericalValue>value).numVal !== undefined;
}
