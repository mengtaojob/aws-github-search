import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OctoShelf · GitHub 开发者收藏夹',
  description: '发现 GitHub 开发者，建立自己的灵感与人才收藏夹。Next.js + AWS Lambda 全栈课程项目。',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
