export async function onRequest(context) {
  const stripe = require('stripe')(context.env.STRIPE_SECRET_API_KEY);
  const url = new URL(context.request.url);
  const email = url.searchParams.get('email');

  const requestOrigin = context.request.headers.get("Origin");
  const allowedOrigins = ["https://freemusicdemixer.com", "https://pro.freemusicdemixer.com", "http://localhost:8788"];
  let corsHeader = 'Access-Control-Allow-Origin'; // Default to a restrictive policy

  if (allowedOrigins.includes(requestOrigin)) {
    corsHeader = requestOrigin; // Set to the request's origin if it's in the allowed list
  }

  const headers = {
    'Access-Control-Allow-Origin': corsHeader,
    'Access-Control-Expose-Headers': 'Content-Disposition'
  };

  if (!email) {
    return new Response('Email parameter is required', { status: 400, headers });
  }

  try {
    // Step 1: Check for active subscriptions
    const customers = await stripe.customers.list({ email: email });

    if (customers.data.length > 0) {
      const customer = customers.data[0];
      const subscriptions = await stripe.subscriptions.list({ customer: customer.id });

      if (subscriptions.data.length > 0) {
        const products = subscriptions.data.map(subscription => subscription.items.data.map(item => item.plan.product)).flat();
        const productInfo = await Promise.all(products.map(async product => await stripe.products.retrieve(product)));

        let userTier = 0; // Default to free tier

        for (let product of productInfo) {
          if (product.description.startsWith('Pro tier')) {
            userTier = 2;
            break;
          }
        }

        // Return the user's tier if a subscription is found
        return new Response(JSON.stringify({ tier: userTier }), {
          status: 200,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }

    console.log("No active subscriptions found for", email);
    console.log("Now trying checkout sessions");

    // Fetch all checkout sessions from the past 8 days
    // 7 days to account for week- and day-passes, and +1 day for potential timezone differences
    const sessions = await stripe.checkout.sessions.list({
      created: {
        gte: Math.floor(Date.now() / 1000) - (8 * 24 * 60 * 60),
      },
      limit: 100, // Adjust limit based on expected traffic
      customer_details: {
        email: email
      },
    });

    if (sessions.data.length > 0) {
      console.log("Sessions for this customer:", email, sessions.data.length);

      // Iterate through sessions to find active passes
      for (const session of sessions.data) {
        const sessionCreationTimestamp = session.created * 1000; // In milliseconds
        const currentTimestamp = Date.now();

        // Retrieve line items for this session
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });

        // Initialize pass type and expiry duration
        let passType = null;
        let duration = 0;

        // Loop through line items to determine if it's a day or week pass
        lineItems.data.forEach(item => {
          if (item.description.includes("Day Pass")) {
            passType = "day pass";
            duration = 2; // Grant 2 days of access to handle timezone issues
          } else if (item.description.includes("Week Pass")) {
            passType = "week pass";
            duration = 8; // Grant 8 days of access to handle timezone issues
          }
        });

        const durationInMilliseconds = duration * 24 * 60 * 60 * 1000; // Convert days to milliseconds
        const expiryTimestamp = sessionCreationTimestamp + durationInMilliseconds;

        // If passType is identified, calculate expiration date
        if (passType) {
          // Check if the pass is still active
          if (currentTimestamp <= expiryTimestamp) {
            console.log(`Active ${passType} for ${email} found. Session created on ${sessionCreationDate}`);
            return new Response(JSON.stringify({ tier: 2 }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
      }
    }

    // Step 3: If no valid subscription or pass is found, return free tier
    return new Response(JSON.stringify({ tier: 0 }), {
      status: 404,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers
    });
  }
}
