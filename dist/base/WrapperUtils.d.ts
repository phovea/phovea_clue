/**
 * Created by Samuel Gratzl on 28.02.2017.
 */
import { ProvenanceGraph, IEventHandler } from 'phovea_core';
export interface ICLUEWrapper extends IEventHandler {
    jumpToState(state: number): Promise<any>;
    jumpToStory(state: number): Promise<any>;
    nextSlide(): Promise<any>;
    previousSlide(): Promise<any>;
}
export declare class WrapperUtils {
    /**
     * injection for headless support
     * @param wrapper
     */
    static injectHeadlessSupport(wrapper: ICLUEWrapper): void;
    static injectParentWindowSupport(wrapper: ICLUEWrapper): void;
    static handleMagicHashElements(body: HTMLElement, manager: ICLUEWrapper): void;
    static useInMemoryGraph(): boolean;
    static triggeredByInputField(evt: KeyboardEvent): boolean;
    /**
     * enables keyboard shortcuts to undo and change mode
     * @param graph
     */
    static enableKeyboardShortcuts(graph: ProvenanceGraph): void;
}
