import {useEffect} from 'react';
import {Redirect} from 'wouter';

// Old invitation fragments are not credentials in the new account-based flow.
export default function SalesPortal(){
 useEffect(()=>{window.history.replaceState(null,'','/ambassador');},[]);
 return <Redirect to="/ambassador" replace />;
}
