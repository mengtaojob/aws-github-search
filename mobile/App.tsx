import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, FlatList, Image, KeyboardAvoidingView, Linking, Platform, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { DEFAULT_API_URL, fetchUsers, filterUsers, normalizeBase, type Connection, type SavedUser } from './src/api';
import { deleteConnection, readConnection, saveConnection } from './src/connection';

type Page = 'list' | 'settings' | 'detail';
const message = (error: unknown) => error instanceof Error ? error.message : '操作失败，请稍后重试。';
const number = (value: number) => value >= 10000 ? `${(value / 10000).toFixed(1)}万` : String(value);
function Avatar({ user, large = false }: { user: SavedUser; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  return user.avatar_url && !failed ? <Image accessibilityLabel={`${user.login} 的头像`} source={{ uri: user.avatar_url }} onError={() => setFailed(true)} style={[s.avatar, large && s.avatarLarge]} /> : <View style={[s.avatar, s.avatarFallback, large && s.avatarLarge]}><Text style={s.initial}>{user.login.slice(0, 1).toUpperCase()}</Text></View>;
}
function Tags({ tags }: { tags: string[] }) { return <View style={s.tags}>{tags.map(tag => <Text key={tag} style={s.tag}>{tag}</Text>)}</View>; }
function Button({ title, onPress, busy = false, secondary = false }: { title: string; onPress: () => void; busy?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={busy} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondaryButton, (pressed || busy) && s.dim]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={[s.buttonText, secondary && s.secondaryText]}>{title}</Text>}</Pressable>;
}

