import { h, ref, render, toRef, watch } from 'vue';

import { OpenPosition } from '@/interfaces';
import { unrefElement } from '@/utils/util';
import { MenuPlacement } from '@/constants';

import type { Component, Ref } from 'vue';
import type { ComponentRef, VueEmit } from '@/interfaces';
import type { AllPropsType } from '@/props';

/**
 * Extracted code from the main component, used for calculating the position of the menu
 */
export const usePosition = (
    menuRef: Ref<HTMLElement | null>,
    inputRef: ComponentRef,
    emit: VueEmit,
    props: AllPropsType,
) => {
    const menuRect = ref<DOMRect>({} as DOMRect);

    const menuStyle = ref<Partial<CSSStyleDeclaration>>({
        top: '0',
        left: '0',
    });
    const openOnTop = ref(false);
    const centered = toRef(props, 'teleportCenter');

    watch(centered, () => {
        setMenuPosition();
    });

    // Get correct offset of an element
    const getOffset = (el: HTMLElement): { top: number; left: number } => {
        if (props.teleport) {
            const rect = el.getBoundingClientRect();
            return {
                left: rect.left + window.scrollX,
                top: rect.top + window.scrollY,
            };
        }
        return { top: 0, left: 0 };
    };

    const setPositionRight = (left: number, width: number): void => {
        menuStyle.value.left = `${left + width - menuRect.value.width}px`;
    };

    const setPositionLeft = (left: number): void => {
        menuStyle.value.left = `${left}px`;
    };

    const setHorizontalPositioning = (left: number, width: number): void => {
        if (props.position === OpenPosition.left) {
            setPositionLeft(left);
        }

        if (props.position === OpenPosition.right) {
            setPositionRight(left, width);
        }

        if (props.position === OpenPosition.center) {
            menuStyle.value.left = `${left + width / 2 - menuRect.value.width / 2}px`;
        }
    };

    const getInputPositions = (inputEl: HTMLElement) => {
        const { width, height } = inputEl.getBoundingClientRect();
        const { top, left } = props.altPosition ? props.altPosition(inputEl) : getOffset(inputEl);
        return { top: +top, left: +left, width, height };
    };

    const teleportCenter = () => {
        menuStyle.value.left = `50%`;
        menuStyle.value.top = `50%`;
        menuStyle.value.transform = `translate(-50%, -50%)`;
        menuStyle.value.position = `fixed`;
        delete menuStyle.value.opacity;
    };

    const customAltPosition = () => {
        const el = unrefElement(inputRef);
        const { top, left, transform } = props.altPosition(el);
        menuStyle.value = { top: `${top}px`, left: `${left}px`, transform: transform || '' };
    };

    /**
     * Main call, when input is clicked, opens the menu on the first entry
     * Recalculate param is added when the position is recalculated on scroll or resize
     */
    const setMenuPosition = (recalculate = true): void => {
        if (!props.inline) {
            if (centered.value) return teleportCenter();

            if (props.altPosition !== null) return customAltPosition();

            if (recalculate) {
                if (menuRef.value) {
                    menuRect.value = menuRef.value.getBoundingClientRect();
                }
                emit('recalculate-position');
            }
            return calculateMenuPosition();
        }
    };

    const setLeftRightPosition = ({ inputEl, left, width }: { inputEl: HTMLElement; left: number; width: number }) => {
        if (window.screen.width > 768) {
            setHorizontalPositioning(left, width);
        }

        autoLeftRight(inputEl);
    };

    // Set menu position bellow input
    const setBottomPosition = (inputEl: HTMLElement) => {
        const { top: offset, left, height, width } = getInputPositions(inputEl);
        menuStyle.value.top = `${height + offset + +props.offset}px`;
        openOnTop.value = false;
        menuStyle.value.left = `${left + width / 2 - menuRect.value.width / 2}px`;
        setLeftRightPosition({ inputEl, left, width });
    };

    // Set menu position above the input
    const setTopPosition = (inputEl: HTMLElement) => {
        const { top: offset, left, width } = getInputPositions(inputEl);

        menuStyle.value.top = `${offset - +props.offset - menuRect.value.height}px`;
        openOnTop.value = true;
        setLeftRightPosition({ inputEl, left, width });
    };

    // Set auto left-right if the menu is out of the screen
    const autoLeftRight = (inputEl: HTMLElement) => {
        if (props.autoPosition) {
            const { left, width } = getInputPositions(inputEl);
            const { left: menuLeft, right: menuRight } = menuRect.value;
            if (menuLeft <= 0) return setPositionLeft(left);
            if (menuRight >= document.documentElement.clientWidth) return setPositionRight(left, width);
            return setHorizontalPositioning(left, width);
        }
    };

    const getMenuPlacement = (): MenuPlacement => {
        const inputEl = unrefElement(inputRef);
        if (inputEl) {
            const { height: menuHeight } = menuRect.value;
            const { top: inputTop, height: inputHeight } = inputEl.getBoundingClientRect();

            const fullHeight = window.innerHeight;
            const spaceBottom = fullHeight - inputTop - inputHeight;
            const spaceTop = inputTop;

            if (menuHeight <= spaceBottom) return MenuPlacement.bottom;
            // If there is not enough space at the bottom but there is on top, set position on top
            if (menuHeight > spaceBottom && menuHeight <= spaceTop) return MenuPlacement.top;
            // If we pass both check, it means there is not enough space above and bellow the input
            // Position where there is more space available
            if (spaceBottom >= spaceTop) return MenuPlacement.bottom;
            return MenuPlacement.top;
        }
        return MenuPlacement.bottom;
    };

    // If auto-position is enabled, perform calculation to fit menu on the screen
    const setAutoPosition = (inputEl: HTMLElement) => {
        const placement = getMenuPlacement();
        if (placement === MenuPlacement.bottom) return setBottomPosition(inputEl);
        return setTopPosition(inputEl);
    };

    // Parent function that will perform check on which calculation function to invoke
    const calculateMenuPosition = () => {
        const inputEl = unrefElement(inputRef);
        if (inputEl) {
            if (props.autoPosition) {
                return setAutoPosition(inputEl);
            }
            return setBottomPosition(inputEl);
        }
    };

    const isScrollable = function (el: HTMLElement | null) {
        if (el) {
            const hasScrollableContent = el.scrollHeight > el.clientHeight;

            const overflowYStyle = window.getComputedStyle(el).overflowY;
            const isOverflowHidden = overflowYStyle.indexOf('hidden') !== -1;

            return hasScrollableContent && !isOverflowHidden;
        }
        return true;
    };

    const getScrollableParent = function (el: HTMLElement | null): Window | HTMLElement {
        if (!el || el === document.body || el.nodeType === Node.DOCUMENT_FRAGMENT_NODE) return window;
        if (isScrollable(el)) return el;
        return getScrollableParent(el.parentNode as HTMLElement);
    };

    // Renders invisible menu on open to determine the menu dimensions
    const shadowRender = (DPMenu: Component, props: AllPropsType) => {
        const container = document.createElement('div');
        container.setAttribute('id', 'dp--temp-container');
        document.body.append(container);

        const renderContainer = document.getElementById('dp--temp-container') as HTMLElement;
        const el = h(DPMenu, {
            ...props,
            shadow: true,
            style: { opacity: 0, position: 'absolute' },
        });

        render(el, renderContainer);
        menuRect.value = el.el?.getBoundingClientRect();

        render(null, renderContainer);
        document.body.removeChild(renderContainer);
    };

    return {
        openOnTop,
        menuStyle,
        setMenuPosition,
        getScrollableParent,
        shadowRender,
    };
};
