import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "./auth";

// A server function: the Nuvion key and the plugin stay on the server, and the page gets back only the checkout address.
export const startCheckout = createServerFn({ method: "POST" })
  .validator((d: { organizationId: string; redirectUrl: string }) => d)
  .handler(async ({ data }) => {
    const payment = await auth.api.createPayment({
      headers: getRequestHeaders(),
      body: {
        organizationId: data.organizationId,
        amountMinor: 100,
        currency: "GBP",
        redirectUrl: data.redirectUrl,
      },
    });
    return { checkoutUrl: payment.checkoutUrl };
  });

// The same for a bank transfer: there is no checkout page, so the page gets back where to send the money.
// The key is fresh per request here; a real app would use its order id so a retry returns the same payment.
export const startBankTransfer = createServerFn({ method: "POST" })
  .validator(
    (d: {
      organizationId: string;
      amountMinor: number;
      currency: string;
      payerName: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const payment = await auth.api.createPayment({
      headers: getRequestHeaders(),
      body: {
        ...data,
        method: "bank-transfer",
        idempotencyKey: crypto.randomUUID(),
      },
    });
    return {
      paymentId: payment.paymentId,
      chargedMinor: payment.chargedMinor,
      details: payment.transferDetails,
    };
  });
