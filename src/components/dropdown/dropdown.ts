import { classMap, html, Shoemaker } from '@shoelace-style/shoemaker';
import styles from 'sass:./dropdown.scss';
import { SlMenu, SlMenuItem } from '../../shoelace';
import { scrollIntoView } from '../../internal/scroll';
import { getNearestTabbableElement } from '../../internal/tabbable';
import Popover from '../../internal/popover';

let id = 0;

/**
 * @since 2.0
 * @status stable
 *
 * @slot trigger - The dropdown's trigger, usually a `<sl-button>` element.
 * @slot - The dropdown's content.
 *
 * @part base - The component's base wrapper.
 * @part trigger - The container that wraps the trigger.
 * @part panel - The panel that gets shown when the dropdown is open.
 *
 * @emit sl-show - Emitted when the dropdown opens. Calling `event.preventDefault()` will prevent it from being opened.
 * @emit sl-after-show - Emitted after the dropdown opens and all transitions are complete.
 * @emit sl-hide - Emitted when the dropdown closes. Calling `event.preventDefault()` will prevent it from being closed.
 * @emit sl-after-hide - Emitted after the dropdown closes and all transitions are complete.
 */
export default class SlDropdown extends Shoemaker {
  static tag = 'sl-dropdown';
  static props = ['open', 'placement', 'closeOnSelect', 'containingElement', 'distance', 'skidding', 'hoist'];
  static reflect = ['open'];
  static styles = styles;

  private componentId = `dropdown-${++id}`;
  private isVisible = false;
  private panel: HTMLElement;
  private positioner: HTMLElement;
  private popover: Popover;
  private trigger: HTMLElement;

  /** Indicates whether or not the dropdown is open. You can use this in lieu of the show/hide methods. */
  open = false;

  /**
   * The preferred placement of the dropdown panel. Note that the actual placement may vary as needed to keep the panel
   * inside of the viewport.
   */
  placement:
    | 'top'
    | 'top-start'
    | 'top-end'
    | 'bottom'
    | 'bottom-start'
    | 'bottom-end'
    | 'right'
    | 'right-start'
    | 'right-end'
    | 'left'
    | 'left-start'
    | 'left-end' = 'bottom-start';

  /** Determines whether the dropdown should hide when a menu item is selected. */
  closeOnSelect = true;

  /** The dropdown will close when the user interacts outside of this element (e.g. clicking). */
  containingElement: HTMLElement;

  /** The distance in pixels from which to offset the panel away from its trigger. */
  distance = 2;

  /** The distance in pixels from which to offset the panel along its trigger. */
  skidding = 0;

  /**
   * Enable this option to prevent the panel from being clipped when the component is placed inside a container with
   * `overflow: auto|scroll`.
   */
  hoist = false;

  handlePopoverOptionsChange() {
    this.popover.setOptions({
      strategy: this.hoist ? 'fixed' : 'absolute',
      placement: this.placement,
      distance: this.distance,
      skidding: this.skidding
    });
  }

  onConnect() {
    this.handleMenuItemActivate = this.handleMenuItemActivate.bind(this);
    this.handlePanelSelect = this.handlePanelSelect.bind(this);
    this.handleDocumentKeyDown = this.handleDocumentKeyDown.bind(this);
    this.handleDocumentMouseDown = this.handleDocumentMouseDown.bind(this);

    if (!this.containingElement) {
      this.containingElement = this;
    }
  }

  onReady() {
    this.popover = new Popover(this.trigger, this.positioner, {
      strategy: this.hoist ? 'fixed' : 'absolute',
      placement: this.placement,
      distance: this.distance,
      skidding: this.skidding,
      transitionElement: this.panel,
      onAfterHide: () => this.emit('sl-after-hide'),
      onAfterShow: () => this.emit('sl-after-show'),
      onTransitionEnd: () => {
        if (!this.open) {
          this.panel.scrollTop = 0;
        }
      }
    });

    // Show on init if open
    if (this.open) {
      this.show();
    }
  }

  onDisconnect() {
    this.hide();
    this.popover.destroy();
  }

  focusOnTrigger() {
    const slot = this.trigger.querySelector('slot')!;
    const trigger = slot.assignedElements({ flatten: true })[0] as any;
    if (trigger) {
      if (typeof trigger.setFocus === 'function') {
        trigger.setFocus();
      } else if (typeof trigger.focus === 'function') {
        trigger.focus();
      }
    }
  }

