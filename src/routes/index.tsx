import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { authClient } from "../lib/auth-client";
import { startCheckout } from "../lib/checkout.functions";

export const Route = createFileRoute("/")({ component: Home });

type Leg = { id: string; kind: string; amountMinor: number; state: string };
type Payment = {
  id: string;
  status: string;
  chargedMinor: number;
  currency: string;
  legs: Leg[];
};
const gbp = (minor: number) => `£${(minor / 100).toFixed(2)}`;

function Home() {
  const session = authClient.useSession();
  const orgs = authClient.useListOrganizations();
  const org = orgs.data?.[0];
  const [payments, setPayments] = useState<Payment[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!org) return;
    let stopped = false;
    const load = async () => {
      const r = await authClient.nuvion.payments.list({
        query: { organizationId: org.id },
      });
      if (!stopped) {
        setPayments((r.data as { payments: Payment[] } | null)?.payments ?? []);
      }
    };
    load();
    const t = setInterval(load, 4000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [org]);

  if (session.isPending) return null;
  const say = (r: { error?: { message?: string } | null }, ok: string) =>
    setMsg(r.error ? (r.error.message ?? "Something went wrong") : ok);

  if (!session.data) {
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            email = String(f.get("email")),
            password = String(f.get("password"));
          const up = await authClient.signUp.email({
            email,
            password,
            name: email.split("@")[0],
          });
          if (up.error)
            say(await authClient.signIn.email({ email, password }), "");
        }}
      >
        <h1>Sign in</h1>
        <p>
          <input name="email" type="email" placeholder="email" required />{" "}
          <input
            name="password"
            type="password"
            placeholder="password (8+)"
            minLength={8}
            required
          />{" "}
          <button>Continue</button>
        </p>
        <p>{msg}</p>
      </form>
    );
  }

  return (
    <>
      <h1>Take a payment</h1>
      <p>
        Signed in as {session.data.user.email} ·{" "}
        <button onClick={() => authClient.signOut()}>Sign out</button>
      </p>

      {!org ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const created = await authClient.organization.create({
              name: String(f.get("name")),
              slug: `shop-${Date.now()}`,
            });
            if (!created.data) return say(created, "");
            say(
              await authClient.nuvion.organization.bind({
                organizationId: created.data.id,
                entityId: String(f.get("entity")),
                accountId: String(f.get("account")),
              }),
              "Connected.",
            );
            orgs.refetch();
          }}
        >
          <h2>1. Connect your Nuvion account</h2>
          <p>
            The entity and account that receive the money (from your Nuvion
            dashboard).
          </p>
          <p>
            <input name="name" placeholder="Shop name" required />{" "}
            <input
              name="entity"
              placeholder="entity id"
              defaultValue={import.meta.env.VITE_DEMO_ENTITY_ID}
              required
            />{" "}
            <input
              name="account"
              placeholder="account id"
              defaultValue={import.meta.env.VITE_DEMO_ACCOUNT_ID}
              required
            />{" "}
            <button>Connect</button>
          </p>
        </form>
      ) : (
        <>
          <h2>{org.name}</h2>
          <button
            onClick={async () => {
              const { checkoutUrl } = await startCheckout({
                data: { organizationId: org.id, redirectUrl: location.href },
              });
              if (checkoutUrl) location.href = checkoutUrl;
            }}
          >
            Pay £1.00 with Nuvion checkout
          </button>
          <h2>Payments</h2>
          {payments.length === 0 ? (
            <p>None yet.</p>
          ) : (
            <ul>
              {payments.map((p) => (
                <li key={p.id}>
                  <b>{gbp(p.chargedMinor)}</b> {p.status}
                  {p.legs.length
                    ? ` · ${p.legs.map((l) => `${l.kind} ${gbp(l.amountMinor)} ${l.state}`).join(", ")}`
                    : ""}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p>{msg}</p>
    </>
  );
}
