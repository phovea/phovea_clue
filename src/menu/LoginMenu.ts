/**
 * Created by Samuel Gratzl on 28.02.2017.
 */


import {BaseUtils} from 'phovea_core';
import {AppHeader} from 'phovea_ui';
import { LoginMenu as BaseLoginMenu,
  ILoginMenuOptions as IBaseLoginMenuOptions
} from 'phovea_security_flask';


export interface ILoginMenuOptions extends IBaseLoginMenuOptions {
  insertIntoHeader?: boolean;
}

export class LoginMenu extends BaseLoginMenu {
  constructor(private readonly header: AppHeader, options: ILoginMenuOptions = {}) {
    super(header, BaseUtils.mixin({
      document: header.rightMenu.ownerDocument
    }, options));
    if (options.insertIntoHeader) {
      this.header.insertCustomRightMenu(this.node);
    }
  }
}
