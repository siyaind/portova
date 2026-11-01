"use client";
import {useEffect,useRef,useState} from 'react';
import {encodeFunctionData,parseAbi,stringToHex,getAddress,type Hex} from 'viem';
import {useSubstrateWallet} from '@/components/wallet/substrate-wallet';
import {signedProjectRequest} from '@/lib/project-client';
import {paymentProofMessage,PAYMENT_CHAIN,PAYMENT_TOKEN,type CryptoInvoice} from '@/lib/crypto-payments';
import Link from 'next/link';
import {PLANS} from '@/lib/plans';
import {Button,Panel} from '@/components/ui';
import {formatUnits} from '@/lib/format';
type Provider={request(args:{method:string;params?:unknown[]}):Promise<unknown>};
type Term={plan:string;starts_at:string;ends_at:string};
export function CryptoBilling(){
  const wallet=useSubstrateWallet();
  const [enabled,setEnabled]=useState(false),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [invoice,setInvoice]=useState<CryptoInvoice|null>(null),[history,setHistory]=useState<CryptoInvoice[]>([]),[terms,setTerms]=useState<Term[]>([]);
  const [hash,setHash]=useState(''),[ack,setAck]=useState(false);
  const lock=useRef(false),alive=useRef(true),current=useRef(invoice);current.current=invoice;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{void fetch('/api/projects/status',{cache:'no-store'}).then(r=>r.json()).then(x=>{setReady(x.available===true);setEnabled(x.billing===true);}).catch(()=>setEnabled(false));},[]);
  useEffect(()=>{setInvoice(null);setHistory([]);setTerms([]);setHash('');setMessage('');setAck(false);},[wallet.selected?.address]);
  async function load(plan?:'pro'|'team'){
    if(!wallet.selected){await wallet.connect();return;}if(lock.current)return;lock.current=true;setBusy(true);setMessage('');
    const version=wallet.getVersion(),signer=wallet.selected;const valid=()=>alive.current&&wallet.getVersion()===version;
    try{const result=await signedProjectRequest(plan?{action:'checkout',plan}:{action:'billing'},signer,valid);if(!valid())return;
      if(result.invoice){setInvoice(result.invoice);setHash('');setAck(false);setMessage('Invoice created. Review the recipient, chain and amount before paying.');}
      else{setHistory(result.invoices??[]);setTerms(result.terms??[]);setMessage('Payment records loaded. Each term lasts 30 days; new terms start after existing paid time.');}
    }catch(cause){if(alive.current)setMessage(cause instanceof Error?cause.message:'Billing request failed.');}finally{lock.current=false;if(alive.current)setBusy(false);}
  }
  async function checkPayment(selected:CryptoInvoice,provider:Provider,payer:string,proof:Hex,txHash:string){
    const response=await fetch('/api/payments/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invoiceId:selected.id,payer,signature:proof,txHash}),signal:AbortSignal.timeout(45000)});
    const data=await response.json();if(!response.ok)throw Error(data.error??'Payment verification unavailable. Keep your transaction hash.');
    if(!alive.current||current.current?.id!==selected.id)return;
    if(data.status==='paid'){setInvoice({...selected,status:'paid',txHash});setMessage(data.startsAt?`Payment credited. ${data.plan} term: ${new Date(data.startsAt).toLocaleString()} to ${new Date(data.endsAt).toLocaleString()}. Refresh workspaces to read your plan.`:'Payment already credited. Load billing records to see your term.');}
    else setMessage(data.message??'Waiting for Base finality. Do not pay again.');
  }
  async function pay(recover=false){
    if(!invoice||!wallet.selected||lock.current)return;
    const selected=invoice,version=wallet.getVersion();const valid=()=>alive.current&&wallet.getVersion()===version&&current.current?.id===selected.id;
    const provider=(window as Window&{ethereum?:Provider}).ethereum;
    if(!provider){setMessage('Open this page with an EVM wallet such as MetaMask available. Your Substrate wallet remains the workspace identity.');return;}
    if(!recover&&(selected.status==='pending'||selected.txHash)){setMessage('A transfer is already recorded. Recheck its hash instead of paying again.');return;}
    if(!recover&&Date.now()>=Date.parse(selected.expiresAt)){setMessage('This invoice expired. Create a fresh invoice before paying.');return;}
    lock.current=true;setBusy(true);setMessage('Connect the payment wallet and verify the Base network.');let txHash=hash;
    try{
      const accounts=await provider.request({method:'eth_requestAccounts'}) as string[];if(!accounts[0]||!valid())throw Error('The wallet or invoice changed. Review again.');
      const payer=getAddress(accounts[0].toLowerCase());
      if(Number(await provider.request({method:'eth_chainId'}))!==PAYMENT_CHAIN){
        try{await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x2105'}]});}
        catch(cause){if((cause as {code?:number}).code!==4902)throw cause;await provider.request({method:'wallet_addEthereumChain',params:[{chainId:'0x2105',chainName:'Base',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:['https://mainnet.base.org'],blockExplorerUrls:['https://basescan.org']}]});}
      }
      if(Number(await provider.request({method:'eth_chainId'}))!==PAYMENT_CHAIN||!valid())throw Error('Base is required for this payment.');
      const proof=await provider.request({method:'personal_sign',params:[stringToHex(paymentProofMessage(selected,payer,window.location.origin)),payer]}) as Hex;
      const liveAccounts=await provider.request({method:'eth_accounts'}) as string[];
      if(!valid()||liveAccounts[0]?.toLowerCase()!==payer.toLowerCase()||Number(await provider.request({method:'eth_chainId'}))!==PAYMENT_CHAIN)throw Error('Payment wallet changed. Review again.');
      if(!recover){
        if(!ack||Date.now()>=Date.parse(selected.expiresAt))throw Error('Confirm the payment review before opening the transfer.');
        setMessage('Approve only the reviewed USDC transfer in your wallet. Network gas is separate.');
        const data=encodeFunctionData({abi:parseAbi(['function transfer(address to,uint256 amount) returns (bool)']),functionName:'transfer',args:[getAddress(selected.recipient),BigInt(selected.amount)]});
        txHash=await provider.request({method:'eth_sendTransaction',params:[{from:payer,to:PAYMENT_TOKEN,data,value:'0x0',chainId:'0x2105'}]}) as string;
        // Never automatically retry a transfer. Save its returned hash even if account context changed.
        try{window.localStorage.setItem(`portova.payment.${selected.id}`,txHash);}catch{}
        if(!valid())return;setHash(txHash);setInvoice({...selected,txHash,status:'pending',payer});
      }
      if(!/^0x[0-9a-fA-F]{64}$/.test(txHash))throw Error('Enter the existing transaction hash to recover this payment.');
      await checkPayment(selected,provider,payer,proof,txHash);
    }catch(cause){if(alive.current&&current.current?.id===selected.id)setMessage(`${cause instanceof Error?cause.message:'Payment request failed.'}${txHash?' Keep this transaction hash and recheck; do not send again.':''}`);}
    finally{lock.current=false;if(alive.current)setBusy(false);}
  }
  function openInvoice(row:CryptoInvoice){setAck(false);setMessage('');let saved='';try{saved=window.localStorage.getItem(`portova.payment.${row.id}`)??'';}catch{}setInvoice(saved&&row.status==='open'?{...row,status:'pending',txHash:saved}:row);setHash(row.txHash??saved);}
  const amount=invoice?formatUnits(invoice.amount,6):'';
  return <div className="space-y-5"><Panel className="space-y-4 p-5"><p className="text-xs uppercase tracking-widest text-violet">Free pilot · proposed paid plans</p><h2 className="text-xl font-semibold">Pay for ongoing project operations.</h2><p className="text-sm leading-7 text-muted">Basic chain tools remain available on Explorer. Pro adds periodic monitoring and indexed reports for repeat work. Team adds capacity and shared access for collaborators. The free pilot will test whether these benefits save teams time before checkout is enabled.</p><Link href="/workspace#pilot-request" className="inline-block rounded-xl border border-line px-4 py-3 text-sm text-violet">Request a free pilot ↗</Link><p className="text-xs leading-6 text-faint">Supported monitoring covers issuer, token status, collection ownership and reserve changes. In-app alerts depend on worker coverage and schedule; indexed reports show recent related activity, not complete account history or verified revenue.</p></Panel><div className="grid gap-4 md:grid-cols-3">{[{plan:'free',name:PLANS.free.name,amount:PLANS.free.priceUsdc,detail:'Up to 3 cloud projects, public pages, token/NFT/liquidity tools, manual Launch Health checks and local receipts.'},{plan:'pro',name:PLANS.pro.name,amount:PLANS.pro.priceUsdc,detail:'Up to 20 cloud projects, recent indexed activity, periodic in-app change alerts and JSON reports. For teams checking their launches regularly.'},{plan:'team',name:PLANS.team.name,amount:PLANS.team.priceUsdc,detail:'Up to 100 cloud projects, Pro features and up to 10 collaborators per project. Viewer/editor roles, access revocation and shared audit visibility.'}].map(item=><Panel key={item.plan} className="space-y-4 p-6"><p className="text-violet">{item.name}</p>{item.amount>0&&<p className="text-xs uppercase tracking-widest text-muted">Planned pricing · free pilot now</p>}<p className="text-3xl font-semibold">{item.amount?`${item.amount} USDC`:'Free'}{item.amount>0&&<span className="block pt-2 text-sm text-muted">per 30 days · Base network</span>}</p><p className="min-h-16 text-sm leading-6 text-muted">{item.detail}</p>{item.plan!=='free'&&(enabled?<Button disabled={busy} onClick={()=>void load(item.plan as 'pro'|'team')}>Create {item.name} invoice</Button>:<Link href="/workspace#pilot-request" className="inline-block rounded-xl border border-line px-4 py-3 text-sm text-violet">Join the free pilot ↗</Link>)}<p className="text-xs leading-6 text-faint">{item.amount?'Manual renewal. Each verified payment adds a 30-day term after existing paid time. No automatic debits.':'Network fees and deposits are separate.'}</p></Panel>)}</div>
    <Panel className="space-y-4 p-5"><h2 className="text-lg font-semibold">Crypto billing</h2><p className="text-sm leading-7 text-muted">Pay native USDC on Base from an EVM wallet. Keep ETH on Base for gas. Workspace identity still uses your Substrate wallet. Access begins only after finalized onchain verification, which can take around 20 minutes or longer. A different plan is queued after existing paid time; there is no mid-term proration.</p>{!enabled&&<p className="text-sm text-warn">Checkout is disabled for the free pilot. These prices show the proposed business model; no payment is required to request a pilot.</p>}<Button disabled={!ready||busy} onClick={()=>void load()}>Load my invoices & paid terms</Button>{message&&<p role="status" className="break-words text-sm leading-7">{message}</p>}
      {invoice&&<div className="space-y-4 rounded-xl border border-violet/40 p-5"><h3 className="text-lg font-semibold">{invoice.plan} · {amount} USDC · {invoice.status}</h3><p className="break-all text-xs">Invoice {invoice.id}</p><p className="break-all text-xs">Recipient: {invoice.recipient}</p><p className="break-all text-xs">Token: {invoice.token} · Base chain {invoice.chainId}</p><p className="text-xs text-muted">Pay before {new Date(invoice.expiresAt).toLocaleString()}. Payments on other chains, wrong tokens, partial/extra amounts or late transfers need manual support.</p><label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={ack} disabled={busy} onChange={e=>setAck(e.target.checked)}/><span>I reviewed the amount, recipient and Base network. This sends real USDC and requires separate gas. This payment purchases a 30-day workspace term. Changing accounts or leaving the page does not cancel an open transfer prompt; dismiss it in your wallet.</span></label><Button disabled={busy||!enabled||!ack||!!hash||invoice.status!=='open'} onClick={()=>void pay()}>Review and pay {amount} USDC</Button><label className="block text-sm">Existing payment transaction hash<input value={hash} disabled={busy} onChange={e=>setHash(e.target.value.trim())} placeholder="0x…" className="mt-2 h-12 w-full rounded-xl border border-line bg-bg px-3 font-mono text-xs"/></label><Button disabled={busy||!/^0x[0-9a-fA-F]{64}$/.test(hash)} onClick={()=>void pay(true)}>Recheck existing payment</Button>{/^0x[0-9a-fA-F]{64}$/.test(hash)&&<a className="ml-3 text-sm text-violet" href={`https://basescan.org/tx/${hash}`} target="_blank" rel="noreferrer">View Base receipt ↗</a>}</div>}
      {history.map(row=><div key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3"><p className="text-sm">{row.plan} · {formatUnits(row.amount,6)} USDC · {row.status} · {new Date(row.createdAt).toLocaleDateString()}</p><Button disabled={busy} onClick={()=>openInvoice(row)}>Open invoice / recover</Button></div>)}
      {terms.map((term,i)=><p key={i} className="text-xs leading-6 text-muted">{term.plan}: {new Date(term.starts_at).toLocaleString()} → {new Date(term.ends_at).toLocaleString()}</p>)}
      <p className="text-xs leading-6 text-faint">Only exact, finalized USDC transfers tied to the paying wallet can be credited. Never send again because a response was lost. Keep your hash and use recovery or support. Refunds are handled manually by the operator.</p>
    </Panel></div>;
}
