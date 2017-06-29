/**
 * Created by Holger Stitz on 28.06.2017.
 */
import {IProperty} from './VisStateProperty';


export interface IPropertyComparator {
  compare: (a:IProperty, b:IProperty) => number;
}

abstract class PropertyComparator implements IPropertyComparator {
  constructor() {
    //
  }

  abstract compare(a:IProperty, b:IProperty):number;
}

export class NumericalPropertyComparator extends PropertyComparator {
  constructor() {
    super();
  }

  compare(a:IProperty, b:IProperty):number {
    console.log('compare using numerical distance', a, b);
    return 0;
  }
}

export class CategoricalPropertyComparator extends PropertyComparator {
  constructor() {
    super();
  }

  compare(a:IProperty, b:IProperty):number {
    console.log('compare using tf-idf', a, b);
    return 0;
  }
}

export class SetPropertyComparator extends PropertyComparator {
  constructor() {
    super();
  }

  compare(a:IProperty, b:IProperty):number {
    console.log('compare using jaccard index', a, b);
    return 0;
  }
}
