import {useQuery} from '@tanstack/react-query';
import type {PlatformOverviewDto} from '@mohammedsaas/types';
import {api} from '../lib/api.js';

export function PlatformPage(){
  const overview=useQuery({queryKey:['platform-overview'],queryFn:()=>api<PlatformOverviewDto>('/platform/overview')});
  return <main className="platform-page" dir="rtl">
    <div className="page-header"><div><h1>إدارة المنصة</h1><p>مؤشرات SaaS منفصلة عن بيانات الشركات.</p></div></div>
    {overview.data&&<div className="kpi-grid">
      {[
        ['الشركات',overview.data.totalCompanies],
        ['الشركات النشطة',overview.data.activeCompanies],
        ['التجارب',overview.data.trialCompanies],
        ['الاشتراكات النشطة',overview.data.activeSubscriptions],
        ['المستخدمون النشطون',overview.data.activeUsers]
      ].map(([label,value])=><div className="kpi-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      {Object.entries(overview.data.mrrByCurrency).map(([currency,value])=><div className="kpi-card" key={currency}><span>MRR · {currency}</span><strong>{value}</strong></div>)}
    </div>}
  </main>;
}
