/**
 * Created by Samuel Gratzl on 28.02.2017.
 */
import { AppHeader } from 'phovea_ui';
import { LoginMenu as BaseLoginMenu, ILoginMenuOptions as IBaseLoginMenuOptions } from 'phovea_security_flask';
export interface ILoginMenuOptions extends IBaseLoginMenuOptions {
    insertIntoHeader?: boolean;
}
export declare class LoginMenu extends BaseLoginMenu {
    private readonly header;
    constructor(header: AppHeader, options?: ILoginMenuOptions);
}
