import { useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { captureForUndo, photosIn, restoreSnapshot } from './db';
import { deletePhotoFile } from './photos';
import { useData } from './store';

export function useUndoDelete() {
  const db = useSQLiteContext();
  const { bump, toast } = useData();
  return useCallback(
    async (what, id, message, run) => {
      const snap = await captureForUndo(db, what, id);
      await run();
      bump();
      let undone = false;
      toast(message, {
        label: 'Undo',
        onPress: async () => {
          if (undone) return;
          undone = true;
          await restoreSnapshot(db, snap);
          bump();
          toast('Balik na ulit ↩️');
        },
      });
      setTimeout(() => {
        if (!undone) photosIn(snap).forEach(deletePhotoFile);
      }, 8000);
    },
    [db, bump, toast]
  );
}
