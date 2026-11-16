export const read = key => globalThis.localStorage.getItem(key);
export const write = (key,value) => globalThis.localStorage.setItem(key,value);
