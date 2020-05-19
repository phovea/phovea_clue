/**
 * Created by Samuel Gratzl on 28.02.2017.
 */


import {mixin} from 'phovea_core/src/index';
import {AppHeader} from 'phovea_ui/src/header';
import { LoginMenu as BaseLoginMenu,
  ILoginMenuOptions as IBaseLoginMenuOptions
} from 'phovea_security_flask/src/LoginMenu';


export interface ILoginMenuOptions extends IBaseLoginMenuOptions {
  insertIntoHeader?: boolean;
}

export class LoginMenu extends BaseLoginMenu {
  constructor(private readonly header: AppHeader, options: ILoginMenuOptions = {}) {
    super(header, mixin({
      document: header.rightMenu.ownerDocument
    }, options));
    if (options.insertIntoHeader) {
      this.header.insertCustomRightMenu(this.node);
    }
  }
}
