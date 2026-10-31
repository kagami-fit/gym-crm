'use client'

import dynamic from 'next/dynamic'

// グラフ（recharts）はブラウザの中だけで描く。サーバーでは組み立てないので、公開先（Cloudflare Workers）の容量の上限に収まる。
// 描くまでのあいだは、同じくらいの高さの枠を出しておく
const Placeholder = () => <div className="h-72 animate-pulse rounded-2xl border border-line bg-white/60" aria-hidden />

export const WeightTrend = dynamic(() => import('./WeightTrend').then((m) => m.WeightTrend), { ssr: false, loading: Placeholder })
export const ProjectionChart = dynamic(() => import('./ProjectionChart').then((m) => m.ProjectionChart), { ssr: false, loading: Placeholder })
export const VolumeCharts = dynamic(() => import('./TrainingCharts').then((m) => m.VolumeCharts), { ssr: false, loading: Placeholder })
export const MetricCharts = dynamic(() => import('./TrainingCharts').then((m) => m.MetricCharts), { ssr: false, loading: Placeholder })
export const PfcDonut = dynamic(() => import('./PfcDonut').then((m) => m.PfcDonut), { ssr: false, loading: () => <div className="aspect-square w-full animate-pulse rounded-full bg-soft" aria-hidden /> })
