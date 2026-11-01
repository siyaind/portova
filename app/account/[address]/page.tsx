import { AccountProfile } from "@/components/chain/account-profile";
export default async function AccountPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  return <AccountProfile address={address} />;
}
