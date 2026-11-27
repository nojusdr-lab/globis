import Storage from 'expo-sqlite/kv-store';
export const read = key => Storage.getItemSync(key);
export const write = (key,value) => Storage.setItemSync(key,value);
export const remove = key => Storage.removeItemSync(key);
