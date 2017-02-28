/**
 * Created by Samuel Gratzl on 28.02.2017.
 */


import {mixin} from 'phovea_core/src/index';
import {AppHeader} from 'phovea_ui/src/header';
import * as $ from 'jquery';
import {bindLoginForm, form as loginForm, logout} from 'phovea_security_flask/src/login';
import {setLoggedIn} from '../user';


export interface ILoginMenuOptions {
  /**
   * formular used for the login dialog
   */
  loginForm?: string;

  insertIntoHeader?: boolean;
}

export default class LoginMenu {

  readonly node: HTMLUListElement;
  private readonly options: ILoginMenuOptions = {
    loginForm,
    insertIntoHeader: true
  };
  constructor(private readonly header: AppHeader, options: ILoginMenuOptions = {}) {
    mixin(this.options, options);
    this.node = this.init();
    if (this.options.insertIntoHeader) {
      this.header.insertCustomRightMenu(this.node);
    }
  }

  private init() {
    const ul = this.header.aboutDialog.ownerDocument.createElement('ul');
    ul.classList.add('nav', 'navbar-nav', 'navbar-right');
    ul.innerHTML = `
      <li id="login_menu">
        <a data-toggle="modal" data-target="#loginDialog" href="#">
        <i class="fa fa-user fa-fw" aria-hidden="true"></i>
        </a></li>
        <li style="display: none" class="dropdown" id="user_menu">
            <a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true"
               aria-expanded="false"><i class="fa fa-user" aria-hidden="true"></i> Unknown</a>
            <ul class="dropdown-menu">
                <li role="separator" class="divider"></li>
                <li><a href="#" id="logout_link">Logout</a></li>
            </ul>
        </li>`;

    this.initLoginDialog(ul.ownerDocument.body);

    return ul;
  }

  private initLoginDialog(body: HTMLElement) {

    body.insertAdjacentHTML('beforeend', ` 
      <!--login dialog-->
      <div class="modal fade" id="loginDialog" tabindex="-1" role="dialog" aria-labelledby="loginDialog" data-keyboard="false" data-backdrop="static">
        <div class="modal-dialog modal-sm">
          <div class="modal-content">
            <div class="modal-header">
              <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span
                aria-hidden="true">&times;</span></button>
              <h4 class="modal-title">Please login</h4>
            </div>
            <div class="modal-body">
              ${this.options.loginForm || loginForm}
            </div>
          </div>
        </div>
      </div>`);

    const that = this;
    {
      const form = <HTMLFormElement>body.querySelector('#loginDialog form');
      bindLoginForm(form, (error, user) => {
        setLoggedIn(!!(!error && user), user);
        if (!error && user) {
          $('#login_menu').hide();
          const $base = $('#user_menu').show();
          form.classList.remove('has-error');
          $base.find('> a:first').text(user.name);

          (<any>$('#loginDialog')).modal('hide');

          // remove all .login_required magic flags
          $('.login_required.disabled').removeClass('disabled').attr('disabled', null);
        } else {
          that.header.ready();
          form.classList.add('has-error');
        }
      });
    }


    $('#logout_link').on('click', () => {
      that.header.wait();
      logout().then(function () {
        setLoggedIn(false);
        $('#user_menu').hide();
        $('#login_menu').show();
        $('.login_required').addClass('disabled');
        that.header.ready();
      });
    });
  }
}
