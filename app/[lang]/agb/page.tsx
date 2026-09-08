import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { LegalPageView } from '@/components/legal-page';
import { getLegal } from '@/content/legal';
import { isLocale, locales } from '@/lib/i18n';

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const page = getLegal(lang).terms;
  return { title: page.title, description: page.lede };
}

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <LegalPageView page={getLegal(lang).terms} />;
}
