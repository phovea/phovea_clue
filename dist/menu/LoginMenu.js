/**
 * Created by Samuel Gratzl on 28.02.2017.
 */
import { BaseUtils } from 'phovea_core';
import { LoginMenu as BaseLoginMenu } from 'phovea_security_flask';
export class LoginMenu extends BaseLoginMenu {
    constructor(header, options = {}) {
        super(header, BaseUtils.mixin({
            document: header.rightMenu.ownerDocument
        }, options));
        this.header = header;
        if (options.insertIntoHeader) {
            this.header.insertCustomRightMenu(this.node);
        }
    }
}
//# sourceMappingURL=LoginMenu.js.map