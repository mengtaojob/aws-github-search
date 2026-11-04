import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Platform, Pressable, RefreshControl, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';

interface SavedUser {
  id: number; login: string; name: string | null; avatar_url: string;
  html_url: string; bio: string | null; note: string; tags: string[];
}

export default function App() {
  const [base, setBase] = useState('');
  const [token, setToken] = useState('');
  const [connected, setConnected] = useState(false);
  const [settings, setSettings] = useState(true);
  const [users, setUsers] = useState<SavedUser[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const url = base.trim().replace(/\/$/, '');
    if (!/^https?:\/\//.test(url)) { setError('请输入完整 API 地址（以 https:// 开头）'); return; }
    setLoading(true); setError('');
    try {
      const response = await fetch(`${url}/users`, { headers: token.trim() ? { Authorization: `Bearer ${token.trim()}` } : {}, signal: AbortSignal.timeout(20_000) });
      const data = await response.json() as { items?: SavedUser[]; message?: string };
      if (!response.ok) throw new Error(data.message ?? `请求失败 ${response.status}`);
      if (!Array.isArray(data.items)) throw new Error('API 返回格式不正确');
      setUsers(data.items); setConnected(true); setSettings(false);
    } catch (e) { setError(e instanceof Error ? e.message : '无法连接 API'); }
    finally { setLoading(false); }
  }

  async function openGitHub(url: string) {
    if (!url.startsWith('https://github.com/')) return;
    try { await Linking.openURL(url); } catch { Alert.alert('暂时无法打开链接', '请检查手机浏览器设置'); }
  }

  const visible = users.filter((u) => `${u.login} ${u.name ?? ''} ${u.note} ${u.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()));

  return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" /><View style={s.header}><View style={s.brandRow}><Text style={s.brand}>◉ OctoShelf</Text><Pressable accessibilityRole="button" onPress={() => setSettings(!settings)}><Text style={s.settings}>{settings ? '收起' : '连接设置'}</Text></Pressable></View><Text style={s.kicker}>YOUR PEOPLE. YOUR INSPIRATION.</Text><Text style={s.headline}>把开源灵感，装进口袋。</Text><Text style={s.subtitle}>你的开发者收藏夹，随时随地。</Text></View><View style={s.body}>
    {settings && <View style={s.connection}><Text style={s.sectionTitle}>连接你的项目</Text><Text style={s.helper}>使用与网页相同的 API 地址和项目访问令牌。令牌仅保存在内存，关闭 App 后需要重新输入。</Text><TextInput style={s.input} accessibilityLabel="API 地址" placeholder={Platform.OS === 'android' ? 'https://你的API地址 或 http://10.0.2.2:3001' : 'https://你的API地址'} autoCapitalize="none" autoCorrect={false} value={base} onChangeText={setBase} /><TextInput style={s.input} accessibilityLabel="项目访问令牌" placeholder="项目访问令牌（本地开发可留空）" secureTextEntry autoCapitalize="none" value={token} onChangeText={setToken} /><Pressable accessibilityRole="button" disabled={loading} style={s.button} onPress={() => void load()}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>连接并加载收藏 →</Text>}</Pressable></View>}
    {!!error && <View accessibilityRole="alert" style={s.error}><Text style={s.errorText}>{error}</Text></View>}
    <View style={s.titleRow}><Text style={s.title}>我的收藏 <Text style={s.count}>{users.length}</Text></Text><Text style={s.connectionStatus}>{connected ? '● 已连接' : '○ 等待连接'}</Text></View><TextInput style={[s.input, s.search]} accessibilityLabel="搜索收藏" placeholder="搜索名字、备注或标签…" value={query} onChangeText={setQuery} />
    <FlatList data={visible} keyExtractor={(u) => String(u.id)} showsVerticalScrollIndicator={false} contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor="#16856a" />} ListEmptyComponent={<View style={s.empty}><Text style={s.emptyIcon}>✳</Text><Text style={s.emptyTitle}>{connected ? query ? '没有匹配的收藏' : '收藏从一次发现开始' : '你的开源同行，在这里相遇'}</Text><Text style={s.helper}>{connected ? '在网页端收藏开发者，然后下拉刷新。' : '先配置 API 连接，即可同步网页保存的开发者。'}</Text></View>} renderItem={({ item }) => <Pressable accessibilityRole="link" accessibilityLabel={`在 GitHub 查看 ${item.login}`} style={s.card} onPress={() => void openGitHub(item.html_url)}><View style={s.cardTop}><Image style={s.avatar} source={{ uri: item.avatar_url }} /><View style={s.cardName}><Text style={s.name}>{item.name || item.login}</Text><Text style={s.login}>@{item.login}</Text></View><Text style={s.arrow}>↗</Text></View><Text style={s.bio} numberOfLines={2}>{item.bio || '这位开发者还没有填写简介。'}</Text>{!!item.note && <View style={s.note}><Text style={s.noteLabel}>我的备注</Text><Text style={s.noteText} numberOfLines={3}>{item.note}</Text></View>}<View style={s.tags}>{item.tags.map((tag) => <Text style={s.tag} key={tag}>{tag}</Text>)}</View></Pressable>} />
    <Text style={s.footer}>Built for curious minds. · AWS 全栈实践</Text>
  </View></SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#172d26', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { paddingHorizontal: 26, paddingTop: 22, paddingBottom: 34 }, brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { color: '#dcebd3', fontSize: 23, fontWeight: '700', letterSpacing: -0.6 }, settings: { color: '#a7bea5', fontSize: 11, padding: 8 }, kicker: { color: '#8eaa8b', fontSize: 8, letterSpacing: 2, marginTop: 31 }, headline: { color: '#eef4e9', fontSize: 24, fontWeight: '600', marginTop: 13 }, subtitle: { color: '#93ac98', fontSize: 11, marginTop: 11 }, body: { flex: 1, backgroundColor: '#f7f9f4', paddingHorizontal: 21, borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingTop: 25 }, titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 }, title: { fontSize: 18, fontWeight: '600', color: '#344b32' }, count: { color: '#8ea184', fontSize: 13 }, connectionStatus: { fontSize: 9, color: '#6e9470' }, input: { borderWidth: 1, borderColor: '#dfe7d6', backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 13, fontSize: 12, color: '#36502f', marginBottom: 11 }, search: { marginBottom: 18 }, list: { paddingBottom: 15 }, card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e9dc', padding: 19, marginBottom: 13 }, cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { height: 47, width: 47, borderRadius: 24, backgroundColor: '#eaf0e1' }, cardName: { flex: 1 }, name: { color: '#37512f', fontSize: 16, fontWeight: '600' }, login: { color: '#9aa98f', fontSize: 11, marginTop: 4 }, arrow: { color: '#a4b395', fontSize: 21 }, bio: { color: '#8b9b7e', fontSize: 11, lineHeight: 19, marginTop: 15 }, tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 11 }, tag: { color: '#6c8a58', backgroundColor: '#f0f5e8', borderRadius: 4, fontSize: 10, paddingVertical: 4, paddingHorizontal: 8 }, note: { backgroundColor: '#f8faf4', borderRadius: 6, padding: 11, marginTop: 13 }, noteLabel: { color: '#a1ae92', fontSize: 9, marginBottom: 5 }, noteText: { color: '#7c906c', fontSize: 11, lineHeight: 18 }, connection: { padding: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e8d9', borderRadius: 10, marginBottom: 25 }, sectionTitle: { fontSize: 14, fontWeight: '600', color: '#415e36', marginBottom: 8 }, helper: { fontSize: 11, lineHeight: 19, color: '#9baa8e', marginBottom: 17 }, button: { backgroundColor: '#16856a', borderRadius: 7, padding: 13, alignItems: 'center' }, buttonText: { color: '#fff', fontSize: 12, fontWeight: '500' }, error: { backgroundColor: '#fff0e8', borderRadius: 7, padding: 13, marginBottom: 15 }, errorText: { color: '#ae6951', fontSize: 11, lineHeight: 18 }, empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 15 }, emptyIcon: { fontSize: 44, color: '#bacaaa', marginBottom: 18 }, emptyTitle: { fontSize: 14, color: '#829770', marginBottom: 12 }, footer: { color: '#acb79f', fontSize: 8, textAlign: 'center', paddingVertical: 14 },
});
