import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import type {NotificationDto} from '@mohammedsaas/types';
import {useParams} from 'react-router-dom';
import {api} from '../lib/api.js';

export function NotificationsPage(){
  const{workspaceSlug=''}=useParams(),queryClient=useQueryClient();
  const notifications=useQuery({queryKey:['notifications',workspaceSlug],queryFn:()=>api<NotificationDto[]>(`/workspaces/${workspaceSlug}/notifications`)});
  const markRead=useMutation({mutationFn:(id:string)=>api<NotificationDto>(`/workspaces/${workspaceSlug}/notifications/${id}/read`,{method:'POST'}),onSuccess:async()=>queryClient.invalidateQueries({queryKey:['notifications',workspaceSlug]})});
  return <>
    <div className="page-header"><div><h1>الإشعارات</h1><p>تنبيهات العمل المهمة.</p></div></div>
    <div className="card-list">{notifications.data?.map(notification=><button className={`notification ${notification.readAt?'read':''}`} key={notification.id} onClick={()=>markRead.mutate(notification.id)}><strong>{notification.title}</strong>{notification.message&&<span>{notification.message}</span>}<small>{new Date(notification.createdAt).toLocaleString('ar')}</small></button>)}</div>
  </>;
}
