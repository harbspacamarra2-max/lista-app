import { useState } from 'react';
import { Pressable } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { listPeople, saveGroup } from '../lib/db';
import { useQuery } from '../lib/store';
import { useTheme } from '../lib/theme';
import { Button, Chip, Field, Row, Sheet, Txt, tap } from './ui';
import { EmojiChooser } from './emoji';

export const GROUP_EMOJIS = ['👯', '🍻', '🎓', '🏀', '🎮', '💼', '🏠', '✈️', '🎤', '⛪', '🍜', '💅'];

export function GroupSheet({ visible, onClose, initial, onSaved }) {
  const theme = useTheme();
  const db = useSQLiteContext();
  const [name, setName] = useState(initial?.name || '');
  const [emoji, setEmoji] = useState(initial?.emoji || '👯');
  const [members, setMembers] = useState(initial?.members?.map((m) => m.name) || []);
  const [newName, setNewName] = useState('');
  const { data: people } = useQuery((d) => listPeople(d), [visible]);

  const add = (n) => {
    const clean = n.trim();
    if (!clean || members.some((m) => m.toLowerCase() === clean.toLowerCase())) return;
    tap();
    setMembers([...members, clean]);
    setNewName('');
  };

  const save = async () => {
    if (!name.trim() || !members.length) return;
    const id = await saveGroup(db, { id: initial?.id, name, emoji, memberNames: members });
    tap('success');
    onSaved(id);
  };

  const suggestions = (people || [])
    .filter((p) => !members.some((m) => m.toLowerCase() === p.name.toLowerCase()))
    .filter((p) => !newName.trim() || p.name.toLowerCase().includes(newName.trim().toLowerCase()))
    .slice(0, 10);

  return (
    <Sheet visible={visible} onClose={onClose} title={initial ? 'Edit barkada' : 'New barkada 👯'}>
      <Field placeholder="Name, e.g. Block mates, Tropa, Fam" value={name} onChangeText={setName} maxLength={28} />
      <EmojiChooser choices={GROUP_EMOJIS} value={emoji} onChange={setEmoji} style={{ marginTop: 12 }} />
      <Txt w={800} size={14} color="sub" style={{ marginTop: 18, marginBottom: 8 }}>Members</Txt>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {members.map((m) => (
          <Chip key={m} label={`${m}  ✕`} emoji="👤" selected tintName="lilac" small onPress={() => setMembers(members.filter((x) => x !== m))} />
        ))}
      </Row>
      <Field placeholder="Add a name" value={newName} onChangeText={setNewName} onSubmitEditing={() => add(newName)} returnKeyType="done" style={{ marginTop: 10 }} />
      {suggestions.length ? (
        <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 10 }}>
          {suggestions.map((p) => (
            <Chip key={p.id} label={p.name} emoji={p.emoji} small onPress={() => add(p.name)} />
          ))}
        </Row>
      ) : null}
      <Button title={initial ? 'Save' : 'Create barkada'} style={{ marginTop: 20 }} disabled={!name.trim() || !members.length} onPress={save} />
    </Sheet>
  );
}
