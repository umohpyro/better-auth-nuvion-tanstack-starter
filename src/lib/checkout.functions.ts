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
