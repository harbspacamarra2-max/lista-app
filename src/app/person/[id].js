import { useState } from 'react';
import { Image, Pressable, Share, View } from 'react-native';
import { choosePhoto } from '../../lib/photos';
import { Alert } from '../../lib/alert';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import {
  addPayment,
  deletePayment,
  settleNet,
  deletePerson,
  getPerson,
  listDebts,
  listPaymentsForPerson,
  renamePerson,
  setDebtReminder,
} from '../../lib/db';
import { centavosToInput, cleanAmountInput, dueLabel, peso, prettyDate, shortDate, toCentavos, today } from '../../lib/format';
import { cancelReminder } from '../../lib/notify';
import { useUndoDelete } from '../../lib/undo';
import { useData, useQuery } from '../../lib/store';
import { fill, pick } from '../../lib/quips';
import { radius, useTheme } from '../../lib/theme';
import { Avatar, Badge, Button, Card, Field, IconButton, ProgressBar, Row, Screen, SectionHeader, Sheet, Txt, tap } from '../../components/ui';
import { DebtStatus, WalletPicker } from '../../components/bits';
import { Celebrate } from '../../components/celebrate';
import { goBack } from '../../lib/nav';

export default function PersonScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const { bump } = useData();
  const undoDelete = useUndoDelete();
  const { id } = useLocalSearchParams();
  const personId = Number(id);
  const [payFor, setPayFor] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payPhoto, setPayPhoto] = useState(null);
  const [payWallet, setPayWallet] = useState('cash');
  const [viewPhoto, setViewPhoto] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [showPaid, setShowPaid] = useState(false);
  const [party, setParty] = useState(null);

  const { data } = useQuery(async (d) => {
    const [person, debts, payments] = await Promise.all([
      getPerson(d, personId),
      listDebts(d, { personId }),
      listPaymentsForPerson(d, personId),
    ]);
    return { person, debts, payments };
  }, [personId]);

  if (data && !data.person) {
    return (
      <Screen>
        <IconButton icon="chevron-back" onPress={() => goBack()} label="Back" />
        <Txt w={800} size={18} style={{ marginTop: 20 }}>This person was removed.</Txt>
      </Screen>
    );
  }

  const person = data?.person;
  const debts = data?.debts || [];
  const payments = data?.payments || [];
  const owe = debts.filter((d) => d.direction === 'owe').reduce((s, d) => s + d.remaining, 0);
  const owed = debts.filter((d) => d.direction === 'owed').reduce((s, d) => s + d.remaining, 0);
  const net = owed - owe;
  const open = debts.filter((d) => d.remaining > 0);
  const paid = debts.filter((d) => d.remaining === 0);

  const headline =
    net > 0
      ? { text: `${person?.name} owes you`, amount: net, tint: 'mint', ink: 'mintInk', emoji: '🤑' }
      : net < 0
        ? { text: `You owe ${person?.name}`, amount: -net, tint: 'peach', ink: 'peachInk', emoji: '🫣' }
        : { text: 'All settled! Friends pa rin 🫶', amount: 0, tint: 'lilac', ink: 'lilacInk', emoji: '🤝' };

  const openPay = (debt) => {
    setPayFor(debt);
    setPayPhoto(null);
    setPayWallet(debt.method || 'cash');
    setPayAmount(centavosToInput(debt.plan ? debt.plan.nextAmount : debt.remaining));
  };

  const quits = () => {
    const cancel = Math.min(owe, owed);
    Alert.alert(
      'Quits na? 🤝',
      `You owe ${person.name} ${peso(owe)} and they owe you ${peso(owed)}. We’ll cancel out ${peso(cancel)} on both sides, so only ${peso(Math.abs(net))} is left${net > 0 ? ` for ${person.name} to pay` : net < 0 ? ' for you to pay' : ''}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Quits na',
          onPress: async () => {
            await settleNet(db, personId);
            tap('success');
            bump();
            if (net === 0) setParty({ title: 'quits na!', subtitle: `You and ${person.name} are even 🫶` });
          },
        },
      ]
    );
  };

  const savePayment = async () => {
    const cents = Math.min(toCentavos(payAmount), payFor.remaining);
    if (cents <= 0) return;
    await addPayment(db, { debtId: payFor.id, amount: cents, date: today(), photo: payPhoto, method: payWallet === 'none' ? null : payWallet });
    if (cents >= payFor.remaining && payFor.reminder_id) {
      await cancelReminder(payFor.reminder_id);
      await setDebtReminder(db, payFor.id, null);
    }
    tap('success');
    const settled = cents >= payFor.remaining;
    setPayFor(null);
    bump();
    if (settled) {
      setTimeout(() => setParty({ title: pick(['settled na!', 'bayad na!', 'wala nang utang!'], 'partyTitle'), subtitle: fill(pick(payFor.direction === 'owe' ? 'paidThem' : 'paidMe'), { name: person.name }) }), 350);
    }
  };

  const remind = async () => {
    const lines = open
      .filter((d) => d.direction === 'owed')
      .map((d) => `• ${d.reason || 'Utang'} (${shortDate(d.date)}): ${peso(d.remaining)}`);
    const msg =
      `${fill(pick('remindIntro'), { name: person.name })}\n\n${lines.join('\n')}\n\n` +
      `Total: ${peso(owed)}\n\n${pick('remindOutro')}`;
    try {
      await Share.share({ message: msg });
    } catch {
    }
  };

  const removePerson = () => {
    Alert.alert(`Delete ${person.name}?`, 'All their utang records and payments will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          for (const d of debts) if (d.reminder_id) await cancelReminder(d.reminder_id);
          await undoDelete('person', personId, `${person.name} deleted 🗑️`, () => deletePerson(db, personId));
          goBack();
        },
      },
    ]);
  };

  const removePayment = (p) => {
    Alert.alert('Remove this payment?', `${peso(p.amount)} on ${prettyDate(p.date)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => undoDelete('payment', p.id, `Payment removed · ${peso(p.amount)}`, () => deletePayment(db, p.id)),
      },
    ]);
  };

  if (!person) return <Screen><View /></Screen>;

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <IconButton icon="chevron-back" onPress={() => goBack()} label="Back" />
        <Row gap={8}>
          <IconButton
            icon="create-outline"
            onPress={() => {
              setNewName(person.name);
              setRenaming(true);
            }}
            label="Rename"
          />
          <IconButton icon="trash-outline" tint="redTint" color="red" onPress={removePerson} label="Delete person" />
        </Row>
      </Row>

      <View style={{ alignItems: 'center', marginTop: 10 }}>
        <Avatar emoji={person.emoji} tintName={headline.tint === 'peach' ? 'peach' : headline.tint === 'mint' ? 'mint' : 'lilac'} size={84} />
        <Txt w={800} size={26} style={{ marginTop: 12 }}>{person.name}</Txt>
      </View>

      <Card tint={headline.tint} style={{ marginTop: 18, alignItems: 'center' }}>
        <Txt w={700} size={14} color={theme[headline.ink]}>{headline.emoji}  {headline.text}</Txt>
        {headline.amount ? (
          <Txt w={800} size={36} color={theme[headline.ink]} style={{ marginTop: 4 }}>{peso(headline.amount)}</Txt>
        ) : null}
        {owe && owed ? (
          <Txt w={600} size={12.5} color={theme[headline.ink]} style={{ marginTop: 6, opacity: 0.85 }}>
            They owe {peso(owed)} · You owe {peso(owe)}
          </Txt>
        ) : null}
      </Card>

      <Row gap={10} style={{ marginTop: 12 }}>
        <Button
          title="Add utang"
          icon="add"
          variant="soft"
          size="md"
          style={{ flex: 1 }}
          onPress={() => router.push(`/add?type=utang&personId=${personId}&direction=${net < 0 ? 'owe' : 'owed'}`)}
        />
        {owed > 0 ? (
          <Button title="Remind" icon="paper-plane" variant="dark" size="md" style={{ flex: 1 }} onPress={remind} />
        ) : null}
      </Row>
      {owe > 0 && owed > 0 ? (
        <Button title="Quits na: cancel out both sides 🤝" variant="ghost" size="md" style={{ marginTop: 10 }} onPress={quits} />
      ) : null}

      <SectionHeader title={open.length ? 'Open' : 'Nothing open'} />
      <View style={{ gap: 10 }}>
        {open.map((d) => (
          <DebtCard key={d.id} d={d} payments={payments.filter((p) => p.debt_id === d.id)} onPay={() => openPay(d)} onUndo={removePayment} onPhoto={setViewPhoto} />
        ))}
      </View>

      {paid.length ? (
        <>
          <Pressable onPress={() => setShowPaid((s) => !s)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 24, marginBottom: 10 }}>
            <Txt w={800} size={15} color="sub">Paid history ({paid.length})</Txt>
            <Ionicons name={showPaid ? 'chevron-up' : 'chevron-down'} size={16} color={theme.sub} />
          </Pressable>
          {showPaid ? (
            <View style={{ gap: 10 }}>
              {paid.map((d) => (
                <DebtCard key={d.id} d={d} payments={payments.filter((p) => p.debt_id === d.id)} onUndo={removePayment} onPhoto={setViewPhoto} />
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      <Sheet visible={!!payFor} onClose={() => setPayFor(null)} title="Record payment">
        {payFor ? (
          <View>
            <Txt size={14} color="sub">
              {payFor.direction === 'owe' ? `You paid ${person.name}` : `${person.name} paid you`} · {payFor.reason || 'Utang'}
            </Txt>
            <Txt w={700} size={13} color="sub" style={{ marginTop: 2 }}>Remaining: {peso(payFor.remaining)}</Txt>
            <Field
              value={payAmount}
              onChangeText={(t) => setPayAmount(cleanAmountInput(t))}
              keyboardType="decimal-pad"
              placeholder="0"
              style={{ marginTop: 16 }}
              inputStyle={{ fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold' }}
              right={<Txt w={800} size={20} color="faint">₱</Txt>}
              autoFocus
            />
            <Row gap={8} style={{ marginTop: 12, flexWrap: 'wrap' }}>
              {[0.25, 0.5, 1].map((f) => (
                <Pressable
                  key={f}
                  onPress={() => {
                    tap();
                    setPayAmount(centavosToInput(Math.round(payFor.remaining * f)));
                  }}
                  style={{ paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: theme.cardAlt, justifyContent: 'center' }}
                >
                  <Txt w={700} size={13}>{f === 1 ? 'Full amount' : `${f * 100}%`}</Txt>
                </Pressable>
              ))}
            </Row>
            <Txt w={800} size={13} color="sub" style={{ marginTop: 16, marginBottom: 8 }}>
              {payFor.direction === 'owe' ? 'Paid from' : 'Received in'}
            </Txt>
            <WalletPicker value={payWallet} onChange={setPayWallet} />
            {payPhoto ? (
              <View style={{ marginTop: 14 }}>
                <Image source={{ uri: payPhoto }} style={{ width: '100%', height: 180, borderRadius: radius.lg, backgroundColor: theme.cardAlt }} resizeMode="cover" />
                <Pressable
                  onPress={() => setPayPhoto(null)}
                  style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 16, paddingHorizontal: 12, height: 30, justifyContent: 'center' }}
                >
                  <Txt w={700} size={12.5} color="#FFFFFF">Remove ✕</Txt>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={async () => {
                  const uri = await choosePhoto();
                  if (uri) setPayPhoto(uri);
                }}
                style={{ marginTop: 14, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.border, paddingVertical: 14, alignItems: 'center' }}
              >
                <Txt w={700} size={13.5} color="sub">📸 Add proof (GCash screenshot, resibo)</Txt>
              </Pressable>
            )}
            <Button title="Save payment" icon="checkmark-circle" onPress={savePayment} style={{ marginTop: 20 }} disabled={toCentavos(payAmount) <= 0} />
          </View>
        ) : null}
      </Sheet>

      <Celebrate visible={!!party} title={party?.title} subtitle={party?.subtitle} onDone={() => setParty(null)} />

      <Sheet visible={!!viewPhoto} onClose={() => setViewPhoto(null)} title="Proof of payment 📎">
        {viewPhoto ? (
          <Image source={{ uri: viewPhoto }} style={{ width: '100%', height: 460, borderRadius: radius.lg, backgroundColor: theme.cardAlt }} resizeMode="contain" />
        ) : null}
      </Sheet>

      <Sheet visible={renaming} onClose={() => setRenaming(false)} title="Rename">
        <Field value={newName} onChangeText={setNewName} autoFocus autoCapitalize="words" />
        <Button
          title="Save"
          style={{ marginTop: 16 }}
          disabled={!newName.trim()}
          onPress={async () => {
            await renamePerson(db, personId, newName);
            setRenaming(false);
            bump();
          }}
        />
      </Sheet>
    </Screen>
  );
}

function DebtCard({ d, payments, onPay, onUndo, onPhoto }) {
  const theme = useTheme();
  const due = d.remaining > 0 ? dueLabel(d.due_date) : null;
  const pct = d.amount ? (d.amount - d.remaining) / d.amount : 0;
  const isOwe = d.direction === 'owe';
  return (
    <Card padding={16}>
      <Row style={{ justifyContent: 'space-between' }} align="flex-start">
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Txt w={800} size={16} numberOfLines={2}>{d.reason || 'Utang'}</Txt>
          <Txt size={12.5} color="sub" style={{ marginTop: 3 }}>
            {isOwe ? 'You borrowed' : 'They borrowed'} · {prettyDate(d.date)}
          </Txt>
        </View>
        <Pressable
          onPress={() => {
            tap();
            router.push(`/add?debtId=${d.id}`);
          }}
          hitSlop={8}
        >
          <Ionicons name="ellipsis-horizontal-circle" size={26} color={theme.faint} />
        </Pressable>
      </Row>

      <Row style={{ marginTop: 14, justifyContent: 'space-between' }} align="flex-end">
        <View>
          <Txt w={600} size={12} color="sub">{d.remaining > 0 ? 'Remaining' : 'Total'}</Txt>
          <Txt w={800} size={22} color={isOwe ? theme.peachInk : theme.mintInk}>{peso(d.remaining > 0 ? d.remaining : d.amount)}</Txt>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <DebtStatus debt={d} />
          {d.plan && d.remaining > 0 ? (
            <Badge text={dueLabel(d.plan.nextDue)?.text || prettyDate(d.plan.nextDue)} tone={dueLabel(d.plan.nextDue)?.tone || 'calm'} />
          ) : due ? (
            <Badge text={due.text} tone={due.tone} />
          ) : null}
        </View>
      </Row>

      {d.interest > 0 || d.plan ? (
        <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {d.interest > 0 ? (
            <View style={{ backgroundColor: theme.butter, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 }}>
              <Txt w={700} size={11.5} color={theme.butterInk}>+{d.interest}% interest · from {peso(d.principal ?? d.amount)}</Txt>
            </View>
          ) : null}
          {d.plan ? (
            <View style={{ backgroundColor: theme.sky, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 }}>
              <Txt w={700} size={11.5} color={theme.skyInk}>
                Hulog {Math.min(d.plan.done + (d.remaining > 0 ? 1 : 0), d.plan.count)}/{d.plan.count} · {peso(d.plan.each)} {d.plan.freq === 'weekly' ? 'weekly' : d.plan.freq === 'biweekly' ? 'every 2 wks' : 'monthly'}
              </Txt>
            </View>
          ) : null}
        </View>
      ) : null}

      {d.paid > 0 ? (
        <View style={{ marginTop: 12 }}>
          <ProgressBar value={pct} color={isOwe ? theme.peachInk : theme.mintInk} height={8} />
          <Txt w={600} size={12} color="sub" style={{ marginTop: 6 }}>
            {peso(d.paid)} paid of {peso(d.amount)}
          </Txt>
        </View>
      ) : null}

      {payments.length ? (
        <View style={{ marginTop: 10, backgroundColor: theme.cardAlt, borderRadius: radius.sm, padding: 10, gap: 6 }}>
          {payments.map((p) => (
            <Pressable key={p.id} onLongPress={() => onUndo(p)} onPress={() => (p.photo ? onPhoto(p.photo) : null)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt size={12.5} color="sub">✓ Paid {prettyDate(p.date)}{p.photo ? '  📎 view proof' : ''}</Txt>
                <Txt w={700} size={12.5} color="sub">{peso(p.amount)}</Txt>
              </Row>
            </Pressable>
          ))}
        </View>
      ) : null}

      {onPay && d.remaining > 0 ? (
        <Button
          title={isOwe ? 'I paid' : 'They paid'}
          icon="cash-outline"
          size="md"
          style={{ marginTop: 14 }}
          onPress={onPay}
        />
      ) : null}
    </Card>
  );
}
