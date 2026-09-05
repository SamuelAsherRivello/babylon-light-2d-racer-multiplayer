import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInputState } from '../src/input-state';

const setup = () => {
  const input = { throttle: false, brake: false, left: false, right: false };
  return { input, controls: createInputState(input) };
};
test('touch steering and gas work together; releasing one pointer preserves the other', () => {
  const { input, controls } = setup();
  controls.pointer(1, 'throttle'); controls.pointer(2, 'left');
  assert.equal(input.throttle && input.left, true);
  controls.release(2);
  assert.equal(input.throttle, true); assert.equal(input.left, false);
});
test('keyboard and touch are independent redundant sources', () => {
  const { input, controls } = setup();
  controls.keyboard('throttle', true); controls.pointer(1, 'throttle');
  controls.release(1); assert.equal(input.throttle, true);
  controls.pointer(1, 'throttle'); controls.keyboard('throttle', false);
  assert.equal(input.throttle, true);
  controls.release(1); assert.equal(input.throttle, false);
});
test('cancelled pointers and focus resets never leave held controls', () => {
  const { input, controls } = setup();
  controls.pointer(1, 'brake'); controls.pointer(2, 'right'); controls.keyboard('left', true);
  controls.release(1); assert.equal(input.brake, false);
  controls.clear(); assert.deepEqual(input, { throttle: false, brake: false, left: false, right: false });
});
