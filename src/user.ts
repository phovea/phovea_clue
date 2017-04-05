/**
 * provides a template wrapper around an application for including CLUE. Includes the common frame for switching modes, provenance, and story visualizations
 *
 * Created by Samuel Gratzl on 27.08.2015.
 */


import {retrieve, store} from 'phovea_core/src/session';
import {fire} from 'phovea_core/src/event';

export function isLoggedIn() {
  return retrieve('logged_in') === true;
}

export function setLoggedIn(loggedIn: boolean, user?: {name: string}) {
  store('logged_in', loggedIn);
  if (loggedIn && user) {
    store('username', user.name);
    store('user', user);
    fire('USER_LOGGED_IN', user);
  }
  if (!loggedIn) {
    fire('USER_LOGGED_OUT');
  }
}
