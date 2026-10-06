const KEY = 'tabgu-king-save-v1';

// localStorage 는 막혀 있을 수 있어 항상 try/catch (주입 가능: 테스트)
export function createStore(storage = globalThis.localStorage) {
  return {
    load() {
      try {
        const raw = storage?.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    },
    save(state) {
      try { storage?.setItem(KEY, JSON.stringify(state)); return true; } catch { return false; }
    },
    clear() {
      try { storage?.removeItem(KEY); } catch { /* 무시 */ }
    },
  };
}
