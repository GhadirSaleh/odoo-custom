/** @odoo-module **/

/**
 * Deselect Order Line on Background Click
 * ========================================
 * Pattern: Raw DOM event listener (no Owl patch)
 *
 * Problem: In Odoo POS, clicking on empty space in the product screen does
 * not deselect the currently selected order line. The line stays highlighted
 * even though the user clicked away.
 *
 * Solution: Attach a global click listener (capture phase) that checks if
 * the click target is outside any interactive POS element. If so, clear the
 * selected_orderline_uuid to deselect the line.
 *
 * Gotchas:
 * - Uses polling to wait for window.posmodel to be ready (Odoo loads POS
 *   asynchronously). The `attached` flag prevents duplicate listeners.
 * - Skips on small screens (mobile) where the layout differs.
 * - The interactiveContainers list must be kept in sync with POS DOM structure.
 */

(function () {
    let attached = false;

    function tryAttach() {
        if (attached) return;
        if (!window.posmodel) {
            setTimeout(tryAttach, 500);
            return;
        }

        document.addEventListener("click", (ev) => {
            const pos = window.posmodel;
            if (!pos) return;

            // Skip on mobile/small screens — layout differs
            const isSmall = pos.ui?.isSmall;
            if (isSmall) return;

            const order = pos.getOrder();
            if (!order) return;

            // If click is inside an interactive element, don't deselect
            const interactiveContainers = [
                ".order-container", ".orderline",
                ".numpad", ".numpad-button",
                ".control-buttons", ".subpads", ".pads",
                ".actionpad",
            ];
            const isInsideInteractive = interactiveContainers.some(sel => ev.target.closest(sel));
            if (!isInsideInteractive) {
                order.uiState.selected_orderline_uuid = null;
            }
        }, true);

        attached = true;
    }

    setTimeout(tryAttach, 1000);
})();
