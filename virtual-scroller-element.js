import {_item, _key, ItemSource} from './item-source.js';
import {default as Layout1dGrid} from './layouts/layout-1d-grid.js';
import {default as Layout1d} from './layouts/layout-1d.js';
import {VirtualScroller} from './virtual-scroller.js';

export {ItemSource};

/** Properties */
const _scroller = Symbol();
const _createElement = Symbol();
const _updateElement = Symbol();
const _recycleElement = Symbol();
const _nodePool = Symbol();
const _rawItemSource = Symbol();
const _itemSource = Symbol();
const _elementSource = Symbol();
/** Functions */
const _render = Symbol();

export class VirtualScrollerElement extends HTMLElement {
  constructor() {
    super();
    this[_scroller] = null;
    // Default create/update/recycleElement.
    this[_nodePool] = [];
    let childTemplate = null;
    this[_createElement] = () => {
      if (this[_nodePool] && this[_nodePool].length) {
        return this[_nodePool].pop();
      }
      if (!childTemplate) {
        const template = this.querySelector('template');
        childTemplate = template && template.content.firstElementChild ?
            template.content.firstElementChild :
            document.createElement('div');
      }
      return childTemplate.cloneNode(true);
    };
    this[_updateElement] = (element, item) => element.textContent =
        item.toString();
    this[_recycleElement] = (element) => this[_nodePool].push(element);

    this[_itemSource] = this[_rawItemSource] = null;
    this[_elementSource] = {};
  }

  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({mode: 'open'}).innerHTML = `
<style>
  :host {
    display: block;
    position: relative;
    contain: strict;
    height: 150px;
    overflow: auto;
  }
  :host([hidden]) {
    display: none;
  }
  ::slotted(*) {
    box-sizing: border-box;
  }
  :host([layout=vertical]) ::slotted(*) {
    width: 100%;
  }
  :host([layout=horizontal]) ::slotted(*) {
    height: 100%;
  }
</style>
<slot></slot>`;
      // Default layout.
      if (!this.layout) {
        this.layout = 'vertical';
      }
    }
    this[_render]();
  }

  static get observedAttributes() {
    return ['layout'];
  }

  attributeChangedCallback(name, oldVal, newVal) {
    this[_render]();
  }

  get layout() {
    return this.getAttribute('layout');
  }
  set layout(layout) {
    this.setAttribute('layout', layout);
  }

  get itemSource() {
    return this[_itemSource];
  }
  set itemSource(itemSource) {
    // No Change.
    if (this[_rawItemSource] === itemSource) {
      return;
    }
    this[_rawItemSource] = itemSource;
    this[_itemSource] = Array.isArray(itemSource) ?
        ItemSource.fromArray(itemSource) :
        itemSource;
    this[_render]();
  }

  get createElement() {
    return this[_createElement];
  }
  set createElement(fn) {
    // No change.
    if (fn === this[_createElement]) {
      return;
    }
    // Resets default recycling.
    if (this[_nodePool]) {
      this.recycleElement = null;
    }
    this[_createElement] = fn;
    // Invalidate wrapped function.
    this[_elementSource].createElement = null;
    this[_render]();
  }

  get updateElement() {
    return this[_updateElement];
  }
  set updateElement(fn) {
    // No change.
    if (fn === this[_updateElement]) {
      return;
    }
    this[_updateElement] = fn;
    // Invalidate wrapped function.
    this[_elementSource].updateElement = null;
    this[_render]();
  }

  get recycleElement() {
    return this[_recycleElement];
  }
  set recycleElement(fn) {
    // No change.
    if (fn === this[_recycleElement]) {
      return;
    }
    // Marks default recycling changed.
    this[_nodePool] = null;
    this[_recycleElement] = fn;
    // Invalidate wrapped function.
    this[_elementSource].recycleElement = null;
    this[_render]();
  }

  itemsChanged() {
    this[_render]();
    if (this[_scroller]) {
      this[_scroller].requestReset();
    }
  }

  [_render]() {
    if (!this.createElement) {
      return;
    }
    // Delay init to first connected as scroller needs to measure
    // sizes of container and children.
    if (!this[_scroller] && !this.isConnected) {
      return;
    }

    if (!this[_scroller]) {
      this[_scroller] =
          new VirtualScroller({container: this, scrollTarget: this});
    }
    const scroller = this[_scroller];

    const Layout = this.layout.endsWith('-grid') ? Layout1dGrid : Layout1d;
    const direction =
        this.layout.startsWith('horizontal') ? 'horizontal' : 'vertical';
    const layout = scroller.layout instanceof Layout &&
            scroller.layout.direction === direction ?
        scroller.layout :
        new Layout({direction});

    let {createElement, updateElement, recycleElement} = this[_elementSource];
    if (!createElement) {
      createElement = this[_elementSource].createElement = (index) =>
          this.createElement(this.itemSource[_item](index), index);
    }
    if (this.updateElement && !updateElement) {
      updateElement = this[_elementSource].updateElement = (element, index) =>
          this.updateElement(element, this.itemSource[_item](index), index);
    }
    if (this.recycleElement && !recycleElement) {
      recycleElement = this[_elementSource].recycleElement = (element, index) =>
          this.recycleElement(element, this.itemSource[_item](index), index);
    }

    const elementKey = this.itemSource ? this.itemSource[_key] : null;
    const totalItems = this.itemSource ? this.itemSource.length : 0;
    Object.assign(scroller, {
      layout,
      createElement,
      updateElement,
      recycleElement,
      elementKey,
      totalItems
    });
  }
}
customElements.define('virtual-scroller', VirtualScrollerElement);
