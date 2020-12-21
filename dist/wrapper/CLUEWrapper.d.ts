/// <amd-dependency path="font-awesome" />
/// <amd-dependency path="bootstrap" />
/**
 * provides a template wrapper around an application for including CLUE. Includes the common frame for switching modes, provenance, and story visualizations
 *
 * Created by Samuel Gratzl on 27.08.2015.
 */
import { IHeaderLink, IAppHeaderOptions, AppHeader } from 'phovea_ui';
import { IObjectRef, ProvenanceGraph } from 'phovea_core';
import { CLUEGraphManager } from '../base/CLUEGraphManager';
import { ACLUEWrapper, IACLUEWrapperOptions } from './ACLUEWrapper';
import * as d3 from 'd3';
export declare class ClueSidePanelEvents {
    static OPEN: string;
    static CLOSE: string;
    static TOGGLE: string;
}
export interface ICLUEWrapperOptions extends IACLUEWrapperOptions {
    /**
     * the name of the application
     */
    app?: string;
    /**
     * the URL of the application, used e.g., for generating screenshots
     */
    application?: string;
    /**
     * the id of the application, for differentiating provenance graphs
     */
    id?: string;
    /**
     * the selection type to record
     */
    recordSelectionTypes?: string;
    /**
     * whether selection replays should be animated
     */
    animatedSelections?: boolean;
    /**
     * whether thumbnails should be shown in the provenance or story vis
     */
    thumbnails?: boolean;
    /**
     * App Header Link
     */
    appLink?: IHeaderLink;
    /**
     * Should the provenance graph layout be collapsed by default?
     */
    provVisCollapsed?: boolean;
    /**
     * Options that will be passed to the header
     */
    headerOptions?: IAppHeaderOptions;
    /**
     * formular used for the login dialog
     */
    loginForm?: string;
}
export declare class CLUEWrapper extends ACLUEWrapper {
    private options;
    header: AppHeader;
    $main: d3.Selection<any>;
    $mainRef: IObjectRef<d3.Selection<any>>;
    constructor(body: HTMLElement, options?: ICLUEWrapperOptions);
    protected buildImpl(body: HTMLElement): {
        graph: Promise<ProvenanceGraph>;
        manager: CLUEGraphManager;
        storyVis: () => Promise<import("..").VerticalStoryVis>;
        provVis: () => Promise<import("..").LayoutedProvVis>;
    };
    reset(): void;
    /**
     * factory method creating a CLUEWrapper instance
     * @param body
     * @param options
     * @returns {CLUEWrapper}
     */
    static createCLUEWrapper(body: HTMLElement, options?: any): CLUEWrapper;
    /**
     * factory method creating a CLUEWrapper instance
     * @param body
     * @param options
     * @returns {CLUEWrapper}
     */
    static createWrapperFactory(body: HTMLElement, options?: any): {
        on: (...args: any[]) => number;
        $main: d3.Selection<any>;
        graph: PromiseLike<ProvenanceGraph>;
        jumpToStored: () => number;
    };
}
