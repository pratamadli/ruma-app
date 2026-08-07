import { describe, expect, it } from 'vitest';
import { setActiveFamilyId, store } from './store';

describe('shell store', () => {
  it('stores active family selection as global client state', () => {
    store.dispatch(setActiveFamilyId('01FAMILYEXAMPLE000000001'));
    expect(store.getState().shell.activeFamilyId).toBe('01FAMILYEXAMPLE000000001');
  });
});
