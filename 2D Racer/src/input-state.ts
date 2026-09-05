import type { Input } from './types';

export function createInputState(input: Input) {
  const keyboard = new Set<keyof Input>();
  const pointers = new Map<number, keyof Input>();
  const sync = () => {
    for (const action of ['throttle', 'brake', 'left', 'right'] as const) {
      input[action] = keyboard.has(action) || [...pointers.values()].includes(action);
    }
  };
  return {
    keyboard(action: keyof Input, held: boolean) {
      if (held) keyboard.add(action); else keyboard.delete(action);
      sync();
    },
    pointer(id: number, action: keyof Input) { pointers.set(id, action); sync(); },
    release(id: number) { pointers.delete(id); sync(); },
    clear() { keyboard.clear(); pointers.clear(); sync(); },
  };
}
