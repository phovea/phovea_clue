/**
 * Created by Samuel Gratzl on 27.08.2015.
 */
import { ProvenanceGraph, SlideNode } from 'phovea_core';
export declare const FACTOR = 1;
export declare const MIN_DURATION = -1;
export declare const MIN_TRANSITION = -1;
/**
 * story player interface and logic
 */
export declare class Player {
    private graph;
    private anim;
    private options;
    private $play;
    constructor(graph: ProvenanceGraph, controls: Element, options?: any);
    start(): boolean;
    render(story: SlideNode): PromiseLike<SlideNode>;
    private stopAnim;
    stop(): void;
    pause(): void;
    /**
     * renders the next slide in an animated fashion
     */
    private next;
    /**
     * jumps to the next slide
     * @returns {any}
     */
    forward(): PromiseLike<SlideNode>;
    /**
     * jumps to the previous slide
     * @returns {any}
     */
    backward(): PromiseLike<SlideNode>;
}
