import { OpnameOutlet } from "@/components/opname-outlet";
export default function Page({searchParams}:{searchParams:Promise<{outlet?:string}>}){
  return <OpnameOutlet searchParams={searchParams}/>;
}
