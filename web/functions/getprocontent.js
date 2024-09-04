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
    const customers = await stripe.customers.list({ email: email });

    if (customers.data.length === 0) {
      return new Response('Customer not found or no active subscription', { status: 404, headers });
    }

    const customer = customers.data[0];
    const subscriptions = await stripe.subscriptions.list({ customer: customer.id });

    if (subscriptions.data.length === 0) {
      return new Response('No active subscription', { status: 404, headers });
    }

    const products = subscriptions.data.map(subscription => subscription.items.data.map(item => item.plan.product)).flat();
    const productInfo = await Promise.all(products.map(async product => await stripe.products.retrieve(product)));

    let userTier = 0; // Default to free tier

    for (let product of productInfo) {
      if (product.description.startsWith('Pro tier')) {
        userTier = 2;
        break;
      }
    }

    // Return the user's tier as a JSON response
    return new Response(JSON.stringify({ tier: userTier }), {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers
    });
  }
}
