/**
 * Created by Holger Stitz on 07.06.2017.
 */
import {IProperty, IPropertyValue} from 'phovea_core';

export interface IVisStateApp {
  /**
   * Get all properties (including property values)
   * that should be available for retrieval.
   *
   * This property can be seen as group for multiple property values.
   *
   * @returns {Promise<IProperty[]>}
   */
  getVisStateProps(): Promise<IProperty[]>;

  /**
   * Get property values that describe the current visualization state
   * and should be available later for retrieval.
   *
   * @returns {Promise<IPropertyValue[]>}
   */
  getCurrVisState(): Promise<IPropertyValue[]>;
}
