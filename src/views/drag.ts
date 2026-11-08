// Moving an item of a list by its handle, with a mouse or a finger: the item
// follows the pointer and lands where it is let go. Lists mark themselves with
// `data-drag-list` and their items with `data-drag-item`.

export function startDrag(event: PointerEvent, onMove: (from: number, to: number) => void) {
  const handle = event.currentTarget as HTMLElement;
  const item = handle.closest<HTMLElement>('[data-drag-item]');
  const list = item?.parentElement?.closest<HTMLElement>('[data-drag-list]') ?? item?.parentElement;
  if (!item || !list) return;

  event.preventDefault();
  const items = () => Array.from(list.querySelectorAll<HTMLElement>(':scope > [data-drag-item]'));
  const from = items().indexOf(item);
  const startY = event.clientY;
  let to = from;

  handle.setPointerCapture(event.pointerId);
  item.classList.add('pf-dragging');

  const move = (moveEvent: PointerEvent) => {
    item.style.transform = `translateY(${moveEvent.clientY - startY}px)`;
    const others = items();
    to = others.findIndex((other) => {
      const box = other.getBoundingClientRect();
      return moveEvent.clientY < box.top + box.height / 2;
    });
    if (to < 0) to = others.length - 1;
    else if (to > from) to -= 1;
    others.forEach((other, index) => other.classList.toggle('pf-drop-before', index === (to >= from ? to + 1 : to) && other !== item));
  };

  const end = () => {
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', end);
    handle.removeEventListener('pointercancel', end);
    item.classList.remove('pf-dragging');
    item.style.transform = '';
    items().forEach((other) => other.classList.remove('pf-drop-before'));
    if (to !== from && to >= 0) onMove(from, to);
  };

  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}
