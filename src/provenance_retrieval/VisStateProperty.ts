/**
 * Created by Holger Stitz on 28.06.2017.
 */

export enum PropertyType {
  NUMERICAL,
  CATEGORICAL,
  SET
}

export interface IProperty {
  type: PropertyType;
  text: string; // must be `text` because of Select2 usage
  values: IPropertyValue[]; // must be `children` because of Select2 usage
}

export interface IPropertyValue {
  type: PropertyType;
  id: string|number; // must be `id` because of Select2 usage
  text: string; // must be `text` because of Select2 usage
  payload: any;
  isSelected: boolean;
}

class Property implements IProperty {
  constructor(public type: PropertyType, public text:string, public values: IPropertyValue[]) {
    //
  }
}

class PropertyValue implements IPropertyValue {
  isSelected:boolean = false;

  constructor(public type: PropertyType, public id:string|number, public text:string, public payload:any) {
    //
  }

  toJSON():any {
    const r:any = {
      type: this.type,
      text: this.text,
    };

    if(this.id !== this.text) {
      r.id = this.id;
    }

    if(this.payload !== undefined) {
      r.payload = this.payload;
    }

    return r;
  }
}

export function categoricalProperty(text:string, values:string[]|{text:string, id?:string|number}[]):IProperty {
  const vals:IPropertyValue[] = (<any>values).map((d) => createPropertyValue(PropertyType.CATEGORICAL, d));
  return new Property(PropertyType.CATEGORICAL, text, vals);
}

export function setProperty(text:string, values:string[]|{text:string, id?:string|number}[]):IProperty {
  const vals:IPropertyValue[] = (<any>values).map((d) => createPropertyValue(PropertyType.SET, d));
  return new Property(PropertyType.SET, text, vals);
}

export function numericalProperty(text:string, values:string[]|{text:string, id?:string|number}[]):IProperty {
  const textAddon = ' = <i>&lt;number&gt;</i>';
  const vals:IPropertyValue[] = (<any>values).map((d) => createPropertyValue(PropertyType.NUMERICAL, d, textAddon));
  return new Property(PropertyType.NUMERICAL, text, vals);
}

export function createPropertyValue(type:PropertyType, data:any, textAddon:string = ''):IPropertyValue {
  let id = data.id || data.text;
  let text = data.text + textAddon;

  if(Object.prototype.toString.call(data) === '[object String]') {
    id = data;
    text = data + textAddon;
  }

  return new PropertyValue(type, id, text, data.payload);
}
