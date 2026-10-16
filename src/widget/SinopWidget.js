import { FlexWidget, TextWidget } from 'react-native-android-widget';

function pesoText(centavos) {
  const whole = Math.round((Number(centavos) || 0) / 100);
  return '₱' + String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function SinopWidget({ data }) {
  const d = data || {};
  const left = d.budget ? d.budget - (d.usedMonth ?? d.spentMonth ?? 0) : null;
  const sub = d.budget
    ? left >= 0
      ? `${pesoText(left)} left this month`
      : `Over budget by ${pesoText(-left)} 😭`
    : `${pesoText(d.spentMonth)} spent this month`;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 24,
        backgroundGradient: { from: '#3E9B6B', to: '#23664A', orientation: 'TL_BR' },
      }}
    >
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: 'match_parent' }}>
        <TextWidget text="sinop · today" style={{ fontSize: 13, color: '#E2F2E8', fontStyle: 'italic' }} />
        <TextWidget text={d.streak ? `🔥 ${d.streak}` : '✌️'} style={{ fontSize: 13, color: '#FFFFFF', fontWeight: '700' }} />
      </FlexWidget>
      <TextWidget text={pesoText(d.spentToday)} style={{ fontSize: 34, color: '#FFFFFF', fontWeight: '800' }} />
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: 'match_parent' }}>
        <TextWidget text={sub} style={{ fontSize: 12, color: '#E2F2E8' }} maxLines={1} truncate="END" />
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'sinop://add' }}
          style={{ backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 }}
        >
          <TextWidget text="+ Add" style={{ fontSize: 14, color: '#23664A', fontWeight: '800' }} />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
