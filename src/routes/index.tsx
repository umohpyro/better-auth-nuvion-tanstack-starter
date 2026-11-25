import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { authClient } from "../lib/auth-client";
import { startBankTransfer, startCheckout } from "../lib/checkout.functions";

export const Route = createFileRoute("/")({ component: Home });

type Leg = { id: string; kind: string; amountMinor: number; state: string };
type Payment = {
  id: string;
  status: string;
  chargedMinor: number;
  currency: string;
  legs: Leg[];
};
// What a bank transfer payer needs: where to send it and what to write on it.
type Transfer = Awaited<ReturnType<typeof startBankTransfer>>;
const money = (minor: number, currency = "GBP") =>
  new Intl.NumberFormat("en", { style: "currency", currency }).format(
    minor / 100,
  );

function Home() {
  const session = authClient.useSession();
  const orgs = authClient.useListOrganizations();
  const org = orgs.data?.[0];
  const [payments, setPayments] = useState<Payment[]>([]);
  const [msg, setMsg] = useState("");
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  // Whether visitors bring their own Nuvion key (src/lib/byo.ts), and whether this one has.
  const [key, setKey] = useState<{ byo: boolean; connected: boolean } | null>(
    null,
  );
  const byo = key?.byo;

  useEffect(() => {
    fetch("/api/key")
      .then((r) => r.json())
      .then(setKey);
  }, []);

  useEffect(() => {
    if (!org) return;
    let stopped = false;
    const load = async () => {
      const r = await authClient.nuvion.payments.list({
        query: { organizationId: org.id },
      });
      const list = (r.data as { payments: Payment[] } | null)?.payments ?? [];
      if (!stopped) setPayments(list);
      // A visitor's own key has no webhook, so ask Nuvion about each pending payment instead of waiting for one.
      if (byo)
        for (const p of list)
          if (p.status === "pending")
            void authClient.nuvion.payments.refresh({ paymentId: p.id });
    };
    load();
    const t = setInterval(load, 4000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [org, byo]);

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

  if (key?.byo && !key.connected) {
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await fetch("/api/key", {
            method: "POST",
            body: JSON.stringify({
              apiKey: new FormData(e.currentTarget).get("apiKey"),
            }),
          });
          const body = await r.json();
          if (r.ok) setKey({ byo: true, connected: true });
          else setMsg(body.error);
        }}
      >
        <h1>Add your Nuvion sandbox key</h1>
        <p>
          This demo uses your own Nuvion sandbox, never mine. In the{" "}
          <a href="https://app.nuvion.dev/dashboard/settings">
            sandbox dashboard
          </a>
          , create an API key with the <b>Operations</b> role. It must be a
          sandbox key, and an Owner or Admin key is refused: it can do more than
          this demo needs.
        </p>
        <p>
          The key stays in a sealed cookie in this browser for eight hours. The
          server does not store it, and you can remove it any time.
        </p>
        <p>
          <input name="apiKey" type="password" placeholder="nv_..." required />{" "}
          <button>Use this key</button>
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
        {byo && (
          <>
            {" "}
            ·{" "}
            <button
              onClick={async () => {
                await fetch("/api/key", { method: "DELETE" });
                setKey({ byo: true, connected: false });
              }}
            >
              Remove my key
            </button>
          </>
        )}
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

          <h3>Or pay by bank transfer</h3>
          <p>
            No checkout page: the payer sends the money from their own bank, and
            the payment settles when Nuvion confirms the deposit. This is how
            you collect NGN.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                setTransfer(
                  await startBankTransfer({
                    data: {
                      organizationId: org.id,
                      amountMinor: Math.round(Number(f.get("amount")) * 100),
                      currency: String(f.get("currency")).toUpperCase(),
                      payerName: String(f.get("payer")), // as their bank shows it
                    },
                  }),
                );
              } catch (err) {
                setMsg(
                  err instanceof Error ? err.message : "Something went wrong",
                );
              }
            }}
          >
            <input
              name="amount"
              type="number"
              step="0.01"
              min="1"
              defaultValue="1"
              required
            />{" "}
            <input name="currency" defaultValue="GBP" size={4} required />{" "}
            <input
              name="payer"
              placeholder="your name, as your bank shows it"
              required
            />{" "}
            <button>Show transfer details</button>
          </form>
          {transfer?.details &&
            ["pending", undefined].includes(
              payments.find((p) => p.id === transfer.paymentId)?.status,
            ) && (
              <>
                <p>
                  Send exactly{" "}
                  <b>
                    {money(transfer.chargedMinor, transfer.details.currency)}
                  </b>{" "}
                  to:
                </p>
                <ul>
                  <li>
                    {transfer.details.beneficiaryName}
                    {transfer.details.bankName
                      ? `, ${transfer.details.bankName}`
                      : ""}
                  </li>
                  <li>
                    {[
                      transfer.details.accountNumber,
                      transfer.details.sortCode &&
                        `sort code ${transfer.details.sortCode}`,
                      transfer.details.iban && `IBAN ${transfer.details.iban}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </li>
                  <li>
                    reference <b>{transfer.details.reference}</b>
                  </li>
                </ul>
                <p>
                  Write the reference on the transfer, and send the exact
                  amount: the plugin matches a deposit by the reference, or by
                  the amount when the bank drops it. This page updates when it
                  arrives.
                </p>
              </>
            )}

          <h2>Payments</h2>
          {payments.length === 0 ? (
            <p>None yet.</p>
          ) : (
            <ul>
              {payments.map((p) => (
                <li key={p.id}>
                  <b>{money(p.chargedMinor, p.currency)}</b> {p.status}
                  {p.legs.length
                    ? ` · ${p.legs.map((l) => `${l.kind} ${money(l.amountMinor, p.currency)} ${l.state}`).join(", ")}`
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
