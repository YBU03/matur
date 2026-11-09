export const SNAP_TESTS = [
 "Signature Access Token", "Signature Service", "Access Token B2B Normal", "Access Token B2B Abnormal",
 "Generate QR MPM Normal", "Generate QR MPM Abnormal", "Query Payment Normal", "Query Payment Abnormal",
 "Payment Notification Normal", "Payment Notification Abnormal",
];
export const ASPI_SECURITY="https://apidevportal.aspi-indonesia.or.id/api-services/keamanan";
export const ASPI_MPM="https://apidevportal.aspi-indonesia.or.id/api-services/transfer-kredit/mpm";
export type SnapResult = { id:string;nomor:number;status:"dicoba"|"sesuai"|"tidak_sesuai";catatan:string;respons:Record<string,string>;bukti_path:string|null;created_at:string };
export type SnapState = {configured:boolean;clientId:string|null;aktif:boolean;publicKey:string|null;hasil:SnapResult[];inbox:{external_id:string;ref:string;status:string;amount:string;created_at:string}[]};
export const SNAP_EMPTY:SnapState={configured:false,clientId:null,aktif:false,publicKey:null,hasil:[],inbox:[]};
