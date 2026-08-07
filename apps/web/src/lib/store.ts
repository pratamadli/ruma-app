import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';

const STORAGE_KEY = 'ruma.activeFamilyId';

function readStoredFamilyId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

type ShellState = {
  activeFamilyId: string | null;
};

const initialState: ShellState = {
  activeFamilyId: null,
};

const shellSlice = createSlice({
  name: 'shell',
  initialState,
  reducers: {
    hydrateActiveFamilyId(state) {
      state.activeFamilyId = readStoredFamilyId();
    },
    setActiveFamilyId(state, action: PayloadAction<string | null>) {
      state.activeFamilyId = action.payload;
      if (typeof window !== 'undefined') {
        if (action.payload) {
          window.localStorage.setItem(STORAGE_KEY, action.payload);
        } else {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
    },
  },
});

export const { setActiveFamilyId, hydrateActiveFamilyId } = shellSlice.actions;

export const store = configureStore({
  reducer: {
    shell: shellSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