  getMenu() {
    const slot = this.panel.querySelector('slot')!;
    return slot.assignedElements({ flatten: true }).filter(el => el.tagName.toLowerCase() === 'sl-menu')[0] as SlMenu;
  }

  handleDocumentKeyDown(event: KeyboardEvent) {
    // Close when escape is pressed
    if (event.key === 'Escape') {
      this.hide();
      this.focusOnTrigger();
      return;
    }

    // Handle tabbing
    if (event.key === 'Tab') {
      // Tabbing within an open menu should close the dropdown and refocus the trigger
      if (this.open && document.activeElement?.tagName.toLowerCase() === 'sl-menu-item') {
        event.preventDefault();
        this.hide();
        this.focusOnTrigger();
        return;
      }

      // Tabbing outside of the containing element closes the panel
      //
      // If the dropdown is used within a shadow DOM, we need to obtain the activeElement within that shadowRoot,
      // otherwise `document.activeElement` will only return the name of the parent shadow DOM element.
      setTimeout(() => {
        const activeElement =
          this.containingElement.getRootNode() instanceof ShadowRoot
            ? document.activeElement?.shadowRoot?.activeElement
            : document.activeElement;

        if (activeElement?.closest(this.containingElement.tagName.toLowerCase()) !== this.containingElement) {
          this.hide();
          return;
        }
      });
    }
  }

  handleDocumentMouseDown(event: MouseEvent) {
    // Close when clicking outside of the containing element
    const path = event.composedPath() as Array<EventTarget>;
    if (!path.includes(this.containingElement)) {
      this.hide();
      return;
    }
  }

  handleMenuItemActivate(event: CustomEvent) {
    const item = event.target as SlMenuItem;
    scrollIntoView(item, this.panel);
  }

  handlePanelSelect(event: CustomEvent) {
    const target = event.target as HTMLElement;

    // Hide the dropdown when a menu item is selected
    if (this.closeOnSelect && target.tagName.toLowerCase() === 'sl-menu') {
      this.hide();
      this.focusOnTrigger();
    }
  }

  handleTriggerClick() {
    this.open ? this.hide() : this.show();
  }

  handleTriggerKeyDown(event: KeyboardEvent) {
    const menu = this.getMenu();
    const menuItems = menu ? ([...menu.querySelectorAll('sl-menu-item')] as SlMenuItem[]) : [];
    const firstMenuItem = menuItems[0];
    const lastMenuItem = menuItems[menuItems.length - 1];

    // Close when escape or tab is pressed
    if (event.key === 'Escape') {
      this.focusOnTrigger();
      this.hide();
      return;
    }

    // When spacebar/enter is pressed, show the panel but don't focus on the menu. This let's the user press the same
    // key again to hide the menu in case they don't want to make a selection.
    if ([' ', 'Enter'].includes(event.key)) {
      event.preventDefault();
      this.open ? this.hide() : this.show();
      return;
    }

    // When up/down is pressed, we make the assumption that the user is familiar with the menu and plans to make a
    // selection. Rather than toggle the panel, we focus on the menu (if one exists) and activate the first item for
    // faster navigation.
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();

      // Show the menu if it's not already open
      if (!this.open) {
        this.show();
      }

      // Focus on a menu item
      if (event.key === 'ArrowDown' && firstMenuItem) {
        firstMenuItem.setFocus();
        return;
      }

      if (event.key === 'ArrowUp' && lastMenuItem) {
        lastMenuItem.setFocus();
        return;
      }
    }

