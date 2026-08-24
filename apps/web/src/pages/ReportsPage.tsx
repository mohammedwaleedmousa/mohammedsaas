import {useQuery} from '@tanstack/react-query';
import type {BalanceSheetAccountDto,BalanceSheetDto,ProfitLossDto} from '@mohammedsaas/types';
import {useParams} from 'react-router-dom';
import {api} from '../lib/api.js';

const ReportLines=({rows}:{rows:ProfitLossDto['revenue']})=><>{rows.map(row=><div className="metric-row" key={row.code}><span>{row.code} · {row.name}</span><strong>{row.amount}</strong></div>)}</>;
const BalanceLines=({rows}:{rows:ReadonlyArray<BalanceSheetAccountDto>})=><>{rows.map(row=><div className="metric-row" key={row.code}><span>{row.code} · {row.nameAr}</span><strong>{row.amount}</strong></div>)}</>;

export function ReportsPage(){
  const{workspaceSlug=''}=useParams();
  const reports=useQuery({queryKey:['reports',workspaceSlug],queryFn:async()=>({
    profitLoss:await api<ProfitLossDto>(`/workspaces/${workspaceSlug}/reports/profit-loss`),
    balanceSheet:await api<BalanceSheetDto>(`/workspaces/${workspaceSlug}/reports/balance-sheet`)
  })});
  return <>
    <div className="page-header"><div><h1>التقارير</h1><p>تقارير مبنية على دفتر الأستاذ الفعلي.</p></div></div>
    {reports.isLoading?<div className="loader"/>:reports.isError?<div className="form-error">تعذر تحميل التقارير.</div>:reports.data&&<div className="report-grid">
      <section className="card"><h2>الأرباح والخسائر</h2><h3>الإيرادات</h3><ReportLines rows={reports.data.profitLoss.revenue}/><div className="metric-row"><span>إجمالي الإيرادات</span><strong>{reports.data.profitLoss.totalRevenue}</strong></div><h3>المصروفات</h3><ReportLines rows={reports.data.profitLoss.expenses}/><div className="metric-row"><span>إجمالي المصروفات</span><strong>{reports.data.profitLoss.totalExpenses}</strong></div><div className="metric-row"><span>صافي الربح</span><strong>{reports.data.profitLoss.netProfit}</strong></div></section>
      <section className="card"><h2>الميزانية</h2><h3>الأصول</h3><BalanceLines rows={reports.data.balanceSheet.assets}/><h3>الالتزامات</h3><BalanceLines rows={reports.data.balanceSheet.liabilities}/><h3>حقوق الملكية</h3><BalanceLines rows={reports.data.balanceSheet.equity}/></section>
    </div>}
  </>;
}
