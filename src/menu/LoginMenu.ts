/**
 * Created by Samuel Gratzl on 28.02.2017.
 */


import {mixin} from 'phovea_core/src/index';
import {AppHeader} from 'phovea_ui/src/header';
import * as $ from 'jquery';
import BaseLoginMenu, {
  ILoginMenuAdapter,
  ILoginMenuOptions as IBaseLoginMenuOptions
} from 'phovea_security_flask/src/LoginMenu';


export interface ILoginMenuOptions extends IBaseLoginMenuOptions {
  insertIntoHeader?: boolean;
}

function adapter(header: AppHeader): ILoginMenuAdapter {
  return {
    wait: () => header.wait(),
    ready: () => header.ready(),
    hideDialog: (selector) => $(selector).modal('hide'),
    showAndFocusOn: (selector, focusSelector) => {
      $(selector).modal('show')
        .on('shown.bs.modal', function () {
          $(focusSelector, selector).focus();
        });
    }
  };
}

export default class LoginMenu extends BaseLoginMenu {
  constructor(private readonly header: AppHeader, options: ILoginMenuOptions = {}) {
    super(adapter(header), mixin({
      document: header.rightMenu.ownerDocument
    }, options));
    if (options.insertIntoHeader) {
      this.header.insertCustomRightMenu(this.node);
    }
  }
}
