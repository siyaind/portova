"use client";
import {Button,Panel} from '@/components/ui';
export default function ErrorPage({reset}:{reset:()=>void}){return <Panel className="space-y-4 p-8"><h1 className="text-2xl font-semibold">This workspace could not load.</h1><p className="text-sm leading-7 text-muted">Try loading it again. If you were approving a transaction, inspect Activity before retrying the operation.</p><Button onClick={reset}>Try again</Button><a className="ml-4 text-sm text-violet" href="/activity">Open receipts & recovery</a></Panel>;}