function CollectionApp() {
  const [page, setPage] = useState<Page>('settings');
  const [connection, setConnection] = useState<Connection | null>(null);
  const [base, setBase] = useState(DEFAULT_API_URL);
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [users, setUsers] = useState<SavedUser[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [syncedAt, setSyncedAt] = useState('');
  const request = useRef<AbortController | null>(null);

  async function load(value: Connection, persist = false) {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(''); setNotice('');
    try {
      const next = { base: normalizeBase(value.base), token: value.token.trim() };
      const records = await fetchUsers(next, controller.signal);
      if (request.current !== controller) return;
      if (persist) {
        try { await saveConnection(next); }
        catch { if (request.current === controller) setNotice('已连接，但无法安全保存令牌。关闭后需要重新输入。'); }
      }
      if (request.current !== controller) return;
      setUsers(records); setConnection(next); setPage('list');
      setSyncedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) { if (request.current === controller) setError(message(e)); }
    finally { if (request.current === controller) { setLoading(false); request.current = null; } }
  }
  useEffect(() => {
    let active = true;
    void readConnection().then(value => {
      if (!active || !value) return;
      setBase(value.base); setToken(value.token); void load(value);
    }).catch(() => { if (active) setError('无法读取已保存的连接，请重新输入令牌。'); }).finally(() => { if (active) setRestoring(false); });
    return () => { active = false; request.current?.abort(); request.current = null; };
  }, []);
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (page !== 'list' && connection && !loading) { setPage('list'); setError(''); return true; }
      return false;
    });
    return () => back.remove();
  }, [page, connection, loading]);
  async function disconnect() {
    try { await deleteConnection(); } catch { setError('清除安全存储失败，请重试。'); return; }
    request.current?.abort(); request.current = null;
    setConnection(null); setToken(''); setShowToken(false); setUsers([]); setSelected(null);
    setQuery(''); setSyncedAt(''); setError(''); setNotice(''); setLoading(false); setPage('settings');
  }
  async function openGitHub(user: SavedUser) {
    try { await Linking.openURL(`https://github.com/${encodeURIComponent(user.login)}`); }
    catch { Alert.alert('无法打开 GitHub', '请检查网络或手机浏览器设置。'); }
  }
  const visible = filterUsers(users, query);
  const person = users.find(u => u.id === selected);
  const tagCount = new Set(users.flatMap(u => u.tags)).size;
  const settings = () => { setError(''); setShowToken(false); setPage('settings'); };
  if (restoring) return <View style={s.splash}><Text style={s.brand}>◈ OctoShelf</Text><ActivityIndicator color="#bdd4a2" style={{ marginTop: 24 }} /></View>;
  return <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
    <StatusBar barStyle="light-content" />
    <View style={s.topbar}><Text style={s.brand}>◈ OctoShelf</Text><Text style={s.topLabel}>DEVELOPER COLLECTION</Text></View>
    <View style={s.surface}>
      {page === 'settings' ? <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.settingsContent}>
        {connection && <Pressable accessibilityRole="button" disabled={loading} onPress={() => { setPage('list'); setError(''); }} style={s.back}><Text style={s.backText}>← 返回收藏</Text></Pressable>}
        <Text style={s.eyebrow}>YOUR COLLECTION, EVERYWHERE</Text><Text style={s.heroTitle}>把开源灵感，{'\n'}装进口袋。</Text><Text style={s.intro}>连接你的项目，随时查看收藏的开发者、备注和标签。</Text>
        <View style={s.form}><Text style={s.sectionTitle}>连接设置</Text><Text style={s.formHint}>与网页使用同一个 API 和项目访问令牌。</Text>
          <Text style={s.label}>API 地址</Text><TextInput accessibilityLabel="API 地址" value={base} onChangeText={setBase} editable={!loading} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={s.input} />
          <Text style={s.label}>项目访问令牌</Text><View style={s.tokenRow}><TextInput accessibilityLabel="项目访问令牌" value={token} onChangeText={setToken} editable={!loading} secureTextEntry={!showToken} autoCapitalize="none" autoCorrect={false} placeholder="粘贴网页使用的访问令牌" placeholderTextColor="#8a9d92" style={[s.input, s.tokenInput]} /><Pressable accessibilityRole="button" accessibilityLabel={showToken ? '隐藏令牌' : '显示令牌'} onPress={() => setShowToken(!showToken)} style={s.tokenToggle}><Text style={s.backText}>{showToken ? '隐藏' : '显示'}</Text></Pressable></View>
          <Text style={s.storageHint}>{Platform.OS === 'web' ? '浏览器预览只在内存中使用令牌。Android 安装版使用系统安全存储。' : '令牌保存在手机系统安全存储中，下次打开可自动连接。'}</Text>
          {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}<Button title="保存并连接 →" busy={loading} onPress={() => void load({ base, token }, true)} />
          {connection && <View style={{ marginTop: 12 }}><Button title="清除令牌并断开连接" secondary onPress={() => void disconnect()} busy={loading} /></View>}
        </View><View style={s.tip}><Text style={s.tipTitle}>一个收藏夹，两个入口</Text><Text style={s.tipText}>在网页添加和编辑开发者，在手机下拉刷新即可同步。App 通过 HTTPS 访问项目 API。</Text></View><Text style={s.footer}>OctoShelf · 为好奇心保留一个位置</Text>
      </ScrollView></KeyboardAvoidingView> : page === 'detail' && person ? <ScrollView contentContainerStyle={s.detailContent}>
        <Pressable accessibilityRole="button" onPress={() => setPage('list')} style={s.back}><Text style={s.backText}>← 我的收藏</Text></Pressable>
        <View style={s.profileHero}><Avatar key={person.id} user={person} large /><Text style={s.detailName}>{person.name || person.login}</Text><Text style={s.detailLogin}>@{person.login}</Text><Text style={s.detailBio}>{person.bio || '这位开发者暂未填写简介。'}</Text></View>
        <View style={s.stats}><View style={s.stat}><Text style={s.statNumber}>{number(person.public_repos)}</Text><Text style={s.statLabel}>公开仓库</Text></View><View style={s.statDivider}/><View style={s.stat}><Text style={s.statNumber}>{number(person.followers)}</Text><Text style={s.statLabel}>关注者</Text></View></View>
        <View style={s.infoCard}><Text style={s.sectionTitle}>开发者信息</Text><Text style={s.infoLine}>公司　{person.company || '未填写'}</Text><Text style={s.infoLine}>地区　{person.location || '未填写'}</Text><Text style={s.infoLine}>账号　{person.login}</Text></View>
        <View style={s.infoCard}><Text style={s.sectionTitle}>我的备注</Text><Text selectable style={s.fullNote}>{person.note || '还没有备注，可在网页端添加。'}</Text></View><View style={s.infoCard}><Text style={s.sectionTitle}>分类标签</Text>{person.tags.length ? <Tags tags={person.tags} /> : <Text style={s.muted}>暂无标签</Text>}</View>
        <View style={{ marginTop: 20 }}><Button title="在 GitHub 查看主页 ↗" onPress={() => void openGitHub(person)} /></View><Text style={s.footer}>资料来自收藏快照 · 下拉刷新可同步网页修改</Text>
      </ScrollView> : <>
        <View style={s.listHeading}><View style={s.headingRow}><Text style={s.eyebrow}>YOUR NEXT CONNECTION</Text><Pressable accessibilityRole="button" onPress={settings} style={s.settingsButton}><Text style={s.backText}>连接设置</Text></Pressable></View><Text style={s.listTitle}>你的开源收藏夹<Text style={s.titleDot}>.</Text></Text><Text style={s.listSubtitle}>让优秀的人，成为你的灵感。</Text></View>
        <FlatList data={visible} keyExtractor={u => String(u.id)} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.listContent} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { if (connection) void load(connection); }} colors={['#14846a']} tintColor="#14846a" />}
          ListHeaderComponent={<><View style={s.stats}><View style={s.stat}><Text style={s.statNumber}>{users.length}</Text><Text style={s.statLabel}>收藏的开发者</Text></View><View style={s.statDivider}/><View style={s.stat}><Text style={s.statNumber}>{tagCount}</Text><Text style={s.statLabel}>分类标签</Text></View></View>
            <View style={s.syncRow}><Text style={s.syncText}>{loading ? '正在同步…' : `● 已连接${syncedAt ? ` · ${syncedAt} 同步` : ''}`}</Text><Pressable accessibilityRole="button" disabled={loading} onPress={() => { if (connection) void load(connection); }}><Text style={s.backText}>刷新 ↻</Text></Pressable></View>
            {!!notice && <Text style={s.storageHint}>{notice}</Text>}{!!error && <View><Text accessibilityRole="alert" style={s.error}>{error}</Text><Text style={s.storageHint}>当前保留上次成功同步的数据。可重试刷新或检查连接设置。</Text></View>}
            <TextInput accessibilityLabel="搜索收藏" placeholder="搜索姓名、备注或标签…" placeholderTextColor="#8a9d92" value={query} onChangeText={setQuery} style={[s.input, s.search]} autoCorrect={false} /><View style={s.collectionRow}><Text style={s.sectionTitle}>{query.trim() ? '搜索结果' : '全部收藏'}</Text><Text style={s.muted}>{visible.length} 位开发者</Text></View></>}
          ListEmptyComponent={<View style={s.empty}><Text style={s.emptySymbol}>{loading ? '◌' : '✳'}</Text><Text style={s.emptyTitle}>{loading ? '正在加载收藏' : query.trim() ? '没有匹配的开发者' : '收藏从一次发现开始'}</Text><Text style={s.emptyText}>{loading ? '请稍候，正在连接你的项目。' : query.trim() ? '试试其他名字、备注或标签。' : '先在网页收藏开发者，再下拉刷新。'}</Text>{!!query && <Button title="清空搜索" secondary onPress={() => setQuery('')} />}</View>}
          ListFooterComponent={<Text style={s.footer}>向下轻拉，同步你的开源世界。</Text>}
          renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`查看 ${item.name || item.login} 的详情`} onPress={() => { setSelected(item.id); setPage('detail'); }} style={({ pressed }) => [s.card, pressed && s.pressedCard]}>
            <View style={s.cardTop}><Avatar user={item} /><View style={s.cardIdentity}><Text style={s.name}>{item.name || item.login}</Text><Text style={s.login}>@{item.login}</Text></View><Text style={s.chevron}>›</Text></View><Text style={s.bio} numberOfLines={2}>{item.bio || '这位开发者暂未填写简介。'}</Text>
            {!!item.note && <View style={s.note}><Text style={s.noteLabel}>我的备注</Text><Text numberOfLines={2} style={s.noteText}>{item.note}</Text></View>}{!!item.tags.length && <Tags tags={item.tags} />}<View style={s.cardFooter}><Text style={s.cardFooterText}>{number(item.public_repos)} 仓库 · {number(item.followers)} 关注者</Text><Text style={s.cardFooterLink}>查看档案 ↗</Text></View>
          </Pressable>} />
      </>}
    </View>
  </SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><CollectionApp /></SafeAreaProvider>; }

