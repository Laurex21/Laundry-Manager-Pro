import {useQuery} from '@tanstack/react-query';
import {useAuth} from './use-auth';

export class AmbassadorRequestError extends Error {
  constructor(readonly status:number,readonly code:string){super(code);}
}
export async function ambassadorApi(path:string,options?:RequestInit){
  const response=await fetch(path,{credentials:'same-origin',...options});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new AmbassadorRequestError(response.status,body.code||'AMBASSADOR_UNAVAILABLE');
  return body;
}
export function useAmbassador(){
  const {user}=useAuth();
  const access=useQuery<{enabled:boolean}>({
    queryKey:['ambassador-access',user?.id],
    queryFn:()=>ambassadorApi('/api/ambassador/access'),
    enabled:!!user,retry:false,staleTime:0,gcTime:0,
    refetchOnWindowFocus:true,refetchInterval:30000,
  });
  return {userId:user?.id,access,enabled:!!user&&access.isSuccess&&access.data.enabled};
}