    // Other keys bring focus to the menu and initiate type-to-select behavior
    const ignoredKeys = ['Tab', 'Shift', 'Meta', 'Ctrl', 'Alt'];
    if (this.open && menu && !ignoredKeys.includes(event.key)) {
      menu.typeToSelect(event.key);
      return;
    }
  }

  handleTriggerKeyUp(event: KeyboardEvent) {
    // Prevent space from triggering a click event in Firefox
    if (event.key === ' ') {
      event.preventDefault();
    }
  }

  handleTriggerSlotChange() {
    this.updateAccessibleTrigger();
  }

  //
  // Slotted triggers can be arbitrary content, but we need to link them to the dropdown panel with `aria-haspopup` and
  // `aria-expanded`. These must be applied to the "accessible trigger" (the tabbable portion of the trigger element
  // that gets slotted in) so screen readers will understand them. The accessible trigger could be the slotted element,
  // a child of the slotted element, or an element in the slotted element's shadow root.
  //
  // For example, the accessible trigger of an <sl-button> is a <button> located inside its shadow root.
  //
  // To determine this, we assume the first tabbable element in the trigger slot is the "accessible trigger."
  //
  updateAccessibleTrigger() {
    const slot = this.trigger.querySelector('slot') as HTMLSlotElement;
    const assignedElements = slot.assignedElements({ flatten: true }) as HTMLElement[];
    const accessibleTrigger = assignedElements.map(getNearestTabbableElement)[0];

    if (accessibleTrigger) {
      accessibleTrigger.setAttribute('aria-haspopup', 'true');
      accessibleTrigger.setAttribute('aria-expanded', this.open ? 'true' : 'false');
    }
  }

  /** Shows the dropdown panel */
  show() {
    // Prevent subsequent calls to the method, whether manually or triggered by the `open` watcher
    if (this.isVisible) {
      return;
    }

    const slShow = this.emit('sl-show');
    if (slShow.defaultPrevented) {
      this.open = false;
      return;
    }

    this.panel.addEventListener('sl-activate', this.handleMenuItemActivate);
    this.panel.addEventListener('sl-select', this.handlePanelSelect);
    document.addEventListener('keydown', this.handleDocumentKeyDown);
    document.addEventListener('mousedown', this.handleDocumentMouseDown);

    this.isVisible = true;
    this.open = true;
    this.popover.show();
  }

  /** Hides the dropdown panel */
  hide() {
    // Prevent subsequent calls to the method, whether manually or triggered by the `open` watcher
    if (!this.isVisible) {
      return;
    }

    const slHide = this.emit('sl-hide');
    if (slHide.defaultPrevented) {
      this.open = true;
      return;
    }

    this.panel.removeEventListener('sl-activate', this.handleMenuItemActivate);
    this.panel.removeEventListener('sl-select', this.handlePanelSelect);
    document.addEventListener('keydown', this.handleDocumentKeyDown);
    document.removeEventListener('mousedown', this.handleDocumentMouseDown);

    this.isVisible = false;
    this.open = false;
    this.popover.hide();
  }

  /**
   * Instructs the dropdown menu to reposition. Useful when the position or size of the trigger changes when the menu
   * is activated.
   */
  reposition() {
    if (!this.open) {
      return;
    }

    this.popover.reposition();
  }

  watchDistance() {
    this.handlePopoverOptionsChange();
  }
  watchHoist() {
    this.handlePopoverOptionsChange();
  }

  watchOpen() {
    this.open ? this.show() : this.hide();
    this.updateAccessibleTrigger();
  }

  watchPlacement() {
    this.handlePopoverOptionsChange();
  }

  watchSkidding() {
    this.handlePopoverOptionsChange();
  }

  render() {
    return html`
      <div
        part="base"
        id=${this.componentId}
        class=${classMap({
          dropdown: true,
          'dropdown--open': this.open
        })}
      >
        <span
          part="trigger"
          class="dropdown__trigger"
          ref=${(el: HTMLElement) => (this.trigger = el)}
          onclick=${this.handleTriggerClick.bind(this)}
          onkeydown=${this.handleTriggerKeyDown.bind(this)}
          onkeyup=${this.handleTriggerKeyUp.bind(this)}
        >
          <slot name="trigger" onslotchange=${this.handleTriggerSlotChange.bind(this)} />
        </span>

        <!-- Position the panel with a wrapper since the popover makes use of translate. This let's us add transitions
        on the panel without interfering with the position. -->
        <div ref=${(el: HTMLElement) => (this.positioner = el)} class="dropdown__positioner">
          <div
            ref=${(el: HTMLElement) => (this.panel = el)}
            part="panel"
            class="dropdown__panel"
            role="menu"
            aria-hidden=${this.open ? 'false' : 'true'}
            aria-labelledby=${this.componentId}
          >
            <slot />
          </div>
        </div>
      </div>
    `;
  }
}