const s = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: '#17392f' }, splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17392f' }, topbar: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { color: '#e7f0dc', fontSize: 23, fontWeight: '700', letterSpacing: -0.8 }, topLabel: { color: '#a7bba9', fontSize: 7, letterSpacing: 1.2 }, surface: { flex: 1, backgroundColor: '#f5f7f2', borderTopLeftRadius: 25, borderTopRightRadius: 25, overflow: 'hidden' },
  settingsContent: { padding: 24, paddingBottom: 30 }, back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingRight: 15 }, backText: { color: '#21745f', fontSize: 12, fontWeight: '600' }, eyebrow: { color: '#7d977c', fontSize: 9, letterSpacing: 2, fontWeight: '600' }, heroTitle: { fontSize: 34, lineHeight: 47, fontWeight: '700', color: '#193b30', marginTop: 17, letterSpacing: -1 }, intro: { color: '#788d7e', fontSize: 13, lineHeight: 22, marginTop: 13, marginBottom: 28 }, form: { backgroundColor: '#fff', padding: 20, borderRadius: 17, borderWidth: 1, borderColor: '#e0e7dd' }, sectionTitle: { color: '#284537', fontSize: 15, fontWeight: '600' }, formHint: { color: '#89998c', fontSize: 11, lineHeight: 19, marginTop: 8, marginBottom: 16 }, label: { color: '#526e58', fontSize: 12, marginBottom: 9, marginTop: 9 },
  input: { borderWidth: 1, borderColor: '#dce5d7', backgroundColor: '#fff', borderRadius: 9, paddingHorizontal: 13, paddingVertical: 14, minHeight: 48, fontSize: 13, color: '#294638' }, tokenRow: { flexDirection: 'row', alignItems: 'center' }, tokenInput: { flex: 1, paddingRight: 55 }, tokenToggle: { position: 'absolute', right: 0, minHeight: 48, minWidth: 52, alignItems: 'center', justifyContent: 'center' }, storageHint: { color: '#7e927f', fontSize: 11, lineHeight: 19, marginVertical: 12 }, button: { minHeight: 49, backgroundColor: '#147f65', borderRadius: 9, alignItems: 'center', justifyContent: 'center', padding: 13 }, buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' }, secondaryButton: { backgroundColor: '#edf3e9', borderWidth: 1, borderColor: '#dce5d6' }, secondaryText: { color: '#52734d' }, dim: { opacity: 0.6 }, error: { backgroundColor: '#fff0e9', padding: 13, borderRadius: 8, color: '#9f523d', fontSize: 12, lineHeight: 20, marginBottom: 12 },
  tip: { borderLeftWidth: 2, borderLeftColor: '#b7cba7', marginTop: 26, paddingLeft: 15 }, tipTitle: { color: '#4b694c', fontSize: 12, fontWeight: '600', marginBottom: 7 }, tipText: { color: '#899b88', fontSize: 11, lineHeight: 20 }, footer: { textAlign: 'center', color: '#8b9b88', fontSize: 10, paddingVertical: 24, lineHeight: 18 }, listHeading: { paddingHorizontal: 23, paddingTop: 13, paddingBottom: 23 }, headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, settingsButton: { minHeight: 44, paddingLeft: 16, justifyContent: 'center' }, listTitle: { fontSize: 29, fontWeight: '700', color: '#203f33', letterSpacing: -0.8, marginTop: 3 }, titleDot: { color: '#159173' }, listSubtitle: { color: '#829781', fontSize: 12, marginTop: 12 }, listContent: { paddingHorizontal: 21, paddingBottom: 12, flexGrow: 1 },
  stats: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e1e8dc', borderRadius: 13, paddingVertical: 20 }, stat: { flex: 1, alignItems: 'center' }, statNumber: { color: '#244f3c', fontSize: 25, fontWeight: '600' }, statLabel: { color: '#8a9b83', fontSize: 10, marginTop: 7 }, statDivider: { width: 1, height: 33, backgroundColor: '#e3e9df' }, syncRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 47 }, syncText: { color: '#7e9a7d', fontSize: 10 }, search: { marginBottom: 22 }, collectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }, muted: { color: '#8e9c85', fontSize: 11, marginTop: 4 },
  card: { padding: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e7db', borderRadius: 13, marginBottom: 14 }, pressedCard: { backgroundColor: '#f0f6eb' }, cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { width: 49, height: 49, borderRadius: 25, backgroundColor: '#e6eedf' }, avatarLarge: { width: 88, height: 88, borderRadius: 44 }, avatarFallback: { alignItems: 'center', justifyContent: 'center' }, initial: { color: '#63825b', fontSize: 25, fontWeight: '600' }, cardIdentity: { flex: 1 }, name: { color: '#284a37', fontSize: 16, fontWeight: '600' }, login: { color: '#8b9d83', fontSize: 11, marginTop: 4 }, chevron: { fontSize: 26, color: '#a2b097' }, bio: { color: '#80917b', fontSize: 12, lineHeight: 20, marginTop: 14 }, note: { padding: 12, backgroundColor: '#f5f8f0', borderRadius: 7, marginTop: 13 }, noteLabel: { color: '#8da17f', fontSize: 9, marginBottom: 5 }, noteText: { color: '#607a54', fontSize: 12, lineHeight: 19 }, tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }, tag: { color: '#60834c', backgroundColor: '#edf3e5', paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, borderRadius: 5 }, cardFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#eff2ea', marginTop: 16, paddingTop: 13 }, cardFooterText: { color: '#94a18b', fontSize: 10 }, cardFooterLink: { color: '#66875b', fontSize: 10 },
  empty: { paddingHorizontal: 20, paddingVertical: 35, alignItems: 'center' }, emptySymbol: { color: '#adc59b', fontSize: 45, marginBottom: 16 }, emptyTitle: { color: '#607d56', fontSize: 15, marginBottom: 10 }, emptyText: { color: '#8da080', fontSize: 12, lineHeight: 21, textAlign: 'center', marginBottom: 18 }, detailContent: { paddingHorizontal: 23, paddingTop: 10, paddingBottom: 25 }, profileHero: { alignItems: 'center', paddingTop: 13, paddingBottom: 25 }, detailName: { color: '#234332', fontSize: 25, fontWeight: '700', marginTop: 17, textAlign: 'center' }, detailLogin: { color: '#79956b', fontSize: 13, marginTop: 7 }, detailBio: { color: '#7e9074', fontSize: 13, lineHeight: 22, marginTop: 15, textAlign: 'center' }, infoCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e1e8db', borderRadius: 12, padding: 18, marginTop: 15 }, infoLine: { color: '#7d9173', fontSize: 12, lineHeight: 22, marginTop: 9 }, fullNote: { color: '#617b54', fontSize: 13, lineHeight: 23, marginTop: 13, marginBottom: 4 },
});
